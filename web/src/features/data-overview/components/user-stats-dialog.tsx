import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { useState, useMemo, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { CompactDateTimeRangePicker } from '@/features/usage-logs/components/compact-date-time-range-picker'
import { UserProfileHoverCard } from '@/features/users/components/user-profile-hover-card'
import type { UserColumnRow } from '@/features/users/types'
import { getUserAvatarFallback, getUserAvatarStyle } from '@/lib/avatar'

import { getUserUsageAnalysis } from '../api'
import type { DepartmentUser } from '../types'
import { UsageAnalysisSection } from './usage-analysis'
import { UserLogsSection } from './user-logs-section'

interface UserStatsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  companyId?: number
  departmentId?: string
  user: DepartmentUser | null
  initialStartTimestamp: number
  initialEndTimestamp: number
}

function getDateRangeFromTimestamps(
  startTimestamp: number,
  endTimestamp: number
): { start?: Date; end?: Date } {
  return {
    start:
      startTimestamp > 0
        ? new Date(startTimestamp * 1000)
        : dayjs().startOf('month').toDate(),
    end:
      endTimestamp > 0
        ? new Date(endTimestamp * 1000)
        : dayjs().endOf('month').toDate(),
  }
}

export function UserStatsDialog(props: UserStatsDialogProps) {
  const { t } = useTranslation()

  const [dateRange, setDateRange] = useState<{ start?: Date; end?: Date }>(() =>
    getDateRangeFromTimestamps(
      props.initialStartTimestamp,
      props.initialEndTimestamp
    )
  )

  useEffect(() => {
    if (!props.open || !props.user) return
    setDateRange(
      getDateRangeFromTimestamps(
        props.initialStartTimestamp,
        props.initialEndTimestamp
      )
    )
  }, [
    props.open,
    props.user,
    props.initialStartTimestamp,
    props.initialEndTimestamp,
  ])

  const startTimestamp = useMemo(
    () => Math.floor((dateRange.start?.getTime() ?? 0) / 1000),
    [dateRange.start]
  )
  const endTimestamp = useMemo(
    () => Math.floor((dateRange.end?.getTime() ?? 0) / 1000),
    [dateRange.end]
  )

  const userId = props.user?.id
  const companyId = props.companyId ?? 0
  const departmentId = props.departmentId ?? ''

  const { data: analysisData } = useQuery({
    queryKey: [
      'user-usage-analysis',
      companyId,
      departmentId,
      userId,
      startTimestamp,
      endTimestamp,
    ],
    queryFn: () => {
      if (!userId) throw new Error('Missing user id')
      return getUserUsageAnalysis({
        company_id: companyId,
        department_id: departmentId,
        user_id: userId,
        start_timestamp: startTimestamp,
        end_timestamp: endTimestamp,
      })
    },
    enabled: props.open && !!userId && startTimestamp > 0,
    staleTime: 60 * 1000,
  })

  if (!props.user) return null

  const displayName = props.user.display_name || props.user.username
  const shouldShowUsername =
    Boolean(props.user.username) && props.user.username !== displayName
  const avatarFallback = getUserAvatarFallback(displayName)
  const avatarFallbackStyle = getUserAvatarStyle(displayName)

  const userColumnRow: UserColumnRow = {
    id: props.user.id,
    username: props.user.username,
    display_name: props.user.display_name,
    email: props.user.email,
    avatar_url: props.user.avatar_url,
    remark: props.user.remark,
    quota: props.user.quota,
    used_quota: props.user.used_quota,
    has_active_subscription: props.user.has_active_subscription,
    sub_quota_used: props.user.sub_quota_used ?? 0,
    sub_quota_total: props.user.sub_quota_total ?? 0,
    request_count: props.user.request_count,
    group: props.user.group,
    status: props.user.status,
    role: props.user.role,
    created_at: props.user.created_at,
    last_login_at: props.user.last_login_at,
    DeletedAt: props.user.DeletedAt,
    department_name: props.user.department_name,
    custom_field_values: props.user.custom_field_values,
    join_date: props.user.join_date,
    job_number: props.user.job_number,
    job_title: props.user.job_title,
    description: props.user.description,
    background_image: props.user.background_image,
    mobile: props.user.mobile,
    open_id: props.user.open_id,
    gender: props.user.gender,
  }

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className='flex h-[85vh] max-h-[85vh] w-[min(1360px,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] flex-col overflow-hidden sm:max-w-[calc(100vw-2rem)]'>
        <DialogHeader className='shrink-0'>
          <DialogTitle>{t('User Statistics')}</DialogTitle>
        </DialogHeader>

        <div className='shrink-0 border-b pb-3'>
          <div className='flex items-start gap-3'>
            <UserProfileHoverCard user={userColumnRow}>
              <Avatar className='size-9 shrink-0'>
                {props.user.avatar_url && (
                  <AvatarImage src={props.user.avatar_url} alt={displayName} />
                )}
                <AvatarFallback
                  className='text-sm font-semibold text-white'
                  style={avatarFallbackStyle}
                >
                  {avatarFallback}
                </AvatarFallback>
              </Avatar>
            </UserProfileHoverCard>
            <div className='flex min-w-0 flex-1 flex-col'>
              <span className='truncate text-sm font-medium'>
                {displayName}
              </span>
              {shouldShowUsername && (
                <span className='text-muted-foreground truncate text-xs'>
                  {props.user.username}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className='shrink-0 pt-2 pr-1'>
          <CompactDateTimeRangePicker
            start={dateRange.start}
            end={dateRange.end}
            onChange={setDateRange}
            className='max-w-none'
          />
        </div>

        <div className='min-h-0 space-y-6 overflow-y-auto pr-1'>
          <UserLogsSection
            companyId={companyId}
            departmentId={departmentId}
            userId={props.user.id}
            startTimestamp={startTimestamp}
            endTimestamp={endTimestamp}
          />

          {analysisData?.data && (
            <UsageAnalysisSection data={analysisData.data} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
