import { createFileRoute, redirect } from '@tanstack/react-router'
import z from 'zod'

import { Channels } from '@/features/channels'
import {
  ADMIN_PERMISSION_ACTIONS,
  ADMIN_PERMISSION_RESOURCES,
  hasPermission,
} from '@/lib/admin-permissions'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

const channelsSearchSchema = z.object({
  filter: z.string().optional().catch(''),
  status: z.array(z.string()).optional().catch([]),
  type: z.array(z.string()).optional().catch([]),
  group: z.array(z.string()).optional().catch([]),
  model: z.string().optional().catch(''),
})

export const Route = createFileRoute('/_authenticated/channels/')({
  beforeLoad: () => {
    const { auth } = useAuthStore.getState()

    if (
      !auth.user ||
      auth.user.role < ROLE.ADMIN ||
      !hasPermission(
        auth.user,
        ADMIN_PERMISSION_RESOURCES.CHANNEL,
        ADMIN_PERMISSION_ACTIONS.INTERFACE_VIEW
      )
    ) {
      throw redirect({
        to: '/403',
      })
    }
  },
  validateSearch: channelsSearchSchema,
  component: Channels,
})
