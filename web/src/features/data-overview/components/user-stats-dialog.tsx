import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { useState, useMemo, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { CompactDateTimeRangePicker } from '@/features/usage-logs/components/compact-date-time-range-picker'
import { LogUserIdentity } from '@/features/usage-logs/components/log-user-identity'

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

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className='flex h-[85vh] max-h-[85vh] w-[min(1360px,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] flex-col overflow-hidden sm:max-w-[calc(100vw-2rem)]'>
        <DialogHeader className='shrink-0'>
          <DialogTitle>{t('User Statistics')}</DialogTitle>
        </DialogHeader>

        <div className='flex shrink-0 flex-wrap items-center gap-3 py-1.5'>
          <LogUserIdentity
            userId={props.user.id}
            username={props.user.username}
            displayName={props.user.display_name}
            avatarUrl={props.user.avatar_url}
            openId={props.user.open_id}
            gender={props.user.gender}
          />

          <CompactDateTimeRangePicker
            start={dateRange.start}
            end={dateRange.end}
            onChange={setDateRange}
            className='w-full shrink-0 sm:w-auto'
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
