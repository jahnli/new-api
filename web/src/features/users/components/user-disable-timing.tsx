import { CalendarClock, PowerOff } from 'lucide-react'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'

import { DatePicker } from '@/components/date-picker'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import dayjs from '@/lib/dayjs'

// undefined selects immediate disable; zero means the scheduled date is still empty.
export function UserDisableTiming({
  value,
  onChange,
}: {
  value?: number
  onChange: (timestamp?: number) => void
}) {
  const { t } = useTranslation()
  const dateId = useId()
  const tomorrow = dayjs().add(1, 'day').startOf('day')

  return (
    <Tabs
      value={value === undefined ? 'now' : 'later'}
      onValueChange={(mode) => onChange(mode === 'now' ? undefined : 0)}
      className='gap-0'
    >
      <TabsList
        aria-label={t('Mode')}
        className='grid w-full grid-cols-2 group-data-horizontal/tabs:h-auto'
      >
        <TabsTrigger value='now' className='min-h-9 whitespace-normal'>
          <PowerOff aria-hidden='true' />
          {t('Disable now')}
        </TabsTrigger>
        <TabsTrigger value='later' className='min-h-9 whitespace-normal'>
          <CalendarClock aria-hidden='true' />
          {t('Schedule disable')}
        </TabsTrigger>
      </TabsList>
      <TabsContent value='now' />
      <TabsContent value='later' className='space-y-2 pt-4'>
        <Label htmlFor={dateId}>{t('Scheduled disable')}</Label>
        <DatePicker
          id={dateId}
          className='w-full'
          minDate={tomorrow.toDate()}
          maxDate={tomorrow.add(100, 'year').endOf('year').toDate()}
          selected={value ? new Date(value * 1000) : undefined}
          onSelect={(date) =>
            onChange(date ? dayjs(date).startOf('day').unix() : 0)
          }
        />
        <p className='text-muted-foreground text-xs'>
          {t('Timezone')} · {Intl.DateTimeFormat().resolvedOptions().timeZone}
        </p>
        {!!value && value <= Date.now() / 1000 && (
          <p className='text-destructive text-xs' role='alert'>
            {t('Select a future date')}
          </p>
        )}
      </TabsContent>
    </Tabs>
  )
}
