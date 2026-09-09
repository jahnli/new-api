import type { ColumnDef } from '@tanstack/react-table'
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
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { BadgeCell, DataTableColumnHeader } from '@/components/data-table'
import { GroupBadge } from '@/components/group-badge'
import { LongText } from '@/components/long-text'
import { StatusBadge } from '@/components/status-badge'
import { TableId } from '@/components/table-id'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { ModelBadge } from '@/features/usage-logs/components/model-badge'
import { useDemoMode } from '@/hooks/use-demo-mode'
import { useExternalMode } from '@/hooks/use-external-mode'
import { getUserAvatarFallback, getUserAvatarStyle } from '@/lib/avatar'
import { formatQuotaWithCurrency } from '@/lib/currency'
import { getDemoModeUsername } from '@/lib/demo-mode'
import { formatQuota, formatTimestamp } from '@/lib/format'
import { calculateUnitPricePer100MTokens } from '@/lib/unit-price'
import { buildFeishuUserChatUrl, cn } from '@/lib/utils'

import { USER_STATUSES, USER_ROLES } from '../constants'
import {
  type UserColumnRow,
  parseCustomFields,
  CUSTOM_FIELD_KEYS,
} from '../types'
import { UserProfileHoverCard } from './user-profile-hover-card'

// ============================================================================
// Shared Formatters
// ============================================================================

export function getQuotaProgressColor(usedPercentage: number): string {
  if (usedPercentage >= 80) {
    return '[&_[data-slot=progress-indicator]]:bg-red-500'
  }
  if (usedPercentage >= 50) {
    return '[&_[data-slot=progress-indicator]]:bg-amber-500'
  }
  return '[&_[data-slot=progress-indicator]]:bg-emerald-500'
}
export function formatAmountCny(value: number | undefined): string {
  const amount = value ?? 0
  return `¥${Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)}`
}

export function formatUserTokens(tokens: number | undefined): string {
  const value = tokens ?? 0
  if (value <= 0) return '-'
  return `${(value / 1_0000_0000).toFixed(2)} 亿`
}

export function formatUserTokensDetail(tokens: number | undefined): string {
  const value = tokens ?? 0
  if (value <= 0) return '-'
  return value.toLocaleString()
}

export function formatUserRequests(requests: number | undefined): string {
  const value = requests ?? 0
  if (value <= 0) return '-'
  if (value >= 10_000) {
    return `${Intl.NumberFormat(undefined, {
      maximumFractionDigits: 2,
    }).format(value / 10_000)} 万`
  }
  return Intl.NumberFormat().format(value)
}

// ============================================================================
// Column Factories
// ============================================================================

export function userIdColumn<T extends UserColumnRow>(
  t: (key: string) => string
): ColumnDef<T> {
  return {
    accessorKey: 'id',
    header: t('ID'),
    cell: ({ row }) => (
      <TableId value={row.getValue('id') as number} className='w-[48px]' />
    ),
    size: 64,
    meta: { mobileHidden: true },
  }
}

