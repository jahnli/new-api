import { createFileRoute, redirect } from '@tanstack/react-router'

import { isOIDCAutoLoginSuspended } from '@/features/auth/lib/oidc-auto-login'
import { Home } from '@/features/home'
import { resolveAuthentication } from '@/lib/auth-session'
import { statusQueryOptions } from '@/lib/status-query'
import { useAuthStore } from '@/stores/auth-store'

export const Route = createFileRoute('/')({
  beforeLoad: async ({ context, location, preload }) => {
    if (
      preload ||
      useAuthStore.getState().auth.user ||
      isOIDCAutoLoginSuspended()
    ) {
      return
    }

    // Use server-backed settings, not the localStorage placeholder. A status
    // outage must leave the public home available instead of forcing a login.
    const status = await context.queryClient
      .fetchQuery(statusQueryOptions)
      .catch(() => null)
    if (
      !status?.oidc_enabled ||
      !status.oidc_authorization_endpoint ||
      !status.oidc_client_id
    ) {
      return
    }

    const session = await resolveAuthentication()
    if (session.kind !== 'anonymous' || useAuthStore.getState().auth.user) {
      return
    }

    // Reuse the sign-in flow, including legal consent, MFA and loop protection.
    throw redirect({
      to: '/sign-in',
      search: { redirect: location.href },
      replace: true,
    })
  },
  component: Home,
})
