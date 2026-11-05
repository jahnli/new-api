import { createFileRoute, redirect } from '@tanstack/react-router'
import { z } from 'zod'

import { Home } from '@/features/home'
import { resolveAuthentication } from '@/lib/auth-session'
import { statusQueryOptions } from '@/lib/status-query'
import { useAuthStore } from '@/stores/auth-store'

// Only the current home visit is a logout landing. A reload resets this flag.
let isLogoutLanding = false

export const Route = createFileRoute('/')({
  validateSearch: z.object({
    signed_out: z.literal(true).optional().catch(undefined),
  }),
  beforeLoad: async ({ context, location, preload, search }) => {
    if (preload) return

    if (search.signed_out) {
      isLogoutLanding = true
      // Use router navigation to remove the hint from both the URL and router
      // state. The in-memory flag keeps this cleanup from restarting login.
      throw redirect({
        to: '/',
        search: { ...location.search, signed_out: undefined },
        hash: location.hash,
        replace: true,
      })
    }

    // This flag only suppresses navigation on the public home, never authorizes access.
    if (isLogoutLanding || useAuthStore.getState().auth.user) {
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
  onLeave: () => {
    isLogoutLanding = false
  },
  component: Home,
})
