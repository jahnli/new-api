/* eslint-disable react-refresh/only-export-components */
import type { ColumnDef, Row } from '@tanstack/react-table'
import {
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Eye,
  Globe,
} from 'lucide-react'
import { useCallback, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { BadgeListCell } from '@/components/data-table/core/badge-list-cell'
import { LongText } from '@/components/long-text'
import { StatusBadge } from '@/components/status-badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { getUserInfo } from '@/features/usage-logs/api'
import { ModelBadge } from '@/features/usage-logs/components/model-badge'
import { UserProfileHoverCard } from '@/features/users/components/user-profile-hover-card'
import type { UserColumnRow } from '@/features/users/types'
import { useDemoMode } from '@/hooks/use-demo-mode'
import { getUserAvatarFallback, getUserAvatarStyle } from '@/lib/avatar'
import { formatQuotaWithCurrency } from '@/lib/currency'
import dayjs from '@/lib/dayjs'
import { getDemoModeUsername } from '@/lib/demo-mode'

import type { AuditRow, OffHoursDetailTarget } from '../types'

function formatClock(timestamp: number): string {
  return dayjs.unix(timestamp).format('HH:mm:ss')
}

function renderModelBadges(models: string[]) {
  return (
    <BadgeListCell
      max={3}
      items={models.map((model) => (
        <ModelBadge key={model} modelName={model} className='font-normal' />
      ))}
    />
  )
}

function renderIpBadges(ipAddresses: string[]) {
  return (
    <BadgeListCell
      items={ipAddresses.map((ipAddress) => (
        <StatusBadge
          key={ipAddress}
          label={ipAddress}
          icon={Globe}
          copyText={ipAddress}
          size='sm'
          showDot={false}
          className='border-border/60 bg-muted/30 text-foreground h-6 max-w-full gap-1.5 overflow-hidden rounded-md border px-2 py-0.5 font-mono'
        />
      ))}
    />
  )
}

export function OffHoursIdentityCell(props: {
  row: Row<AuditRow>
  demoMode: boolean
}) {
  const { t } = useTranslation()
  const audit = props.row.original
  const [userData, setUserData] = useState<UserColumnRow | null>(null)
  const fetchedUserId = useRef<number | null>(null)

  const handleFetchUser = useCallback(() => {
    if (
      props.demoMode ||
      audit.kind !== 'user' ||
      fetchedUserId.current === audit.user.user_id
    ) {
      return
    }

    fetchedUserId.current = audit.user.user_id
    void getUserInfo(audit.user.user_id).then((response) => {
      if (!response.success || !response.data) return

      const userInfo = response.data
      setUserData({
        id: userInfo.id,
        username: userInfo.username,
        display_name: userInfo.display_name || userInfo.username,
        email: userInfo.email,
        avatar_url: userInfo.avatar_url,
        remark: userInfo.remark,
        quota: userInfo.quota,
        used_quota: userInfo.used_quota,
        sub_quota_used: 0,
        sub_quota_total: 0,
        request_count: userInfo.request_count,
        group: userInfo.group || '',
        status: userInfo.status ?? 1,
        role: userInfo.role ?? 1,
        department_name: userInfo.department_name,
        custom_field_values: userInfo.custom_field_values,
        join_date: userInfo.join_date,
        job_number: userInfo.job_number,
        job_title: userInfo.job_title,
        description: userInfo.description,
        background_image: userInfo.background_image,
        mobile: userInfo.mobile,
        open_id: userInfo.open_id,
        gender: userInfo.gender,
      })
    })
  }, [audit, props.demoMode])

  if (audit.kind !== 'user') {
    return (
      <div className='flex items-center gap-2 pl-8'>
        <CalendarDays className='text-muted-foreground size-3.5 shrink-0' />
        <span className='tabular-nums'>{audit.day?.date}</span>
      </div>
    )
  }

  const hasMultipleDays = (audit.user.day_rows?.length ?? 0) > 1
  const primaryName = getDemoModeUsername(
    audit.user.display_name || audit.user.username,
    props.demoMode
  )
  const avatarFallback = getUserAvatarFallback(primaryName)
  const avatarFallbackStyle = getUserAvatarStyle(primaryName)
  const hasDistinctUsername =
    audit.user.display_name && audit.user.display_name !== audit.user.username
  const fallbackUser: UserColumnRow = {
    id: audit.user.user_id,
    username: audit.user.username,
    display_name: primaryName,
    avatar_url: audit.user.avatar_url || undefined,
    quota: 0,
    used_quota: 0,
    sub_quota_used: 0,
    sub_quota_total: 0,
    request_count: audit.user.count,
    group: '',
    status: 1,
    role: 1,
  }

  const avatar = (
    <Avatar size='sm' className='shrink-0'>
      {audit.user.avatar_url ? (
        <AvatarImage src={audit.user.avatar_url} alt={primaryName} />
      ) : null}
      <AvatarFallback
        className='text-xs font-medium text-white'
        style={avatarFallbackStyle}
      >
        {avatarFallback}
      </AvatarFallback>
    </Avatar>
  )

  return (
    <div
      className='flex min-w-0 items-center gap-2'
      onMouseEnter={props.demoMode ? undefined : handleFetchUser}
    >
      <div className='flex size-6 shrink-0 items-center justify-center'>
        {hasMultipleDays ? (
          <Button
            variant='ghost'
            size='sm'
            className='size-6 p-0'
            onClick={props.row.getToggleExpandedHandler()}
            aria-label={props.row.getIsExpanded() ? t('Collapse') : t('Expand')}
            aria-expanded={props.row.getIsExpanded()}
          >
            {props.row.getIsExpanded() ? (
              <ChevronDown className='h-4 w-4' />
            ) : (
              <ChevronRight className='h-4 w-4' />
            )}
          </Button>
        ) : null}
      </div>
      {props.demoMode ? (
        <LongText className='w-[182px] font-medium'>{primaryName}</LongText>
      ) : (
        <>
          <UserProfileHoverCard user={userData ?? fallbackUser}>
            {avatar}
          </UserProfileHoverCard>
          <div className='flex w-[150px] min-w-0 flex-col gap-1'>
            <LongText className='max-w-full font-medium'>
              {primaryName}
            </LongText>
            {hasDistinctUsername ? (
              <LongText className='text-muted-foreground/70 max-w-full !text-[13px]'>
                {audit.user.username}
              </LongText>
            ) : null}
          </div>
        </>
      )}
      <StatusBadge
        label={`${audit.user.days} ${t('days')}`}
        variant='red'
        size='sm'
        copyable={false}
        className='border-destructive/30 bg-destructive/10 h-5 shrink-0 rounded-md border px-1.5 !text-[11px] [&_span]:!text-[11px]'
      />
    </div>
  )
}

export function useOffHoursColumns(
  onViewDetail: (target: OffHoursDetailTarget) => void
): ColumnDef<AuditRow>[] {
  const { t } = useTranslation()
  const demoMode = useDemoMode()

  return useMemo<ColumnDef<AuditRow>[]>(
    () => [
      {
        id: 'identity',
        header: t('User'),
        meta: { mobileTitle: true },
        size: 220,
        cell: ({ row }) => (
          <OffHoursIdentityCell row={row} demoMode={demoMode} />
        ),
      },
      {
        id: 'time_range',
        header: t('Time Range'),
        size: 150,
        cell: ({ row }) => {
          const audit = row.original
          const singleDay =
            audit.kind === 'user' && audit.user.day_rows?.length === 1
              ? audit.user.day_rows[0]
              : undefined
          const displayedDay = audit.kind === 'day' ? audit.day : singleDay
          if (!displayedDay) {
            return <span className='text-muted-foreground text-xs'>-</span>
          }
          return (
            <div className='flex flex-col gap-0.5 text-sm tabular-nums'>
              {singleDay ? (
                <span className='text-muted-foreground text-xs'>
                  {displayedDay.date}
                </span>
              ) : null}
              <span>
                {formatClock(displayedDay.start_time)} ~{' '}
                {formatClock(displayedDay.end_time)}
              </span>
            </div>
          )
        },
      },
      {
        id: 'count',
        header: t('Requests'),
        size: 80,
        cell: ({ row }) => {
          const audit = row.original
          const count =
            audit.kind === 'day' ? (audit.day?.count ?? 0) : audit.user.count
          return (
            <span className='text-sm font-medium tabular-nums'>
              {count.toLocaleString()}
            </span>
          )
        },
      },
      {
        id: 'quota',
        header: t('Cost'),
        size: 115,
        cell: ({ row }) => {
          const audit = row.original
          const quota =
            audit.kind === 'day' ? (audit.day?.quota ?? 0) : audit.user.quota
          return (
            <span className='border-border/80 bg-muted/60 inline-flex h-6 w-fit items-center rounded-md border px-2 text-sm leading-none font-normal tabular-nums'>
              {formatQuotaWithCurrency(quota, {
                digitsLarge: 2,
                digitsSmall: 2,
                abbreviate: false,
              })}
            </span>
          )
        },
      },
      {
        id: 'models',
        header: t('Models'),
        size: 300,
        cell: ({ row }) => {
          const audit = row.original
          const models =
            audit.kind === 'day' ? (audit.day?.models ?? []) : audit.user.models
          return renderModelBadges(models)
        },
      },
      {
        id: 'ips',
        header: t('IP Addresses'),
        size: 200,
        cell: ({ row }) => {
          const audit = row.original
          const ips =
            audit.kind === 'day' ? (audit.day?.ips ?? []) : audit.user.ips
          return renderIpBadges(ips)
        },
      },
      {
        id: 'actions',
        header: '',
        size: 120,
        cell: ({ row }) => {
          const audit = row.original
          const singleDay =
            audit.kind === 'user' && audit.user.day_rows?.length === 1
              ? audit.user.day_rows[0]
              : undefined
          const displayedDay = audit.kind === 'day' ? audit.day : singleDay
          if (!displayedDay) return null
          return (
            <Button
              variant='ghost'
              size='sm'
              className='h-7 gap-1.5 px-2 text-xs'
              onClick={() =>
                onViewDetail({
                  userId: audit.user.user_id,
                  username: audit.user.username,
                  displayName: audit.user.display_name || audit.user.username,
                  date: displayedDay.date,
                  windowStart: displayedDay.window_start,
                  windowEnd: displayedDay.window_end,
                  requestStart: displayedDay.start_time,
                  requestEnd: displayedDay.end_time,
                  requestCount: displayedDay.count,
                })
              }
            >
              <Eye className='size-3.5' />
              {t('Logs')}
            </Button>
          )
        },
      },
    ],
    [demoMode, onViewDetail, t]
  )
}
