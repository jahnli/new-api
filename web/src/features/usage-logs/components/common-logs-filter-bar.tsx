import { useQuery, useQueryClient, useIsFetching } from '@tanstack/react-query'
import { useNavigate, getRouteApi } from '@tanstack/react-router'
import type { Table } from '@tanstack/react-table'
import { Eye, EyeOff } from 'lucide-react'
import { useState, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Combobox } from '@/components/ui/combobox'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { getChannels } from '@/features/channels/api'
import { CHANNEL_STATUS } from '@/features/channels/constants'
import { channelsQueryKeys } from '@/features/channels/lib/channel-actions'
import { getUserModels } from '@/lib/api'
import { ROLE, getRoleLabelKey } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

import { LOG_TYPE_ALL_VALUE, LOG_TYPE_FILTERS } from '../constants'
import { buildSearchParams } from '../lib/filter'
import { getDefaultTimeRange } from '../lib/utils'
import type { CommonLogFilters } from '../types'
import { CommonLogsStats } from './common-logs-stats'
import { CompactDateTimeRangePicker } from './compact-date-time-range-picker'
import {
  LogsFilterField,
  LogsFilterInput,
  LogsFilterToolbar,
} from './logs-filter-toolbar'
import { useLogsViewScope, useUsageLogsContext } from './usage-logs-provider'

const route = getRouteApi('/_authenticated/usage-logs/$section')

type LogTypeValue = (typeof LOG_TYPE_FILTERS)[number]['value']
const logTypeValueSet = new Set<string>(
  LOG_TYPE_FILTERS.map((type) => type.value)
)

const USER_CATEGORY_ROLE_VALUES = [
  ROLE.GUEST,
  ROLE.USER,
  ROLE.BU_BP,
  ROLE.ADMIN,
] as const

type UserCategoryOption = {
  value: string
  label: string
}

function getUserCategoryFilterValue(
  value: string | undefined,
  options: UserCategoryOption[]
): string | undefined {
  const trimmedValue = value?.trim()
  if (!trimmedValue) return undefined

  const matchedOption = options.find((option) => option.label === trimmedValue)
  return matchedOption?.value ?? trimmedValue
}

type CommonLogDraft = {
  sourceKey: string
  filters: CommonLogFilters
  logType: LogTypeValue
}

function isLogTypeValue(value: string): value is LogTypeValue {
  return logTypeValueSet.has(value)
}

function getLogTypeValue(value: unknown): LogTypeValue {
  return Array.isArray(value) &&
    value.length === 1 &&
    typeof value[0] === 'string' &&
    isLogTypeValue(value[0])
    ? value[0]
    : LOG_TYPE_ALL_VALUE
}

function buildSearchSourceKey(values: {
  startTime?: unknown
  endTime?: unknown
  channel?: unknown
  model?: unknown
  group?: unknown
  username?: unknown
  requestId?: unknown
  upstreamRequestId?: unknown
  userCategory?: unknown
  type?: unknown
}) {
  return [
    values.startTime,
    values.endTime,
    values.channel,
    values.model,
    values.group,
    values.username,
    values.requestId,
    values.upstreamRequestId,
    values.userCategory,
    Array.isArray(values.type) ? values.type.join(',') : values.type,
  ]
    .map((value) => String(value ?? ''))
    .join('\u001f')
}

interface CommonLogsFilterBarProps<TData> {
  table: Table<TData>
}

