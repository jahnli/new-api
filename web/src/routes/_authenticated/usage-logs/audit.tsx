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
import { createFileRoute } from '@tanstack/react-router'
import z from 'zod'

import { AuditLogs } from '@/features/usage-logs/audit'

const auditSearchSchema = z.object({
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
  component: AuditLogsRoute,
})

function AuditLogsRoute() {
  return <AuditLogs search={Route.useSearch()} navigate={Route.useNavigate()} />
}