export function userNameColumn<T extends UserColumnRow>(
  t: (key: string) => string,
  demoMode: boolean
): ColumnDef<T> {
  return {
    accessorKey: 'username',
    header: t('Username'),
    cell: ({ row }) => {
      const user = row.original as UserColumnRow
      const username = user.username
      const displayName = user.display_name
      const remark = user.remark
      const avatarUrl = user.avatar_url
      const primaryName = getDemoModeUsername(displayName || username, demoMode)

      if (demoMode) {
        return (
          <LongText className='w-[130px] font-medium'>{primaryName}</LongText>
        )
      }

      const avatarFallback = getUserAvatarFallback(primaryName)
      const avatarFallbackStyle = getUserAvatarStyle(primaryName)
      const feishuChatUrl = buildFeishuUserChatUrl(user.open_id)
      const avatarElement = (
        <Avatar size='sm' className='shrink-0'>
          {avatarUrl && <AvatarImage src={avatarUrl} alt={primaryName} />}
          <AvatarFallback
            className='text-xs font-medium text-white'
            style={avatarFallbackStyle}
          >
            {avatarFallback}
          </AvatarFallback>
        </Avatar>
      )

      return (
        <div className='flex w-[130px] min-w-0 items-center gap-2'>
          <UserProfileHoverCard user={user}>
            {feishuChatUrl ? (
              <a
                href={feishuChatUrl}
                target='_blank'
                rel='noopener noreferrer'
                className='focus-visible:ring-ring rounded-full focus-visible:ring-2 focus-visible:outline-none'
                onClick={(event) => event.stopPropagation()}
              >
                {avatarElement}
              </a>
            ) : (
              avatarElement
            )}
          </UserProfileHoverCard>
          <div className='flex min-w-0 flex-1 flex-col gap-1'>
            <LongText className='max-w-full font-medium'>
              {primaryName}
            </LongText>
            {(displayName && displayName !== username) || remark ? (
              <div className='text-muted-foreground flex min-w-0 items-center gap-1.5 text-xs'>
                {displayName && displayName !== username ? (
                  <LongText className='min-w-0 flex-1'>{username}</LongText>
                ) : null}
                {remark ? (
                  <Tooltip>
                    <TooltipTrigger
                      render={<span className='min-w-0 shrink-0' />}
                    >
                      <LongText className='max-w-[60px]'>{remark}</LongText>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className='text-xs'>{remark}</p>
                    </TooltipContent>
                  </Tooltip>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      )
    },
    enableHiding: false,
    size: 170,
    meta: { mobileTitle: true },
  }
}

export function userQuotaColumn<T extends UserColumnRow>(
  t: (key: string) => string,
  opts?: { width?: number; headerDescription?: string }
): ColumnDef<T> {
  const headerText = t('Used / Total')
  const headerDescription =
    opts?.headerDescription ??
    t(
      'Used quota and total quota data are fixed to the current calendar month and are not affected by the selected time range.'
    )
  return {
    id: 'quota',
    accessorKey: 'quota',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={headerText} />
    ),
    cell: ({ row }) => {
      const user = row.original as UserColumnRow
      const used = user.sub_quota_used ?? 0
      const total = user.sub_quota_total ?? 0
      const remaining = total - used

      if (total === 0 && user.has_active_subscription !== false) {
        return <span className='text-muted-foreground text-sm'>-</span>
      }

      const usedPercentage = total > 0 ? Math.min((used / total) * 100, 100) : 0
      const formattedUsedQuota = formatQuotaWithCurrency(used, {
        digitsLarge: 2,
        digitsSmall: 2,
        abbreviate: true,
      })

      return (
        <Tooltip>
          <TooltipTrigger
            render={
              <div className='w-full max-w-full min-w-0 cursor-help space-y-1.5 overflow-hidden' />
            }
          >
            <div className='flex min-w-0 items-center justify-between gap-x-4 text-xs'>
              <span className='min-w-0 truncate font-medium tabular-nums'>
                {formattedUsedQuota}
              </span>
              <span className='text-muted-foreground min-w-0 truncate text-right tabular-nums'>
                {formatQuota(total)}
              </span>
            </div>
            <Progress
              value={usedPercentage}
              className={cn('h-1.5', getQuotaProgressColor(usedPercentage))}
            />
          </TooltipTrigger>
          <TooltipContent>
            <div className='space-y-1 text-xs'>
              <div>
                {t('Used:')} {formattedUsedQuota}
              </div>
              <div>
                {t('Remaining:')} {formatQuota(remaining)}
              </div>
              <div>
                {t('Total:')} {formatQuota(total)}
              </div>
              <div>
                {t('Percentage:')} {usedPercentage.toFixed(1)}%
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      )
    },
    size: opts?.width ? opts.width + 20 : 150,
    meta: { description: headerDescription },
  }
}

export function userCostColumn<T extends UserColumnRow>(
  t: (key: string) => string,
  opts: { accessor: string; header?: string }
): ColumnDef<T> {
  return {
    accessorKey: opts.accessor,
    header: opts.header ?? t('Total Cost'),
    cell: ({ row }) => (
      <span className='text-sm font-medium tabular-nums'>
        {formatAmountCny(
          (row.original as Record<string, unknown>)[opts.accessor] as
            | number
            | undefined
        )}
      </span>
    ),
    size: 120,
    meta: { mobileHidden: true },
  }
}

export function userAveragePriceColumn<T extends UserColumnRow>(
  t: (key: string) => string,
  opts: { costAccessor: string; tokensAccessor: string }
): ColumnDef<T> {
  return {
    id: 'average_price',
    accessorFn: (row) => {
      const source = row as Record<string, unknown>
      const cost = Number(source[opts.costAccessor] ?? 0)
      const tokens = Number(source[opts.tokensAccessor] ?? 0)

      if (
        !Number.isFinite(cost) ||
        !Number.isFinite(tokens) ||
        cost <= 0 ||
        tokens <= 0
      ) {
        return 0
      }

      return calculateUnitPricePer100MTokens(cost, tokens)
    },
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title={t('Unit Price')} />
    ),
    cell: ({ row }) => {
      const averagePrice = row.getValue('average_price') as number

      if (!Number.isFinite(averagePrice) || averagePrice <= 0) {
        return <span className='text-muted-foreground text-sm'>-</span>
      }

      return (
        <Tooltip>
          <TooltipTrigger
            render={<span className='cursor-default text-sm tabular-nums' />}
          >
            {formatAmountCny(averagePrice)}/{t('100M Tokens')}
          </TooltipTrigger>
          <TooltipContent>
            <span className='text-xs'>{t('Unit price per 100M tokens')}</span>
          </TooltipContent>
        </Tooltip>
      )
    },
    enableSorting: true,
    size: 110,
    meta: {
      mobileHidden: true,
      description: t('Unit price per 100M tokens'),
    },
  }
}

export function userTokensColumn<T extends UserColumnRow>(
  t: (key: string) => string,
  opts: { accessor: string; header?: string }
): ColumnDef<T> {
  return {
    accessorKey: opts.accessor,
    header: opts.header ?? t('Tokens'),
    cell: ({ row }) => {
      const tokens = (row.original as Record<string, unknown>)[
        opts.accessor
      ] as number | undefined
      const display = formatUserTokens(tokens)
      const detail = formatUserTokensDetail(tokens)
      if (detail && detail !== display) {
        return (
          <Tooltip>
            <TooltipTrigger
              render={<span className='cursor-default text-sm tabular-nums' />}
            >
              {display}
            </TooltipTrigger>
            <TooltipContent>
              <span className='font-mono text-xs'>{detail}</span>
            </TooltipContent>
          </Tooltip>
        )
      }
      return (
        <span className='text-muted-foreground text-sm tabular-nums'>
          {display}
        </span>
      )
    },
    size: 100,
    meta: { mobileHidden: true },
  }
}

export function userRequestsColumn<T extends UserColumnRow>(
  t: (key: string) => string,
  opts: { accessor: string; header?: string }
): ColumnDef<T> {
  return {
    accessorKey: opts.accessor,
    header: opts.header ?? t('Request Count'),
    cell: ({ row }) => (
      <span className='text-sm tabular-nums'>
        {formatUserRequests(
          (row.original as Record<string, unknown>)[opts.accessor] as
            | number
            | undefined
        )}
      </span>
    ),
    size: 100,
    meta: { mobileHidden: true },
  }
}

export function userModelColumn<T extends UserColumnRow>(
  t: (key: string) => string,
  opts: { accessor: string; header?: string; variant?: 'badge' | 'text' }
): ColumnDef<T> {
  return {
    accessorKey: opts.accessor,
    header: opts.header ?? t('Common Model'),
    cell: ({ row }) => {
      const modelName = (row.original as Record<string, unknown>)[
        opts.accessor
      ] as string | undefined
      if (!modelName) {
        return <span className='text-muted-foreground text-sm'>-</span>
      }
      if (opts.variant === 'badge') {
        return <ModelBadge modelName={modelName} />
      }
      return (
        <Tooltip>
          <TooltipTrigger
            render={<div className='max-w-[180px] cursor-help' />}
          >
            <LongText className='text-sm'>{modelName}</LongText>
          </TooltipTrigger>
          <TooltipContent>
            <p className='text-xs'>{modelName}</p>
          </TooltipContent>
        </Tooltip>
      )
    },
    size: 190,
    meta: { mobileHidden: true },
  }
}

export function userDepartmentColumn<T extends UserColumnRow>(
  t: (key: string) => string
): ColumnDef<T> {
  return {
    accessorKey: 'department_name',
    header: t('Department'),
    cell: ({ row }) => {
      const dept = row.original.department_name
      if (!dept) {
        return <span className='text-muted-foreground text-sm'>-</span>
      }
      const parts = dept.split('/')
      const firstLevel = parts[0]
      const rest = parts.slice(1).join('/')
      return (
        <Tooltip>
          <TooltipTrigger
            render={
              <div className='w-[200px] max-w-[200px] min-w-[200px] cursor-help' />
            }
          >
            <div className='text-sm leading-snug'>
              <LongText>{firstLevel}</LongText>
              {rest && (
                <LongText className='text-muted-foreground !text-xs'>
                  {rest}
                </LongText>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p className='max-w-[320px] text-xs'>{dept}</p>
          </TooltipContent>
        </Tooltip>
      )
    },
    size: 200,
    meta: { mobileHidden: true },
  }
}

export function userJobLevelColumn<T extends UserColumnRow>(
  t: (key: string) => string
): ColumnDef<T> {
  return {
    id: 'job_level',
    header: t('Job Level'),
    cell: ({ row }) => {
      const customFields = parseCustomFields(row.original.custom_field_values)
      const level = customFields?.[CUSTOM_FIELD_KEYS.JOB_LEVEL]
      return (
        <span className='text-muted-foreground text-sm'>{level || '-'}</span>
      )
    },
    size: 120,
    meta: { mobileHidden: true },
  }
}

export function userJoinDateColumn<T extends UserColumnRow>(
  t: (key: string) => string
): ColumnDef<T> {
  return {
    accessorKey: 'join_date',
    header: t('Join Date'),
    cell: ({ row }) => {
      const date = row.original.join_date
      return (
        <span className='text-muted-foreground text-sm'>{date || '-'}</span>
      )
    },
    size: 120,
    meta: { mobileHidden: true },
  }
}

export function userLastLoginColumn<T extends UserColumnRow>(
  t: (key: string) => string
): ColumnDef<T> {
  return {
    accessorKey: 'last_login_at',
    header: t('Last Login'),
    cell: ({ row }) => {
      const ts = row.original.last_login_at
      return (
        <span className='text-muted-foreground text-sm'>
          {ts ? formatTimestamp(ts) : '-'}
        </span>
      )
    },
    size: 150,
    meta: { mobileHidden: true },
  }
}

export function userCreatedAtColumn<T extends UserColumnRow>(
  t: (key: string) => string
): ColumnDef<T> {
  return {
    accessorKey: 'created_at',
    header: t('Created At'),
    cell: ({ row }) => {
      const ts = row.original.created_at
      return (
        <span className='text-muted-foreground text-sm'>
          {ts ? formatTimestamp(ts) : '-'}
        </span>
      )
    },
    size: 180,
    meta: { mobileHidden: true },
  }
}

export function userRoleColumn<T extends UserColumnRow>(
  t: (key: string) => string
): ColumnDef<T> {
  return {
    accessorKey: 'role',
    header: t('Role'),
    cell: ({ row }) => {
      const roleValue = row.original.role
      const roleConfig = USER_ROLES[roleValue as keyof typeof USER_ROLES]
      if (!roleConfig) return null
      return (
        <div className='flex items-center gap-x-2'>
          {roleConfig.icon && (
            <roleConfig.icon size={16} className='text-muted-foreground' />
          )}
          <span className='text-sm'>{t(roleConfig.labelKey)}</span>
        </div>
      )
    },
    enableSorting: false,
    size: 120,
  }
}

export function userStatusColumn<T extends UserColumnRow>(
  t: (key: string) => string,
  opts?: { showRequestCount?: boolean; requestCountAccessor?: keyof T }
): ColumnDef<T> {
  return {
    accessorKey: 'status',
    header: t('Status'),
    cell: ({ row }) => {
      const user = row.original
      const deleted = user.DeletedAt != null
      const statusConfig = deleted
        ? USER_STATUSES[-1 as keyof typeof USER_STATUSES]
        : USER_STATUSES[user.status as keyof typeof USER_STATUSES]
      if (!statusConfig) return null

      if (opts?.showRequestCount) {
        const count =
          ((opts.requestCountAccessor
            ? (user as Record<string, unknown>)[
                opts.requestCountAccessor as string
              ]
            : user.request_count) as number) ?? 0
        return (
          <Tooltip>
            <TooltipTrigger render={<div className='-ml-1.5 cursor-help' />}>
              <StatusBadge
                label={t(statusConfig.labelKey)}
                variant={statusConfig.variant}
                copyable={false}
              />
            </TooltipTrigger>
            <TooltipContent>
              <p className='text-xs'>
                {t('Requests:')} {count.toLocaleString()}
              </p>
            </TooltipContent>
          </Tooltip>
        )
      }

      return (
        <StatusBadge
          label={t(statusConfig.labelKey)}
          variant={statusConfig.variant}
          copyable={false}
        />
      )
    },
    enableSorting: false,
    size: 120,
    meta: { mobileBadge: true },
  }
}

export function userGroupColumn<T extends UserColumnRow>(
  t: (key: string) => string,
  opts?: { withBadgeCell?: boolean }
): ColumnDef<T> {
  return {
    accessorKey: 'group',
    header: t('Group'),
    cell: ({ row }) => {
      const group = row.original.group
      if (opts?.withBadgeCell) {
        return (
          <BadgeCell>
            <GroupBadge group={group} />
          </BadgeCell>
        )
      }
      return <GroupBadge group={group} />
    },
    size: opts?.withBadgeCell ? 140 : 100,
    meta: { mobileHidden: true },
  }
}

// ============================================================================
// Shared User Columns Hook
// ============================================================================

export interface SharedUserColumnsOptions {
  costAccessor: string
  tokensAccessor: string
  requestsAccessor: string
  modelAccessor: string
  requestCountAccessor: string
  quotaHeaderDescription?: string
  withGroupBadgeCell?: boolean
}

export function useSharedUserColumns<T extends UserColumnRow>(
  opts: SharedUserColumnsOptions
): ColumnDef<T>[] {
  const { t } = useTranslation()
  const demoMode = useDemoMode()
  const externalMode = useExternalMode()

  return useMemo(() => {
    const columns: ColumnDef<T>[] = [
      userIdColumn<T>(t),
      userNameColumn<T>(t, demoMode),
      userQuotaColumn<T>(t, {
        headerDescription: opts.quotaHeaderDescription,
      }),
      userTokensColumn<T>(t, { accessor: opts.tokensAccessor }),
      userCostColumn<T>(t, { accessor: opts.costAccessor }),
      userAveragePriceColumn<T>(t, {
        costAccessor: opts.costAccessor,
        tokensAccessor: opts.tokensAccessor,
      }),
      userRequestsColumn<T>(t, { accessor: opts.requestsAccessor }),
    ]

    if (!externalMode) {
      columns.push(userDepartmentColumn<T>(t))
      columns.push(userJobLevelColumn<T>(t))
    }

    columns.push(userLastLoginColumn<T>(t))
    columns.push(
      userModelColumn<T>(t, { accessor: opts.modelAccessor, variant: 'badge' })
    )

    if (!externalMode) {
      columns.push(userJoinDateColumn<T>(t))
    }

    columns.push(userCreatedAtColumn<T>(t))
    columns.push({
      ...userRoleColumn<T>(t),
      filterFn: (
        row: { getValue: (id: string) => unknown },
        id: string,
        value: string[]
      ) => {
        return value.includes(String(row.getValue(id)))
      },
    })
    columns.push({
      ...userStatusColumn<T>(t, {
        showRequestCount: true,
        requestCountAccessor: opts.requestCountAccessor as keyof T,
      }),
      filterFn: (
        row: { getValue: (id: string) => unknown },
        id: string,
        value: string[]
      ) => {
        return value.includes(String(row.getValue(id)))
      },
    })
    columns.push({
      ...userGroupColumn<T>(t, {
        withBadgeCell: opts.withGroupBadgeCell ?? true,
      }),
      filterFn: (
        row: { getValue: (id: string) => unknown },
        id: string,
        value: string
      ) => {
        const group = String(row.getValue(id) || t('User Group')).toLowerCase()
        const searchValue = String(value).toLowerCase()
        return group.includes(searchValue)
      },
    })

    return columns
  }, [
    t,
    demoMode,
    externalMode,
    opts.costAccessor,
    opts.tokensAccessor,
    opts.requestsAccessor,
    opts.modelAccessor,
    opts.requestCountAccessor,
    opts.quotaHeaderDescription,
    opts.withGroupBadgeCell,
  ])
}
