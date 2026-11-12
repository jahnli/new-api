import dayjs from '@/lib/dayjs'

export const DATE_TIME_PRESETS = [
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

export type DateTimePresetKind = (typeof DATE_TIME_PRESETS)[number][0]

export interface DateTimePresetRange {
  start: Date
  end: Date
}

export function getDateTimePresetRange(
  kind: DateTimePresetKind,
  now: dayjs.Dayjs = dayjs()
): DateTimePresetRange {
  if (kind === 'lastHour') {
    return { start: now.subtract(1, 'hour').toDate(), end: now.toDate() }
  }

  let start: dayjs.Dayjs
  let end: dayjs.Dayjs
  switch (kind) {
    case 'today':
    case 'yesterday': {
      const date = kind === 'yesterday' ? now.subtract(1, 'day') : now
      start = date.startOf('day')
      end = date.endOf('day')
      break
    }
    case 'thisWeek':
    case 'lastWeek': {
      const weekday = now.day() === 0 ? 7 : now.day()
      start = now.subtract(weekday - 1, 'day').startOf('day')
      if (kind === 'lastWeek') start = start.subtract(1, 'week')
      end = start.add(6, 'day').endOf('day')
      break
    }
    case 'thisMonth':
    case 'lastMonth': {
      const date = kind === 'lastMonth' ? now.subtract(1, 'month') : now
      start = date.startOf('month')
      end = date.endOf('month')
      break
    }
    case 'thisQuarter':
    case 'lastQuarter': {
      const date = kind === 'lastQuarter' ? now.subtract(1, 'quarter') : now
      start = date.startOf('quarter')
      end = date.endOf('quarter')
      break
    }
    case 'thisHalfYear':
    case 'lastHalfYear':
      start = now.startOf('year').add(now.month() < 6 ? 0 : 6, 'month')
      if (kind === 'lastHalfYear') start = start.subtract(6, 'month')
      end = start.add(6, 'month').subtract(1, 'millisecond')
      break
    case 'thisYear':
    case 'lastYear': {
      const date = kind === 'lastYear' ? now.subtract(1, 'year') : now
      start = date.startOf('year')
      end = date.endOf('year')
      break
    }
  }

  return { start: start.toDate(), end: end.toDate() }
}
