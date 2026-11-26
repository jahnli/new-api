import { createFileRoute, redirect } from '@tanstack/react-router'
import { isAxiosError } from 'axios'

import { DataOverview } from '@/features/data-overview'
import { getDepartmentTree } from '@/features/data-overview/api'
import { ROLE, canAccessDataOverview } from '@/lib/roles'
import { statusQueryOptions } from '@/lib/status-query'
import { useAuthStore } from '@/stores/auth-store'

export const Route = createFileRoute('/_authenticated/data-overview/')({
  beforeLoad: async ({ context }) => {
    const { auth } = useAuthStore.getState()

    if (auth.user && auth.user.role >= ROLE.ADMIN) return
    const status = await context.queryClient.fetchQuery(statusQueryOptions)
    if (status?.external_mode_enabled === true) {
      // A department grant may have changed since login. Load the authorized tree
      // on entry and share it with the overview page.
      try {
        await context.queryClient.fetchQuery({
          queryKey: ['department', 'tree'],
          queryFn: getDepartmentTree,
          staleTime: 0,
          retry: false,
        })
        return
      } catch (error) {
        if (!isAxiosError(error) || error.response?.status !== 403) throw error
        throw redirect({ to: '/403' })
      }
    }
    if (!status || !canAccessDataOverview(auth.user)) {
      throw redirect({ to: '/403' })
    }
  },
  component: DataOverview,
})
