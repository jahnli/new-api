import type { QueryClient } from '@tanstack/react-query'
import i18n from 'i18next'

import { api } from '@/lib/api'
import {
  applyAuthBundle,
  getAuthenticationEpoch,
  isAuthBundle,
  refreshAuthentication,
} from '@/lib/auth-session'
import { subscribeAuthSessionEvents } from '@/lib/auth-session-sync'
import { isSilentOIDCLoginSuppressed } from '@/lib/oidc-silent-preference'
import { statusQueryOptions } from '@/lib/status-query'
import { useAuthStore } from '@/stores/auth-store'

import { isLoginChallenge } from '../secure-verification/api'
import type { LoginResponse } from '../types'
import { getSavedLanguage, sanitizeAuthRedirect } from './auth-redirect'
import { receiveSilentOIDCCallback } from './oidc-silent-transport'

let probePromise: Promise<void> | undefined

function encodePKCE(value: Uint8Array): string {
  return btoa(String.fromCharCode(...value))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '')
}

async function probeSilentOIDC(
  redirectTo: string,
  signal: AbortSignal,
  authorizationTimeout: number
): Promise<void> {
  // Recheck after acquiring the cross-tab lock: another tab may have signed in.
  // This also honours a valid refresh cookie whose public session hint is absent.
  if (signal.aborted || isSilentOIDCLoginSuppressed()) return
  const outcome = await refreshAuthentication()
  if (
    outcome.kind !== 'anonymous' ||
    signal.aborted ||
    isSilentOIDCLoginSuppressed()
  ) {
    return
  }

  const epoch = getAuthenticationEpoch()
  const isCurrent = () =>
    !signal.aborted &&
    getAuthenticationEpoch() === epoch &&
    !isSilentOIDCLoginSuppressed() &&
    !useAuthStore.getState().auth.pendingLoginVerification
  const verifier = encodePKCE(crypto.getRandomValues(new Uint8Array(32)))
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(verifier)
  )
  if (!isCurrent()) return

  const options = {
    skipAuthRefresh: true,
    skipBusinessError: true,
    skipErrorHandler: true,
  }
  const started = await api.post<{
    success: boolean
    data?: { flow_token: string; authorization_url: string }
  }>(
    '/api/oauth/state',
    {
      provider: 'oidc',
      intent: 'login',
      silent: true,
      code_challenge: encodePKCE(new Uint8Array(digest)),
    },
    { ...options, signal }
  )
  if (!started.data.success || !started.data.data || !isCurrent()) return
  const { flow_token: state, authorization_url: authorizationURL } =
    started.data.data
  if (typeof state !== 'string' || typeof authorizationURL !== 'string') return
  const url = new URL(authorizationURL)
  // A callback must return to the parent origin. Misconfigured ServerAddress
  // should fail quietly instead of handing an authorization code to another site.
  if (
    url.searchParams.get('redirect_uri') !==
    `${window.location.origin}/oauth/oidc`
  ) {
    return
  }
  if (
    url.protocol !== 'https:' &&
    !(
      url.protocol === 'http:' &&
      ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    )
  ) {
    return
  }

  const callback = await receiveSilentOIDCCallback(
    authorizationURL,
    state,
    signal
  )
  if (!isCurrent()) return
  // The authorization deadline covers the lock, preparation and iframe only.
  // Once the callback arrives, completion has its own HTTP timeout. Keep the
  // signal for peer-session cancellation, but do not let the iframe deadline
  // invalidate and revoke a successful login while the backend is exchanging.
  clearTimeout(authorizationTimeout)
  // Finish even error responses to consume the one-time flow. Do not abort an
  // in-flight completion: we need its result to revoke a superseded session.
  const response = await api.post<LoginResponse>(
    '/api/oauth/oidc/silent',
    {
      state,
      code: callback.code,
      error: callback.error,
      code_verifier: verifier,
    },
    { ...options, timeout: 15_000 }
  )
  if (!response.data.success) return
  const result = response.data.data
  if (!isCurrent()) {
    if (isAuthBundle(result)) {
      // Use the returned session's bearer, not the shared client's newer bearer.
      // Omit cookies so a newer session cookie cannot prevent revocation or be
      // cleared. Any remaining cookie for the revoked SID fails the next refresh.
      await fetch('/api/user/auth/logout', {
        method: 'POST',
        credentials: 'omit',
        cache: 'no-store',
        signal: AbortSignal.timeout(5_000),
        headers: {
          Authorization: `Bearer ${result.access_token}`,
          'X-Auth-Session': result.session.sid,
        },
      })
    }
    return
  }
  if (isAuthBundle(result)) {
    applyAuthBundle(result)
    const language = getSavedLanguage(result.user)
    if (language && language !== i18n.language) {
      await i18n.changeLanguage(language)
    }
    return
  }
  if (isLoginChallenge(result) && result.expires_at * 1000 > Date.now()) {
    // Public pages remain public; sign-in and protected guards open the existing
    // verification screen. Local MFA is never bypassed by the IdP session.
    const target =
      window.location.pathname === '/sign-in'
        ? new URLSearchParams(window.location.search).get('redirect')
        : redirectTo
    useAuthStore.getState().auth.setPendingLoginVerification({
      challenge: result,
      source: 'silent_oidc',
      redirectTo:
        sanitizeAuthRedirect(target, window.location.origin) ?? undefined,
    })
  }
}

async function runSilentOIDC(redirectTo: string): Promise<void> {
  const controller = new AbortController()
  const authorizationTimeout = window.setTimeout(
    () => controller.abort(),
    8_000
  )
  let peerChanged = false
  const unsubscribe = subscribeAuthSessionEvents(() => {
    peerChanged = true
    controller.abort()
  })
  try {
    if (navigator.locks) {
      await navigator.locks.request(
        'new-api:oidc-silent-login',
        {
          signal: controller.signal,
        },
        () =>
          probeSilentOIDC(redirectTo, controller.signal, authorizationTimeout)
      )
    } else {
      await probeSilentOIDC(redirectTo, controller.signal, authorizationTimeout)
    }
  } catch {
    // No IdP session, blocked third-party cookies, frame policies, network errors
    // and unsupported providers all leave the ordinary login flow available.
  } finally {
    clearTimeout(authorizationTimeout)
    unsubscribe()
    if (peerChanged && !isSilentOIDCLoginSuppressed()) {
      await refreshAuthentication()
    }
  }
}

export async function trySilentOIDCLogin(
  queryClient: QueryClient,
  redirectTo: string
): Promise<void> {
  if (
    window.parent !== window ||
    !crypto.subtle ||
    isSilentOIDCLoginSuppressed()
  ) {
    return
  }
  const auth = useAuthStore.getState().auth
  if (auth.user || auth.pendingLoginVerification) return
  if (probePromise) return probePromise
  const status = await queryClient
    .fetchQuery(statusQueryOptions)
    .catch(() => null)
  if (status?.oidc_silent_login !== true) return
  // Single-flight and at most one attempt per document, including failures.
  probePromise ??= runSilentOIDC(redirectTo)
  return probePromise
}
