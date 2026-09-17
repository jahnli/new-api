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
import {
  ArrowDownRight01Icon,
  ArrowRight01Icon,
  ArrowUpRight01Icon,
  Cancel01Icon,
  EqualSignIcon,
  Wallet01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import type { ColumnDef } from '@tanstack/react-table'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { TruncatedCell } from '@/components/data-table'
import { StatusBadge } from '@/components/status-badge'
import { IconBadge, type IconBadgeTone } from '@/components/ui/icon-badge'
import dayjs from '@/lib/dayjs'
import { cn } from '@/lib/utils'

import { LogIpAddress } from '../../components/log-ip-address'
import { LogUserCell } from '../../components/log-user-cell'
import type { AuditLog } from '../api'
import { buildAuditDetails } from '../lib/audit-details'
import { AuditLogDetailsDialog } from './audit-log-details-dialog'

export function useAuditLogColumns(
  accessOnly?: boolean,
  canFetchUserDetails?: boolean
): ColumnDef<AuditLog>[] {
  const { t } = useTranslation()
  return useMemo(() => {
    const columns: ColumnDef<AuditLog>[] = [
      {
        accessorKey: 'created_at',
        header: t('Time'),
        size: 155,
        cell: ({ row }) => (
          <span className='font-mono tabular-nums'>
            {dayjs.unix(row.original.created_at).format('YYYY-MM-DD HH:mm:ss')}
          </span>
        ),
        meta: { label: t('Time'), mobileTitle: true },
      },
    ]
    if (!accessOnly) {
      columns.push(
        {
          id: 'user',
          accessorFn: (entry) => entry.username,
          header: t('User'),
          size: 150,
          cell: ({ row }) => (
            <LogUserCell
              userId={row.original.user_id}
              username={row.original.username}
              displayName={row.original.display_name}
              avatarUrl={row.original.avatar_url}
              openId={row.original.open_id}
              gender={row.original.gender}
              canFetchUserDetails={canFetchUserDetails}
              sensitiveVisible
            />
          ),
          meta: { label: t('User') },
        },
        {
          id: 'event',
          header: t('Event'),
          size: 300,
          accessorFn: (entry) => {
            const detail = buildAuditDetails(entry, t)
            return [detail.summary, detail.operation?.description]
              .filter(Boolean)
              .join(' · ')
          },
          cell: ({ row, getValue }) => {
            const detail = buildAuditDetails(row.original, t)
            const operation = detail.operation
            if (!operation) {
              return (
                <TruncatedCell className='max-w-64'>
                  {getValue<string>()}
                </TruncatedCell>
              )
            }
            if (detail.quotaOperation) {
              const quota = detail.quotaOperation
              const description = row.original.success
                ? quota.description
                : `${t('Failed')} · ${quota.description}`
              let amountClassName = 'text-muted-foreground'
              let icon = EqualSignIcon
              let iconTone: IconBadgeTone = 'neutral'
              if (!row.original.success) {
                icon = Cancel01Icon
                iconTone = 'destructive'
              } else if (quota.outcome.variant === 'success') {
                icon = ArrowUpRight01Icon
                iconTone = 'info'
                amountClassName = 'text-info'
              } else if (quota.outcome.variant === 'danger') {
                icon = ArrowDownRight01Icon
                iconTone = 'destructive'
                amountClassName = 'text-destructive'
              }
              return (
                <TruncatedCell
                  className='focus-visible:ring-ring/50 w-full max-w-72 rounded-sm px-1 py-1 outline-none focus-visible:ring-2'
                  contentClassName='flex flex-col gap-1'
                  tooltipContent={description}
                  tabIndex={0}
                >
                  <span className='sr-only'>{description}</span>
                  <span
                    aria-hidden='true'
                    className='flex min-w-0 items-center gap-1.5'
                  >
                    <IconBadge tone={iconTone} size='xs'>
                      <HugeiconsIcon icon={icon} strokeWidth={2} />
                    </IconBadge>
                    <span
                      className={cn(
                        'min-w-0 truncate font-mono text-sm font-semibold tabular-nums',
                        amountClassName
                      )}
                    >
                      {quota.signedAmount}
                    </span>
                  </span>
                  {quota.balances && (
                    <span
                      aria-hidden='true'
                      className='flex min-w-0 items-center gap-1.5 font-mono text-xs tabular-nums'
                    >
                      <HugeiconsIcon
                        icon={Wallet01Icon}
                        className='text-muted-foreground/60 size-5 shrink-0 p-0.5'
                        strokeWidth={1.5}
                      />
                      <span className='text-muted-foreground min-w-0 truncate'>
                        {quota.balances.before}
                      </span>
                      <HugeiconsIcon
                        icon={ArrowRight01Icon}
                        className='text-muted-foreground/60 size-3.5 shrink-0'
                        strokeWidth={1.5}
                      />
                      <span className='text-foreground min-w-0 truncate font-medium'>
                        {quota.balances.after}
                      </span>
                    </span>
                  )}
                </TruncatedCell>
              )
            }
            return (
              <div className='min-w-0 space-y-1'>
                <div className='flex min-w-0 items-baseline gap-1'>
                  <TruncatedCell
                    className='min-w-0 font-medium'
                    tooltipContent={operation.summary}
                  >
                    {operation.headline}
                  </TruncatedCell>
                  {operation.identifier && (
                    <span className='shrink-0 whitespace-nowrap'>
                      {operation.identifier}
                    </span>
                  )}
                </div>
                {operation.description && (
                  <TruncatedCell
                    className='text-muted-foreground'
                    contentClassName='line-clamp-2 whitespace-normal break-words'
                    tooltipContent={operation.description}
                  >
                    {operation.description}
                  </TruncatedCell>
                )}
              </div>
            )
          },
          meta: { label: t('Event') },
        }
      )
    }
    columns.push(
      {
        accessorKey: 'route',
        header: t('Route'),
        size: 220,
        cell: ({ row }) => (
          <TruncatedCell className='max-w-60 font-mono'>
            {row.original.route || '—'}
          </TruncatedCell>
        ),
        meta: { label: t('Route') },
      },
      {
        accessorKey: 'method',
        header: t('Method'),
        size: 76,
        cell: ({ row }) => (
          <span className='text-muted-foreground font-mono'>
            {row.original.method || '—'}
          </span>
        ),
        meta: { label: t('Method') },
      },
      {
        accessorKey: 'status',
        header: 'HTTP',
        size: 60,
        cell: ({ row }) => (
          <span className='font-mono tabular-nums'>
            {row.original.status || '—'}
          </span>
        ),
        meta: { label: 'HTTP' },
      },
      {
        accessorKey: 'success',
        header: t('Result'),
        size: 82,
        cell: ({ row }) => (
          <StatusBadge
            label={row.original.success ? t('Success') : t('Failed')}
            variant={row.original.success ? 'success' : 'danger'}
            copyable={false}
          />
        ),
        meta: { label: t('Result'), mobileBadge: true },
      },
      {
        accessorKey: 'user_agent',
        header: t('Client'),
        size: 180,
        cell: ({ row }) => (
          <TruncatedCell className='max-w-48'>
            {row.original.user_agent || '—'}
          </TruncatedCell>
        ),
        meta: { label: t('Client'), mobileHidden: true },
      },
      {
        accessorKey: 'ip',
        header: 'IP',
        size: 130,
        cell: ({ row }) => <LogIpAddress ipAddress={row.original.ip} />,
        meta: { label: 'IP' },
      },
      {
        id: 'details',
        header: t('Details'),
        size: 70,
        enableHiding: false,
        cell: ({ row }) => <AuditLogDetailsDialog entry={row.original} />,
        meta: { label: t('Details') },
      }
    )
    return columns
  }, [accessOnly, canFetchUserDetails, t])
}
