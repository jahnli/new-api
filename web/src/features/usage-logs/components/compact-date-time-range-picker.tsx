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
import dayjs from '@/lib/dayjs'
import { cn } from '@/lib/utils'

interface CompactDateTimeRangePickerProps {
  start?: Date
  end?: Date
  onChange: (range: { start?: Date; end?: Date }) => void
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

function getMondayWeekStart(date: dayjs.Dayjs): dayjs.Dayjs {
  const weekday = date.day() === 0 ? 7 : date.day()
  return date.subtract(weekday - 1, 'day').startOf('day')
}

export function CompactDateTimeRangePicker({
  start,
  end,
  onChange,
  className,
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

  type PresetKind =
    | 'lastHour'
    | 'today'
    | 'yesterday'
    | 'thisWeek'
    | 'lastWeek'
    | 'thisMonth'
    | 'lastMonth'
    | 'thisQuarter'
    | 'lastQuarter'
    | 'thisHalfYear'
    | 'lastHalfYear'
    | 'thisYear'
    | 'lastYear'

  const buildPresetMap = (
    now: dayjs.Dayjs
  ): Record<PresetKind, { start: Date; end: Date }> => {
    const thisWeekStart = getMondayWeekStart(now)
    const lastWeekStart = thisWeekStart.subtract(1, 'week')

    return {
      lastHour: {
        start: now.subtract(1, 'hour').toDate(),
        end: now.toDate(),
      },
      today: {
        start: now.startOf('day').toDate(),
        end: now.endOf('day').toDate(),
      },
      yesterday: {
        start: now.subtract(1, 'day').startOf('day').toDate(),
        end: now.subtract(1, 'day').endOf('day').toDate(),
      },
      thisWeek: {
        start: thisWeekStart.toDate(),
        end: thisWeekStart.add(6, 'day').endOf('day').toDate(),
      },
      lastWeek: {
        start: lastWeekStart.toDate(),
        end: lastWeekStart.add(6, 'day').endOf('day').toDate(),
      },
      thisMonth: {
        start: now.startOf('month').toDate(),
        end: now.endOf('month').toDate(),
      },
      lastMonth: {
        start: now.subtract(1, 'month').startOf('month').toDate(),
        end: now.subtract(1, 'month').endOf('month').toDate(),
      },
      thisQuarter: {
        start: now.startOf('quarter').toDate(),
        end: now.endOf('quarter').toDate(),
      },
      lastQuarter: {
        start: now.subtract(1, 'quarter').startOf('quarter').toDate(),
        end: now.subtract(1, 'quarter').endOf('quarter').toDate(),
      },
      thisHalfYear: {
        start: (now.month() < 6
          ? now.startOf('year')
          : now.startOf('year').add(6, 'month')
        ).toDate(),
        end: (now.month() < 6
          ? now.startOf('year').add(5, 'month').endOf('month')
          : now.endOf('year')
        ).toDate(),
      },
      lastHalfYear: {
        start: (now.month() < 6
          ? now.subtract(1, 'year').startOf('year').add(6, 'month')
          : now.startOf('year')
        ).toDate(),
        end: (now.month() < 6
          ? now.subtract(1, 'year').endOf('year')
          : now.startOf('year').add(5, 'month').endOf('month')
        ).toDate(),
      },
      thisYear: {
        start: now.startOf('year').toDate(),
        end: now.endOf('year').toDate(),
      },
      lastYear: {
        start: now.subtract(1, 'year').startOf('year').toDate(),
        end: now.subtract(1, 'year').endOf('year').toDate(),
      },
    }
  }

  const applyPreset = (kind: PresetKind) => {
    const range = buildPresetMap(dayjs())[kind]
    setDraftStart(toInputValue(range.start))
    setDraftEnd(toInputValue(range.end))
    onChange(range)
    setOpen(false)
  }

  const activePreset = useMemo((): PresetKind | null => {
    if (!start) return null
    const sMin = dayjs(start).startOf('second').valueOf()
    const eMin = end ? dayjs(end).startOf('second').valueOf() : 0
    const presets = buildPresetMap(dayjs())
    const skipRelative = new Set<PresetKind>(['lastHour'])
    for (const [kind, range] of Object.entries(presets) as [
      PresetKind,
      { start: Date; end: Date },
    ][]) {
      if (skipRelative.has(kind)) continue
      const ps = dayjs(range.start).startOf('second').valueOf()
      const pe = dayjs(range.end).startOf('second').valueOf()
      if (sMin === ps && eMin === pe) return kind
    }
    return null
  }, [start, end])

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        render={
          <Button
            type='button'
            variant='outline'
            className={cn(
              'w-full justify-start gap-2 px-2.5 text-sm leading-5 font-normal tabular-nums',
              !start && !end && 'text-muted-foreground',
              className
            )}
          />
        }
      >
        <CalendarDays className='text-muted-foreground size-4 shrink-0' />
        <span className='truncate'>{label}</span>
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

          <div className='flex flex-wrap gap-1.5'>
            {(
              [
                ['lastHour', 'Last Hour'],
                ['today', 'Today'],
                ['yesterday', 'Yesterday'],
                ['thisWeek', 'This Week'],
                ['lastWeek', 'Last Week'],
                ['thisMonth', 'This Month'],
                ['lastMonth', 'Last Month'],
                ['thisQuarter', 'This Quarter'],
                ['lastQuarter', 'Last Quarter'],
                ['thisHalfYear', 'This Half Year'],
                ['lastHalfYear', 'Last Half Year'],
                ['thisYear', 'This Year'],
                ['lastYear', 'Last Year'],
              ] as const
            ).map(([kind, label]) => (
              <Button
                key={kind}
                type='button'
                variant={activePreset === kind ? 'default' : 'secondary'}
                size='sm'
                className='h-7 flex-1 px-2 text-xs'
                onClick={() => applyPreset(kind)}
              >
                {t(label)}
              </Button>
            ))}
          </div>

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