export function CommonLogsFilterBar<TData>(
  props: CommonLogsFilterBarProps<TData>
) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const searchParams = route.useSearch()
  const {
    canManageScope,
    isAdminView: isAdmin,
    viewScope,
    setViewScope,
  } = useLogsViewScope()
  const currentUserRole = useAuthStore((state) => state.auth.user?.role)
  const isSuperAdmin = (currentUserRole ?? 0) >= ROLE.SUPER_ADMIN
  const { sensitiveVisible, setSensitiveVisible } = useUsageLogsContext()
  const fetchingLogs = useIsFetching({ queryKey: ['logs'] })
  const { data: availableChannels = [], isLoading: channelsLoading } = useQuery(
    {
      queryKey: channelsQueryKeys.list({ usageLogFilter: true }),
      enabled: isAdmin,
      staleTime: 60_000,
      queryFn: async () => {
        const firstPage = await getChannels({
          p: 1,
          page_size: 100,
          id_sort: true,
        })
        const firstPageChannels = firstPage.data?.items ?? []
        const totalChannels = firstPage.data?.total ?? firstPageChannels.length
        const totalPages = Math.ceil(totalChannels / 100)

        if (totalPages <= 1) return firstPageChannels

        const remainingResponses = await Promise.all(
          Array.from({ length: totalPages - 1 }, (_, pageIndex) =>
            getChannels({ p: pageIndex + 2, page_size: 100, id_sort: true })
          )
        )
        return [
          ...firstPageChannels,
          ...remainingResponses.flatMap(
            (response) => response.data?.items ?? []
          ),
        ]
      },
    }
  )
  const { data: userModels, isLoading: userModelsLoading } = useQuery({
    queryKey: ['user-models'],
    queryFn: getUserModels,
    enabled: !isAdmin,
    staleTime: 60_000,
  })
  const modelsLoading = isAdmin ? channelsLoading : userModelsLoading
  const modelOptions = useMemo(() => {
    let models: string[] = []
    if (isAdmin) {
      models = availableChannels.flatMap((channel) => channel.models.split(','))
    } else if (Array.isArray(userModels?.data)) {
      models = userModels.data
    }

    return [...new Set(models.map((model) => model.trim()).filter(Boolean))]
      .sort((first, second) => first.localeCompare(second))
      .map((model) => ({ value: model, label: model }))
  }, [availableChannels, isAdmin, userModels])

  const searchState = useMemo<CommonLogDraft>(() => {
    const { start, end } = getDefaultTimeRange()
    const sourceValues = {
      startTime: searchParams.startTime,
      endTime: searchParams.endTime,
      channel: searchParams.channel,
      model: searchParams.model,
      group: searchParams.group,
      username: searchParams.username,
      userCategory: searchParams.userCategory,
      requestId: searchParams.requestId,
      upstreamRequestId: searchParams.upstreamRequestId,
      type: searchParams.type,
    }
    const filters: CommonLogFilters = {
      startTime: searchParams.startTime
        ? new Date(searchParams.startTime)
        : start,
      endTime: searchParams.endTime ? new Date(searchParams.endTime) : end,
      channel: searchParams.channel || undefined,
      model: searchParams.model || undefined,
      group: searchParams.group || undefined,
      username: searchParams.username || undefined,
      userCategory: searchParams.userCategory || undefined,
      requestId: searchParams.requestId || undefined,
      upstreamRequestId: searchParams.upstreamRequestId || undefined,
    }
    return {
      sourceKey: buildSearchSourceKey(sourceValues),
      filters,
      logType: getLogTypeValue(searchParams.type),
    }
  }, [
    searchParams.startTime,
    searchParams.endTime,
    searchParams.channel,
    searchParams.model,
    searchParams.group,
    searchParams.username,
    searchParams.userCategory,
    searchParams.requestId,
    searchParams.upstreamRequestId,
    searchParams.type,
  ])
  const [draft, setDraft] = useState<CommonLogDraft>(() => searchState)
  const activeDraft =
    draft.sourceKey === searchState.sourceKey ? draft : searchState
  const filters = activeDraft.filters
  const logType = activeDraft.logType
  const userCategoryOptions = useMemo<UserCategoryOption[]>(
    () =>
      USER_CATEGORY_ROLE_VALUES.map((role) => ({
        value: `role:${role}`,
        label: t(getRoleLabelKey(role)),
      })),
    [t]
  )
  const channelOptions = useMemo(
    () =>
      [...availableChannels]
        .sort((firstChannel, secondChannel) => {
          const firstChannelEnabled =
            firstChannel.status === CHANNEL_STATUS.ENABLED
          const secondChannelEnabled =
            secondChannel.status === CHANNEL_STATUS.ENABLED

          if (firstChannelEnabled !== secondChannelEnabled) {
            return firstChannelEnabled ? -1 : 1
          }

          const priorityDifference =
            (secondChannel.priority ?? 0) - (firstChannel.priority ?? 0)
          if (priorityDifference !== 0) return priorityDifference

          const weightDifference =
            (secondChannel.weight ?? 0) - (firstChannel.weight ?? 0)
          if (weightDifference !== 0) return weightDifference

          return secondChannel.id - firstChannel.id
        })
        .map((channel) => ({
          value: String(channel.id),
          label: channel.name,
          icon: (
            <span className='flex min-w-[30px] justify-start'>
              <Badge variant='secondary' className='px-1.5 font-mono'>
                {channel.id}
              </Badge>
            </span>
          ),
          suffix:
            channel.status === CHANNEL_STATUS.ENABLED ? undefined : (
              <Badge variant='destructive'>{t('Disabled')}</Badge>
            ),
        })),
    [availableChannels, t]
  )

  const handleChange = useCallback(
    (field: keyof CommonLogFilters, value: Date | string | undefined) => {
      setDraft((current) => {
        const base =
          current.sourceKey === searchState.sourceKey ? current : searchState
        return {
          sourceKey: searchState.sourceKey,
          filters: { ...base.filters, [field]: value },
          logType: base.logType,
        }
      })
    },
    [searchState]
  )

  const handleApply = useCallback(() => {
    const normalizedFilters: CommonLogFilters = {
      ...filters,
      userCategory: isSuperAdmin
        ? getUserCategoryFilterValue(filters.userCategory, userCategoryOptions)
        : undefined,
    }
    const filterParams = buildSearchParams(normalizedFilters, 'common')
    navigate({
      to: '/usage-logs/$section',
      params: { section: 'common' },
      search: {
        ...filterParams,
        type: [logType],
        commonPage: undefined,
        commonPageSize: undefined,
      },
    })
    queryClient.invalidateQueries({ queryKey: ['logs'] })
    queryClient.invalidateQueries({ queryKey: ['usage-logs-stats'] })
  }, [
    filters,
    isSuperAdmin,
    logType,
    navigate,
    queryClient,
    userCategoryOptions,
  ])

  const handleReset = useCallback(() => {
    const { start, end } = getDefaultTimeRange()
    const resetFilters: CommonLogFilters = { startTime: start, endTime: end }
    const resetSearch = {
      type: [LOG_TYPE_ALL_VALUE],
      startTime: start.getTime(),
      endTime: end.getTime(),
    }
    setDraft({
      sourceKey: buildSearchSourceKey(resetSearch),
      filters: resetFilters,
      logType: LOG_TYPE_ALL_VALUE,
    })

    navigate({
      to: '/usage-logs/$section',
      params: { section: 'common' },
      search: {
        commonPage: undefined,
        commonPageSize: undefined,
        ...resetSearch,
      },
    })
    queryClient.invalidateQueries({ queryKey: ['logs'] })
    queryClient.invalidateQueries({ queryKey: ['usage-logs-stats'] })
  }, [navigate, queryClient])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleApply()
    },
    [handleApply]
  )

  const handleViewScopeChange = useCallback(
    (scope: string) => {
      if (scope === 'all' || scope === 'self') {
        setViewScope(scope)
      }
    },
    [setViewScope]
  )

  const hasExpandedFilters =
    !!filters.username ||
    !!filters.group ||
    (isSuperAdmin && !!filters.userCategory) ||
    !!filters.channel ||
    !!filters.requestId ||
    !!filters.upstreamRequestId

  const hasTypeFilter = logType !== LOG_TYPE_ALL_VALUE
  const hasAdditionalFilters =
    !!filters.model || !!filters.group || hasTypeFilter || hasExpandedFilters

  const expandedFilterCount = [
    isAdmin ? filters.username : undefined,
    filters.group,
    isSuperAdmin ? filters.userCategory : undefined,
    isAdmin ? filters.channel : undefined,
    filters.requestId,
    filters.upstreamRequestId,
  ].filter(Boolean).length
  const sensitiveInputClass = sensitiveVisible
    ? undefined
    : '[-webkit-text-security:disc]'
  const logTypeItems = useMemo(
    () =>
      LOG_TYPE_FILTERS.map((type) => ({
        value: type.value,
        label: t(type.label),
        deprecated: type.deprecated,
      })),
    [t]
  )
  const selectedLogType = logTypeItems.find((type) => type.value === logType)
  const deprecatedTypeDescription = t(
    'Only used to find historical logs. New records are available in Audit Logs.'
  )

  const statsBar = (
    <div className='flex flex-wrap items-center gap-2'>
      <CommonLogsStats />
    </div>
  )
  const sensitiveToggle = (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant='ghost'
            size='icon'
            onClick={() => setSensitiveVisible(!sensitiveVisible)}
            aria-label={sensitiveVisible ? t('Hide') : t('Show')}
            className='text-muted-foreground hover:text-foreground size-7'
          />
        }
      >
        {sensitiveVisible ? <Eye /> : <EyeOff />}
      </TooltipTrigger>
      <TooltipContent>
        {sensitiveVisible ? t('Hide') : t('Show')}
      </TooltipContent>
    </Tooltip>
  )

  const dateRangeFilter = (
    <LogsFilterField>
      <CompactDateTimeRangePicker
        start={filters.startTime}
        end={filters.endTime}
        onChange={({ start, end }) => {
          handleChange('startTime', start)
          handleChange('endTime', end)
        }}
      />
    </LogsFilterField>
  )
  const modelFilter = (
    <LogsFilterField>
      <Combobox
        options={modelOptions}
        placeholder={modelsLoading ? t('Loading...') : t('Model Name')}
        searchPlaceholder={modelsLoading ? t('Loading...') : t('Model Name')}
        value={filters.model || ''}
        onValueChange={(value) => handleChange('model', value || undefined)}
        emptyText='No data'
        allowCustomValue
        showCustomValueHint={false}
        openOnFocus
      />
    </LogsFilterField>
  )
  const groupFilter = (
    <LogsFilterField>
      <LogsFilterInput
        placeholder={t('Group')}
        className={sensitiveInputClass}
        autoComplete='off'
        value={filters.group || ''}
        onChange={(e) => handleChange('group', e.target.value)}
        onKeyDown={handleKeyDown}
      />
    </LogsFilterField>
  )
  const typeFilter = (
    <LogsFilterField>
      <Select
        items={logTypeItems}
        value={logType}
        onValueChange={(value) => {
          const nextLogType =
            value !== null && isLogTypeValue(value) ? value : LOG_TYPE_ALL_VALUE
          setDraft((current) => {
            const base =
              current.sourceKey === searchState.sourceKey
                ? current
                : searchState
            return {
              sourceKey: searchState.sourceKey,
              filters: base.filters,
              logType: nextLogType,
            }
          })
        }}
      >
        <SelectTrigger
          aria-description={
            selectedLogType?.deprecated ? deprecatedTypeDescription : undefined
          }
        >
          <SelectValue className='min-w-0'>
            <span className='truncate'>
              {selectedLogType?.label ?? t('All Types')}
            </span>
            {selectedLogType?.deprecated && (
              <Badge
                variant='secondary'
                className='h-4 px-1.5 text-[10px] font-normal'
                title={deprecatedTypeDescription}
              >
                {t('Deprecated')}
              </Badge>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent
          alignItemWithTrigger={false}
          className='max-w-[calc(100vw-2rem)] min-w-52'
        >
          <SelectGroup>
            {LOG_TYPE_FILTERS.map((type) => (
              <SelectItem
                key={type.value}
                value={type.value}
                className='[&_[data-slot=select-item-text]]:items-center'
                aria-description={
                  type.deprecated ? deprecatedTypeDescription : undefined
                }
              >
                {t(type.label)}
                {type.deprecated && (
                  <Badge
                    variant='secondary'
                    className='h-4 px-1.5 text-[10px] font-normal'
                    title={deprecatedTypeDescription}
                  >
                    {t('Deprecated')}
                  </Badge>
                )}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </LogsFilterField>
  )
  const roleFilter = isSuperAdmin ? (
    <LogsFilterField>
      <Combobox
        options={userCategoryOptions}
        value={filters.userCategory || ''}
        onValueChange={(value) =>
          handleChange('userCategory', value || undefined)
        }
        placeholder={t('Role')}
        searchPlaceholder={t('Role')}
        allowCustomValue
        showCustomValueHint={false}
        filterByValue={false}
        openOnFocus
      />
    </LogsFilterField>
  ) : null
  const usernameFilter = isAdmin ? (
    <LogsFilterField>
      <LogsFilterInput
        placeholder={t('Username / Display Name')}
        className={sensitiveInputClass}
        autoComplete='off'
        value={filters.username || ''}
        onChange={(e) => handleChange('username', e.target.value)}
        onKeyDown={handleKeyDown}
      />
    </LogsFilterField>
  ) : null
  const requestIdFilter = (
    <LogsFilterField>
      <LogsFilterInput
        placeholder={t('Request ID')}
        value={filters.requestId || ''}
        onChange={(e) => handleChange('requestId', e.target.value)}
        onKeyDown={handleKeyDown}
      />
    </LogsFilterField>
  )
  const advancedFilters = (
    <>
      {groupFilter}
      <LogsFilterField>
        <LogsFilterInput
          placeholder={t('Upstream Request ID')}
          value={filters.upstreamRequestId || ''}
          onChange={(e) => handleChange('upstreamRequestId', e.target.value)}
          onKeyDown={handleKeyDown}
        />
      </LogsFilterField>
      {roleFilter}
      {isAdmin && (
        <LogsFilterField>
          <Combobox
            options={channelOptions}
            value={filters.channel || ''}
            onValueChange={(value) =>
              handleChange('channel', value || undefined)
            }
            placeholder={channelsLoading ? t('Loading...') : t('Channel')}
            searchPlaceholder={channelsLoading ? t('Loading...') : t('Channel')}
            emptyText='No data'
            showCustomValueHint={false}
            showSelectedOptionContent
            openOnFocus
          />
        </LogsFilterField>
      )}
      {canManageScope && (
        <Tabs value={viewScope} onValueChange={handleViewScopeChange}>
          <TabsList>
            <TabsTrigger value='all'>{t('All')}</TabsTrigger>
            <TabsTrigger value='self'>{t('Only Mine')}</TabsTrigger>
          </TabsList>
        </Tabs>
      )}
    </>
  )

  return (
    <LogsFilterToolbar
      table={props.table}
      stats={statsBar}
      actionStart={sensitiveToggle}
      primaryFiltersClassName='sm:grid-cols-[minmax(15rem,1.5fr)_repeat(4,minmax(8rem,1fr))]'
      primaryFilters={
        <>
          {dateRangeFilter}
          {modelFilter}
          {typeFilter}
          {usernameFilter}
          {requestIdFilter}
        </>
      }
      advancedFilters={advancedFilters}
      mobilePinnedFilters={dateRangeFilter}
      mobileFilters={
        <>
          {modelFilter}
          {typeFilter}
          {usernameFilter}
          {requestIdFilter}
          {advancedFilters}
        </>
      }
      mobileFilterCount={
        [filters.model, filters.group, hasTypeFilter].filter(Boolean).length +
        expandedFilterCount
      }
      hasAdvancedActiveFilters={hasExpandedFilters}
      advancedFilterCount={expandedFilterCount}
      hasActiveFilters={hasAdditionalFilters}
      onSearch={handleApply}
      searchLoading={fetchingLogs > 0}
      onReset={handleReset}
    />
  )
}
