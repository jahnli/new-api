import { CalendarDays } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DATE_TIME_PRESETS,
  getDateTimePresetRange,
  type DateTimePresetKind,
} from '@/lib/date-time-presets'
import dayjs from '@/lib/dayjs'
import { cn } from '@/lib/utils'

interface CompactDateTimeRangePickerProps {
  start?: Date
  end?: Date
  onChange: (
    range: { start?: Date; end?: Date },
    preset?: DateTimePresetKind
  ) => void
  presetDisplay?: 'buttons' | 'select'
  preset?: DateTimePresetKind
  className?: string
}

function toInputValue(date?: Date): string {
  return date ? dayjs(date).format('YYYY-MM-DDTHH:mm:ss') : ''
}

function fromInputValue(value: string): Date | undefined {
  if (!value) return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date
}

export function CompactDateTimeRangePicker({
  start,
  end,
  onChange,
  className,
  presetDisplay,
  preset,
}: CompactDateTimeRangePickerProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [draftStart, setDraftStart] = useState(toInputValue(start))
  const [draftEnd, setDraftEnd] = useState(toInputValue(end))

  const label = useMemo(() => {
    if (!start && !end) return t('Date Range')
    const startText = start ? dayjs(start).format('YYYY-MM-DD HH:mm:ss') : '-'
    const endText = end ? dayjs(end).format('YYYY-MM-DD HH:mm:ss') : '-'
    return `${startText} ~ ${endText}`
  }, [end, start, t])

  const mobileLabel = useMemo(() => {
    if (!start || !end) return label
    if (dayjs(start).isSame(end, 'day')) {
      return `${dayjs(start).format('MM/DD HH:mm')}–${dayjs(end).format('HH:mm')}`
    }
    return label
  }, [start, end, label])

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setDraftStart(toInputValue(start))
      setDraftEnd(toInputValue(end))
    }
    setOpen(nextOpen)
  }

  const applyDraft = () => {
    onChange({
      start: fromInputValue(draftStart),
      end: fromInputValue(draftEnd),
    })
    setOpen(false)
  }

  const applyPreset = (kind: DateTimePresetKind) => {
    const range = getDateTimePresetRange(kind)
    setDraftStart(toInputValue(range.start))
    setDraftEnd(toInputValue(range.end))
    onChange(range, kind)
    setOpen(false)
  }

  const activePreset = useMemo((): DateTimePresetKind | null => {
    if (preset) return preset
    if (!start) return null
    const sMin = dayjs(start).startOf('second').valueOf()
    const eMin = end ? dayjs(end).startOf('second').valueOf() : 0
    const now = dayjs()
    for (const [kind] of DATE_TIME_PRESETS) {
      if (kind === 'lastHour') continue
      const range = getDateTimePresetRange(kind, now)
      const ps = dayjs(range.start).startOf('second').valueOf()
      const pe = dayjs(range.end).startOf('second').valueOf()
      if (sMin === ps && eMin === pe) return kind
    }
    return null
  }, [start, end, preset])

  const presetButtons = (
    <div
      role='group'
      aria-label={t('Date Range')}
      className={cn(
        'flex flex-wrap gap-1.5',
        presetDisplay === 'buttons' && className
      )}
    >
      {DATE_TIME_PRESETS.map(([kind, label]) => (
        <Button
          key={kind}
          type='button'
          variant={activePreset === kind ? 'default' : 'secondary'}
          size='sm'
          aria-pressed={activePreset === kind}
          className='h-7 flex-1 px-2 text-xs'
          onClick={() => applyPreset(kind)}
        >
          {t(label)}
        </Button>
      ))}
    </div>
  )

  if (presetDisplay === 'buttons') return presetButtons

  if (presetDisplay === 'select') {
    return (
      <Select
        items={DATE_TIME_PRESETS.map(([value, label]) => ({
          value,
          label: t(label),
        }))}
        value={activePreset}
        onValueChange={(value) => {
          if (value) applyPreset(value)
        }}
      >
        <SelectTrigger
          size='sm'
          aria-label={t('Date Range')}
          className={cn('min-w-24 data-[size=sm]:rounded-lg', className)}
        >
          <SelectValue placeholder={t('Date Range')} />
        </SelectTrigger>
        <SelectContent
          align='end'
          alignItemWithTrigger={false}
          className='rounded-xl'
        >
          <SelectGroup>
            {DATE_TIME_PRESETS.map(([kind, label]) => (
              <SelectItem
                key={kind}
                value={kind}
                className='data-selected:bg-accent data-selected:text-accent-foreground rounded-lg'
              >
                {t(label)}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    )
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        render={
          <Button
            type='button'
            variant='outline'
            aria-label={label}
            className={cn(
              'w-full justify-start gap-2 px-2.5 text-sm leading-5 font-normal tabular-nums',
              !start && !end && 'text-muted-foreground',
              className
            )}
          />
        }
      >
        <CalendarDays className='text-muted-foreground size-4 shrink-0' />
        <span className='hidden truncate sm:block'>{label}</span>
        <span className='min-w-0 [overflow-wrap:anywhere] whitespace-normal sm:hidden'>
          {mobileLabel}
        </span>
      </PopoverTrigger>
      <PopoverContent
        align='start'
        className='w-[min(520px,calc(100vw-2rem))] p-3'
      >
        <div className='space-y-3'>
          <div className='grid gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-end'>
            <div className='space-y-1.5'>
              <div className='text-muted-foreground text-xs'>
                {t('Start Time')}
              </div>
              <Input
                type='datetime-local'
                step='1'
                value={draftStart}
                aria-label={t('Start Time')}
                onChange={(e) => setDraftStart(e.target.value)}
                className='h-8 text-sm leading-5 tabular-nums'
              />
            </div>
            <span className='text-muted-foreground hidden pb-2 text-xs sm:block'>
              ~
            </span>
            <div className='space-y-1.5'>
              <div className='text-muted-foreground text-xs'>
                {t('End Time')}
              </div>
              <Input
                type='datetime-local'
                step='1'
                value={draftEnd}
                aria-label={t('End Time')}
                onChange={(e) => setDraftEnd(e.target.value)}
                className='h-8 text-sm leading-5 tabular-nums'
              />
            </div>
          </div>

          {presetButtons}

          <div className='flex justify-end'>
            <Button size='sm' className='h-8' onClick={applyDraft}>
              {t('Confirm')}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
