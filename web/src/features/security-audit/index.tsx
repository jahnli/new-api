import { useQuery } from '@tanstack/react-query'
import { getRouteApi, useNavigate } from '@tanstack/react-router'
import { RotateCcw, Search, ShieldOff } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useTranslation } from 'react-i18next'

import { EmptyState } from '@/components/empty-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CompactDateTimeRangePicker } from '@/features/usage-logs/components/compact-date-time-range-picker'
import dayjs from '@/lib/dayjs'

import { getSecurityAuditSetting } from './api'
import { ImageAuditTable } from './components/image-audit-table'
import { OffHoursTable } from './components/off-hours-table'
import type { SecurityAuditSectionId } from './section-registry'

const route = getRouteApi('/_authenticated/usage-logs/audit')

function formatHour(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`
}

function getDefaultTimeRange(): {
  startTime: dayjs.Dayjs
  endTime: dayjs.Dayjs
} {
  return {
    startTime: dayjs().startOf('month'),
    endTime: dayjs().endOf('month'),
  }
}

export function SecurityAudit(props: { section: SecurityAuditSectionId }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const search = route.useSearch()
  const activeSection = props.section
  const isOffHoursSection = activeSection === 'off-hours'

  const settingQuery = useQuery({
    queryKey: ['security-audit', 'setting'],
    queryFn: getSecurityAuditSetting,
    staleTime: 60 * 1000,
  })
  const auditSetting = settingQuery.data?.data
  const imageStudioEnabled = auditSetting?.image_studio !== false
  const offHoursEnabled = auditSetting?.off_hours.enabled !== false
  const defaultTimeRange = useMemo(() => getDefaultTimeRange(), [])
  const startTimestamp = search.startTime ?? defaultTimeRange.startTime.unix()
  const endTimestamp = search.endTime ?? defaultTimeRange.endTime.unix()

  const [startTimeInput, setStartTimeInput] = useState(
    () => new Date(startTimestamp * 1000)
  )
  const [endTimeInput, setEndTimeInput] = useState(
    () => new Date(endTimestamp * 1000)
  )
  const [usernameInput, setUsernameInput] = useState(search.username ?? '')

  useEffect(() => {
    setStartTimeInput(new Date(startTimestamp * 1000))
    setEndTimeInput(new Date(endTimestamp * 1000))
  }, [startTimestamp, endTimestamp])

  useEffect(() => {
    setUsernameInput(search.username ?? '')
  }, [search.username])

  const handleRangeChange = useCallback(
    (range: { start?: Date; end?: Date }) => {
      if (range.start) setStartTimeInput(range.start)
      if (range.end) setEndTimeInput(range.end)
    },
    []
  )

  const applyFilters = useCallback(() => {
    void navigate({
      to: '/usage-logs/audit',
      search: (previousSearch: Record<string, unknown>) => ({
        ...previousSearch,
        startTime: dayjs(startTimeInput).unix(),
        endTime: dayjs(endTimeInput).unix(),
        username: usernameInput.trim() || undefined,
        offHoursPage: undefined,
        offHoursPageSize: undefined,
        imageAuditPage: undefined,
        imageAuditPageSize: undefined,
      }),
    })
  }, [navigate, startTimeInput, endTimeInput, usernameInput])

  const resetFilters = useCallback(() => {
    const defaultTimeRange = getDefaultTimeRange()
    setStartTimeInput(defaultTimeRange.startTime.toDate())
    setEndTimeInput(defaultTimeRange.endTime.toDate())
    setUsernameInput('')
    void navigate({
      to: '/usage-logs/audit',
      search: (previousSearch: Record<string, unknown>) => ({
        ...previousSearch,
        startTime: undefined,
        endTime: undefined,
        username: undefined,
        offHoursPage: undefined,
        offHoursPageSize: undefined,
        imageAuditPage: undefined,
        imageAuditPageSize: undefined,
      }),
    })
  }, [navigate])

  const auditDisabled =
    !settingQuery.isLoading &&
    !(isOffHoursSection ? offHoursEnabled : imageStudioEnabled)

  let sectionContent: ReactNode = null
  if (auditDisabled) {
    sectionContent = (
      <EmptyState
        icon={ShieldOff}
        title={t('This audit is disabled')}
        description={t(
          'Enable this audit in System Settings → Security & Limits → Security Audit.'
        )}
        className='min-h-0 flex-1'
      />
    )
  } else if (isOffHoursSection) {
    if (!settingQuery.isLoading && offHoursEnabled) {
      sectionContent = (
        <div className='min-h-0 flex-1'>
          <OffHoursTable
            startTimestamp={startTimestamp}
            endTimestamp={endTimestamp}
            username={search.username ?? ''}
            enabled
          />
        </div>
      )
    }
  } else if (!settingQuery.isLoading && imageStudioEnabled) {
    sectionContent = (
      <div className='min-h-0 flex-1'>
        <ImageAuditTable
          startTimestamp={startTimestamp}
          endTimestamp={endTimestamp}
          username={search.username ?? ''}
        />
      </div>
    )
  }

  return (
    <div className='flex min-h-0 flex-1 flex-col gap-4'>
      {!auditDisabled && (
        <div className='flex flex-wrap items-center gap-2'>
          <CompactDateTimeRangePicker
            start={startTimeInput}
            end={endTimeInput}
            onChange={handleRangeChange}
            className='w-[320px] max-w-full'
          />
          <Input
            value={usernameInput}
            onChange={(event) => setUsernameInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') applyFilters()
            }}
            placeholder={t('Search username')}
            className='h-8 w-[180px]'
          />
          <Button type='button' variant='outline' onClick={resetFilters}>
            <RotateCcw className='size-4' />
            {t('Reset')}
          </Button>
          <Button type='button' onClick={applyFilters}>
            <Search className='size-4' />
            {t('Search')}
          </Button>
          {isOffHoursSection && auditSetting && (
            <span className='text-muted-foreground ml-2 text-sm'>
              {t('Audit window')}:{' '}
              {formatHour(auditSetting.off_hours.start_hour)} -{' '}
              {formatHour(auditSetting.off_hours.end_hour)}
            </span>
          )}
        </div>
      )}
      {sectionContent}
    </div>
  )
}
