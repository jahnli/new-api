import { createFileRoute, redirect } from '@tanstack/react-router'

import { CompanyNotifications } from '@/features/company-notifications'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

export const Route = createFileRoute('/_authenticated/company-notifications/')({
  beforeLoad: () => {
    const { auth } = useAuthStore.getState()
    if (!auth.user || auth.user.role < ROLE.SUPER_ADMIN) {
      throw redirect({ to: '/403' })
    }
  },
  component: CompanyNotifications,
})
