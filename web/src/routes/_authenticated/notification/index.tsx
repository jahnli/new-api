import { createFileRoute, redirect } from '@tanstack/react-router'

import { Notifications } from '@/features/notification'
import { hasPermission } from '@/lib/admin-permissions'
import { useAuthStore } from '@/stores/auth-store'

export const Route = createFileRoute('/_authenticated/notification/')({
  beforeLoad: () => {
    if (
      !hasPermission(useAuthStore.getState().auth.user, 'notification', 'view')
    ) {
      throw redirect({ to: '/403' })
    }
  },
  component: Notifications,
})
