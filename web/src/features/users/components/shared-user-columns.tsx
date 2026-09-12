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
  Calendar03Icon,
  Login03Icon,
  UserAdd01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import type { ColumnDef } from '@tanstack/react-table'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { ActivityTimeCell } from '@/components/activity-time-cell'
import { BadgeCell, DataTableColumnHeader } from '@/components/data-table'
import { GroupBadge } from '@/components/group-badge'
import { LongText } from '@/components/long-text'
import { StatusBadge } from '@/components/status-badge'
import { TableId } from '@/components/table-id'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
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

/** Exact request count, used for tooltip detail where the 万 suffix loses precision. */
export function formatUserRequestsDetail(requests: number | undefined): string {
  const value = requests ?? 0
  if (value <= 0) return '-'
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
  demoMode: boolean,
  opts?: { usernameClassName?: string }
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
          <LongText className='w-[130px] font-normal'>{primaryName}</LongText>
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
            <LongText className='max-w-full font-normal'>
              {primaryName}
            </LongText>
            {(displayName && displayName !== username) || remark ? (
              <div className='text-muted-foreground flex min-w-0 items-center gap-1.5 text-xs'>
                {displayName && displayName !== username ? (
                  <LongText
                    className={cn('min-w-0 flex-1', opts?.usernameClassName)}
                  >
                    {username}
                  </LongText>
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
    size: 140,
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
              <div className='w-full max-w-full min-w-0 cursor-help space-y-1.5 overflow-hidden pe-3' />
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
    size: opts?.width ? opts.width + 20 : 205,
    meta: { description: headerDescription },
  }
}

/**
 * Single column for monthly/range consumption: token usage, cost, request count,
 * and the unit price per 100M tokens. The four metrics share one cell to save
 * horizontal space, and the header still exposes every original sort field via
 * `meta.sortFields`.
 */
export function userConsumptionColumn<T extends UserColumnRow>(
  t: (key: string) => string,
  opts: {
    costAccessor: string
    tokensAccessor: string
    requestsAccessor: string
  }
): ColumnDef<T> {
  return {
    id: 'consumption',
    header: t('Consumption'),
    cell: ({ row }) => {
      const source = row.original as Record<string, unknown>
      const cost = Number(source[opts.costAccessor] ?? 0)
      const tokens = Number(source[opts.tokensAccessor] ?? 0)
      const requests = Number(source[opts.requestsAccessor] ?? 0)
      const hasCost = Number.isFinite(cost) && cost > 0
      const hasTokens = Number.isFinite(tokens) && tokens > 0
      const hasRequests = Number.isFinite(requests) && requests > 0

      if (!hasCost && !hasTokens && !hasRequests) {
        return <span className='text-muted-foreground text-sm'>-</span>
      }

      const formattedCost = formatAmountCny(cost)
      const formattedTokens = formatUserTokens(tokens)
      // 合并列里同时出现 Token 的「亿」与请求次数的「万」，给请求次数补上量词
      // 「次」才能与 Token 区分开。
      const formattedRequests = hasRequests
        ? `${formatUserRequests(requests)} ${t('times')}`
        : formatUserRequests(requests)
      const unitPrice =
        hasCost && hasTokens ? calculateUnitPricePer100MTokens(cost, tokens) : 0
      const formattedUnitPrice =
        unitPrice > 0 ? `${formatAmountCny(unitPrice)} / ${t('100M')}` : '-'

      return (
        <Tooltip>
          <TooltipTrigger
            render={
              <div className='w-full min-w-0 cursor-help space-y-0.5 overflow-hidden px-2' />
            }
          >
            <div className='flex min-w-0 items-baseline justify-between gap-x-2.5'>
              <span className='sr-only'>{t('Tokens')}:</span>
              <span className='min-w-0 truncate text-sm font-medium tabular-nums'>
                {formattedTokens}
              </span>
              <span className='sr-only'>{t('Cost')}:</span>
              <span className='min-w-0 truncate text-sm font-medium tabular-nums'>
                {formattedCost}
              </span>
            </div>
            <div className='text-muted-foreground/70 flex min-w-0 items-baseline justify-between gap-x-2.5 !text-[13px] tabular-nums'>
              <span className='sr-only'>{t('Request Count')}:</span>
              <span className='min-w-0 truncate'>{formattedRequests}</span>
              <span className='sr-only'>{t('Unit Price / 100M Tokens')}:</span>
              <span className='min-w-0 truncate'>{formattedUnitPrice}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <div className='space-y-1 text-xs'>
              <div>
                {t('Tokens')}: {formatUserTokensDetail(tokens)}
              </div>
              <div>
                {t('Cost')}: {formattedCost}
              </div>
              <div>
                {t('Request Count')}: {formatUserRequestsDetail(requests)}
              </div>
              <div>
                {t('Unit Price / 100M Tokens')}: {formattedUnitPrice}
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      )
    },
    minSize: 205,
    size: 225,
    meta: {
      label: t('Consumption'),
      description: t('Tokens, cost, requests, and unit price per 100M tokens'),
      mobileHidden: true,
      // The cell content is inset by `px-2`; mirror it on the title so the
      // header text lines up with the two metric rows below it.
      headerClassName: 'px-2',
      sortFields: [
        { id: opts.tokensAccessor, label: t('Tokens') },
        { id: opts.costAccessor, label: t('Cost') },
        { id: opts.requestsAccessor, label: t('Request Count') },
        { id: 'average_price', label: t('Unit Price / 100M Tokens') },
      ],
    },
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
        return <ModelBadge modelName={modelName} className='font-normal' />
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
    // Model badges are short (~90px); the previous width left a wide empty
    // strip to the right of this column. The released share is redistributed
    // to the columns on its left, moving their boundaries rightwards.
    size: 130,
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
        <span className='text-muted-foreground !text-[13px]'>
          {level || '-'}
        </span>
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
        <span className='text-muted-foreground !text-[13px]'>
          {date || '-'}
        </span>
      )
    },
    size: 120,
    meta: { mobileHidden: true },
  }
}

export function userEmploymentOverviewColumn<T extends UserColumnRow>(
  t: (key: string) => string
): ColumnDef<T> {
  return {
    id: 'employment_overview',
    header: t('Employment Overview'),
    cell: ({ row }) => {
      const department = row.original.department_name
      const customFields = parseCustomFields(row.original.custom_field_values)
      const jobLevel = customFields?.[CUSTOM_FIELD_KEYS.JOB_LEVEL]
      const joinDate = row.original.join_date

      return (
        <div
          data-table-text='secondary'
          className='w-[280px] max-w-[280px] space-y-1.5 overflow-hidden px-2 font-normal'
        >
          <div className='w-full min-w-0 overflow-hidden'>
            <span className='sr-only'>{t('Department')}:</span>
            {department ? (
              <LongText className='text-foreground w-full min-w-0 !text-[14px] font-normal'>
                {department}
              </LongText>
            ) : (
              <span className='text-muted-foreground text-sm'>-</span>
            )}
          </div>
          {jobLevel || joinDate ? (
            <div className='flex w-full min-w-0 items-center gap-1.5 overflow-hidden'>
              <div className='w-[88px] shrink-0 overflow-hidden'>
                {jobLevel ? (
                  <Badge variant='secondary' className='max-w-full font-normal'>
                    <span className='sr-only'>{t('Job Level')}:</span>
                    <span className='truncate !text-[13px]'>{jobLevel}</span>
                  </Badge>
                ) : null}
              </div>
              {joinDate ? (
                <Badge
                  variant='outline'
                  className='text-muted-foreground min-w-0 font-normal'
                >
                  <HugeiconsIcon
                    icon={Calendar03Icon}
                    size={13}
                    strokeWidth={1.8}
                    aria-hidden='true'
                  />
                  <span className='sr-only'>{t('Join Date')}:</span>
                  <span className='truncate !text-[13px] tabular-nums'>
                    {joinDate}
                  </span>
                </Badge>
              ) : null}
            </div>
          ) : null}
        </div>
      )
    },
    size: 200,
    minSize: 180,
    meta: {
      mobileHidden: true,
      // Match the `px-2` inset on the cell so the title aligns with the
      // department row below it.
      headerClassName: 'px-2',
    },
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

export function userActivityTimeColumn<T extends UserColumnRow>(
  t: (key: string) => string
): ColumnDef<T> {
  return {
    accessorKey: 'created_at',
    header: t('Time'),
    cell: ({ row }) => (
      <ActivityTimeCell
        createdAt={row.original.created_at ?? 0}
        lastAt={row.original.last_login_at ?? 0}
        lastLabel={t('Last Login')}
        createdLabelIcon={
          <HugeiconsIcon
            icon={UserAdd01Icon}
            size={16}
            strokeWidth={1.8}
            aria-hidden='true'
          />
        }
        lastLabelIcon={
          <HugeiconsIcon
            icon={Login03Icon}
            size={16}
            strokeWidth={1.8}
            aria-hidden='true'
          />
        }
        format='absolute'
        order='last-first'
        textClassName='!text-[14px]'
      />
    ),
    size: 260,
    minSize: 240,
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
    size: 92,
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
  usernameClassName?: string
  withGroupBadgeCell?: boolean
  combineActivityTimes?: boolean
  combineEmploymentOverview?: boolean
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
      userNameColumn<T>(t, demoMode, {
        usernameClassName: opts.usernameClassName,
      }),
      userQuotaColumn<T>(t, {
        headerDescription: opts.quotaHeaderDescription,
      }),
      userConsumptionColumn<T>(t, {
        costAccessor: opts.costAccessor,
        tokensAccessor: opts.tokensAccessor,
        requestsAccessor: opts.requestsAccessor,
      }),
    ]

    if (!externalMode) {
      if (opts.combineEmploymentOverview) {
        columns.push(userEmploymentOverviewColumn<T>(t))
      } else {
        columns.push(userDepartmentColumn<T>(t))
        columns.push(userJobLevelColumn<T>(t))
      }
    }

    if (opts.combineActivityTimes) {
      columns.push(userActivityTimeColumn<T>(t))
    } else {
      columns.push(userLastLoginColumn<T>(t))
    }
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
    columns.push(
      userModelColumn<T>(t, { accessor: opts.modelAccessor, variant: 'badge' })
    )

    if (!externalMode && !opts.combineEmploymentOverview) {
      columns.push(userJoinDateColumn<T>(t))
    }

    if (!opts.combineActivityTimes) {
      columns.push(userCreatedAtColumn<T>(t))
    }
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
    opts.usernameClassName,
    opts.withGroupBadgeCell,
    opts.combineActivityTimes,
    opts.combineEmploymentOverview,
  ])
}
