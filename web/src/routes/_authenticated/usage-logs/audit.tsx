/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { createFileRoute, redirect } from '@tanstack/react-router'
import z from 'zod'

import { AuditLogs } from '@/features/usage-logs/audit'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

const auditSearchSchema = z.object({
  section: z
    .enum(['off-hours', 'image-studio', 'general'])
    .optional()
    .catch('general'),
  offHoursPage: z.number().optional().catch(1),
  offHoursPageSize: z.number().optional().catch(undefined),
  imageAuditPage: z.number().optional().catch(1),
  imageAuditPageSize: z.number().optional().catch(undefined),
  username: z.string().optional().catch(''),
  startTime: z.number().optional(),
  endTime: z.number().optional(),
  auditPage: z.number().optional().catch(1),
  auditPageSize: z.number().optional().catch(undefined),
  auditStartTime: z.number().optional(),
  auditEndTime: z.number().optional(),
  auditSuccess: z.enum(['true', 'false']).optional(),
  auditCategory: z
    .enum(['login', 'security', 'operation', 'access_token'])
    .optional(),
  auditTokenRef: z.string().optional().catch(''),
  auditUsername: z.string().optional().catch(''),
  auditRequestId: z.string().optional().catch(''),
})

export const Route = createFileRoute('/_authenticated/usage-logs/audit')({
  validateSearch: auditSearchSchema,
  beforeLoad: ({ search }) => {
    if (search.section && search.section !== 'general') {
      const user = useAuthStore.getState().auth.user
      if (!user || user.role < ROLE.SUPER_ADMIN) {
        throw redirect({ to: '/403' })
      }
    }
  },
  component: AuditLogsRoute,
})

function AuditLogsRoute() {
  return <AuditLogs search={Route.useSearch()} navigate={Route.useNavigate()} />
}
