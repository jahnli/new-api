import type { Table } from '@tanstack/react-table'
import { useTranslation } from 'react-i18next'

import { Combobox } from '@/components/ui/combobox'

import { CompactDateTimeRangePicker } from '../../components/compact-date-time-range-picker'
import {
  LogsFilterField,
  LogsFilterInput,
  LogsFilterToolbar,
} from '../../components/logs-filter-toolbar'
import type { SMTPAudit, SMTPAuditFilters } from './api'
import { useSMTPLabels } from './labels'

export function SMTPFilterBar(props: {
  table: Table<SMTPAudit>
  filters: SMTPAuditFilters
  onChange: (filters: SMTPAuditFilters) => void
  onSearch: () => void
  onReset: () => void
  isFetching: boolean
}) {
  const { t } = useTranslation()
  const { statuses, purposes } = useSMTPLabels()
  const update = (patch: Partial<SMTPAuditFilters>) =>
    props.onChange({ ...props.filters, ...patch })
  const dateFilter = (
    <LogsFilterField wide>
      <CompactDateTimeRangePicker
        start={
          props.filters.start_timestamp === undefined
            ? undefined
            : new Date(props.filters.start_timestamp * 1000)
        }
        end={
          props.filters.end_timestamp === undefined
            ? undefined
            : new Date(props.filters.end_timestamp * 1000)
        }
        onChange={({ start, end }) =>
          update({
            start_timestamp: start
              ? Math.floor(start.getTime() / 1000)
              : undefined,
            end_timestamp: end ? Math.floor(end.getTime() / 1000) : undefined,
          })
        }
      />
    </LogsFilterField>
  )
  const primary = (
    <>
      {(
        [
          ['status', t('Status'), statuses],
          ['purpose', t('Purpose'), purposes],
          ['is_test', t('Test email'), { true: t('Yes'), false: t('No') }],
        ] as const
      ).map(([key, label, options]) => (
        <LogsFilterField key={key}>
          <Combobox
            aria-label={label}
            className='w-full'
            value={props.filters[key] ?? 'all'}
            options={[
              { value: 'all', label: `${label}: ${t('All')}` },
              ...Object.entries(options).map(([value, optionLabel]) => ({
                value,
                label: optionLabel,
              })),
            ]}
            onValueChange={(value) =>
              update({ [key]: !value || value === 'all' ? undefined : value })
            }
          />
        </LogsFilterField>
      ))}
    </>
  )
  const advanced = (
    <>
      {(
        [
          ['recipient', t('Recipient')],
          ['user_id', t('User ID')],
          ['request_id', t('Request ID')],
        ] as const
      ).map(([key, label]) => (
        <LogsFilterField key={key}>
          <LogsFilterInput
            aria-label={label}
            placeholder={label}
            inputMode={key === 'user_id' ? 'numeric' : 'text'}
            value={props.filters[key] ?? ''}
            onChange={(event) =>
              update({ [key]: event.target.value || undefined })
            }
            onKeyDown={(event) => {
              if (event.key === 'Enter') props.onSearch()
            }}
          />
        </LogsFilterField>
      ))}
    </>
  )
  const advancedCount = [
    props.filters.recipient,
    props.filters.user_id,
    props.filters.request_id,
  ].filter(Boolean).length
  const filterCount =
    advancedCount +
    [props.filters.status, props.filters.purpose, props.filters.is_test].filter(
      Boolean
    ).length
  return (
    <LogsFilterToolbar
      table={props.table}
      primaryFilters={
        <>
          {dateFilter}
          {primary}
        </>
      }
      advancedFilters={advanced}
      mobilePinnedFilters={dateFilter}
      mobileFilters={
        <>
          {primary}
          {advanced}
        </>
      }
      mobileFilterCount={filterCount}
      advancedFilterCount={advancedCount}
      hasActiveFilters={Object.values(props.filters).some(
        (value) => value !== undefined && value !== ''
      )}
      hasAdvancedActiveFilters={advancedCount > 0}
      searchLoading={props.isFetching}
      onSearch={props.onSearch}
      onReset={props.onReset}
    />
  )
}
