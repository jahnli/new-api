import { RefreshCw, ShieldAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { NOTIFICATION_TITLE_THEME_CLASSES } from '@/features/notification/lib/title-theme'
import { cn } from '@/lib/utils'

import type { RequestNoticePreview } from '../../types'

export function RequestNoticePreviewCard(props: {
  preview: RequestNoticePreview
}) {
  const { t } = useTranslation()
  const NoticeIcon = props.preview.template === 'blue' ? RefreshCw : ShieldAlert

  return (
    <section aria-label={t('Preview')}>
      <Card className='gap-0 py-0' data-card-hover='false'>
        <CardHeader
          className={cn(
            'p-4',
            NOTIFICATION_TITLE_THEME_CLASSES[props.preview.template]
          )}
        >
          <h3 className='flex items-start gap-2 text-base font-semibold'>
            <NoticeIcon className='mt-0.5 size-5 shrink-0' aria-hidden='true' />
            {props.preview.title}
          </h3>
        </CardHeader>
        <CardContent className='space-y-4 p-4 sm:p-4'>
          <p className='text-sm leading-relaxed break-words whitespace-pre-wrap'>
            {props.preview.content}
          </p>
          <dl className='grid grid-cols-1 gap-4 text-sm sm:grid-cols-2'>
            {props.preview.fields.map((field, index) => (
              <div
                key={field.label}
                className={cn(
                  'min-w-0 space-y-1',
                  (props.preview.template === 'blue' || index >= 2) &&
                    'sm:col-span-2'
                )}
              >
                <dt className='font-semibold'>{field.label}</dt>
                <dd className='text-muted-foreground break-all whitespace-pre-wrap'>
                  {field.value}
                </dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
    </section>
  )
}
