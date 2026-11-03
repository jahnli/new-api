import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { clearAuthentication } from '@/lib/api'
import { handleServerError } from '@/lib/handle-server-error'
import { AuthOperationError } from '@/lib/secure-verification'
import { createServerError } from '@/lib/server-error-message'
import { useAuthStore } from '@/stores/auth-store'

import { createOAuthFlow, logout } from '../api'
import { buildOIDCOAuthUrl } from '../lib/oauth'
import { rememberOAuthLoginRedirect } from '../lib/oauth-callback-mode'
import { beginOIDCAutoLogin } from '../lib/oidc-auto-login'
import type { SystemStatus, CustomOAuthProviderInfo } from '../types'

/**
 * Hook for managing OAuth login
 */
export function useOAuthLogin(
  status: SystemStatus | null,
  redirectTo?: string,
  autoLogin = false
) {
  const { t } = useTranslation()
  const [isLoading, setIsLoading] = useState(false)
  const [isAutoLoggingIn, setIsAutoLoggingIn] = useState(false)
  const automaticRequest = useRef<Promise<string> | null>(null)
  const automaticFinished = useRef(false)
  const authorizationEndpoint = status?.oidc_authorization_endpoint
  const clientID = status?.oidc_client_id
  const oidcEnabled = status?.oidc_enabled

  useEffect(() => {
    if (
      !autoLogin ||
      !oidcEnabled ||
      !authorizationEndpoint ||
      !clientID ||
      automaticFinished.current ||
      useAuthStore.getState().auth.user
    ) {
      setIsAutoLoggingIn(false)
      return
    }

    if (!automaticRequest.current) {
      if (!beginOIDCAutoLogin()) return
      // The sign-in route has already checked the local session. Do not log
      // out here: another tab may have signed in while this page was loading.
      automaticRequest.current = createOAuthFlow('oidc', 'login')
    }

    let active = true
    setIsAutoLoggingIn(true)
    void automaticRequest.current
      .then((state) => {
        if (!active || useAuthStore.getState().auth.user) return
        automaticFinished.current = true
        rememberOAuthLoginRedirect(state, redirectTo)
        window.location.assign(
          buildOIDCOAuthUrl(authorizationEndpoint, clientID, state)
        )
      })
      .catch((error: unknown) => {
        if (!active) return
        automaticFinished.current = true
        setIsAutoLoggingIn(false)
        handleServerError(
          AuthOperationError.from(error, t('Failed to start OIDC login'))
        )
      })

    return () => {
      active = false
      // Retain the request across StrictMode effect replay; stale/unmounted
      // consumers must never navigate or create a second authorization flow.
    }
  }, [autoLogin, oidcEnabled, authorizationEndpoint, clientID, redirectTo, t])

  const resetSession = async () => {
    const response = await logout()
    if (!response.success) {
      throw createServerError(response, t('Failed to sign out session'))
    }
    clearAuthentication()
  }

  const handleOIDCLogin = async () => {
    if (!status?.oidc_authorization_endpoint || !status?.oidc_client_id) return

    setIsLoading(true)
    try {
      await resetSession()
      const state = await createOAuthFlow('oidc', 'login')
      rememberOAuthLoginRedirect(state, redirectTo)

      const url = buildOIDCOAuthUrl(
        status.oidc_authorization_endpoint,
        status.oidc_client_id,
        state
      )
      window.open(url, '_self')
    } catch (error) {
      handleServerError(
        AuthOperationError.from(error, t('Failed to start OIDC login'))
      )
    } finally {
      setIsLoading(false)
    }
  }

  const handleCustomOAuthLogin = async (provider: CustomOAuthProviderInfo) => {
    if (!provider.authorization_endpoint || !provider.client_id) return

    setIsLoading(true)
    try {
      await resetSession()
      const state = await createOAuthFlow(provider.slug, 'login')
      rememberOAuthLoginRedirect(state, redirectTo)

      const redirectUri = `${window.location.origin}/oauth/${provider.slug}`
      const url = new URL(provider.authorization_endpoint)
      url.searchParams.set('client_id', provider.client_id)
      url.searchParams.set('redirect_uri', redirectUri)
      url.searchParams.set('response_type', 'code')
      url.searchParams.set('state', state)
      if (provider.scopes) {
        url.searchParams.set('scope', provider.scopes)
      }

      window.open(url.toString(), '_self')
    } catch (error) {
      handleServerError(
        AuthOperationError.from(
          error,
          t('Failed to start {{provider}} login', { provider: provider.name })
        )
      )
    } finally {
      setIsLoading(false)
    }
  }

  return {
    isLoading: isLoading || isAutoLoggingIn,
    isAutoLoggingIn,
    handleOIDCLogin,
    handleCustomOAuthLogin,
  }
}
