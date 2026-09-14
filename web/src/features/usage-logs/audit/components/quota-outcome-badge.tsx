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
import { StatusBadge } from '@/components/status-badge'
import type { QuotaOutcomeTone } from '@/features/usage-logs/lib/quota-audit-operation'

const toneClassMap: Record<QuotaOutcomeTone, string> = {
  success:
    'border border-emerald-200/40 bg-emerald-50/35 !text-emerald-600 dark:border-emerald-900/40 dark:bg-emerald-950/15 dark:!text-emerald-400',
  danger:
    'border border-rose-200/50 bg-rose-50/35 !text-red-600 dark:border-rose-900/40 dark:bg-rose-950/15 dark:!text-red-400',
  neutral:
    'border border-border/60 bg-muted/30 dark:border-border/40 dark:bg-muted/20',
}

/**
 * Marks a quota adjustment as an increase, a decrease, or an override so the
 * operation is recognizable without reading the numbers next to it.
 */
export function QuotaOutcomeBadge(props: {
  label: string
  variant: QuotaOutcomeTone
}) {
  return (
    <StatusBadge
      label={props.label}
      variant={props.variant}
      size='sm'
      copyable={false}
      className={toneClassMap[props.variant]}
    />
  )
}
