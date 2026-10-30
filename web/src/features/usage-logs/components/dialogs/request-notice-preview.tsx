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

  if (
    props.preview.image_url?.startsWith('/notice/non-work/') ||
    props.preview.image_url?.startsWith('/notice/security-alert/') ||
    props.preview.image_url?.startsWith('/notice/model-switch/')
  ) {
    const icons = ['time.png', 'model.png', 'id.png', 'client.png']
    let iconDir = 'non-work'
    if (props.preview.template === 'red') iconDir = 'security-alert'
    if (props.preview.template === 'blue') iconDir = 'model-switch'
    return (
      <section aria-label={t('Preview')}>
        <Card
          className='gap-0 bg-white py-0 text-[#1f2329]'
          data-card-hover='false'
        >
          <CardHeader
            className={cn(
              'p-4',
              NOTIFICATION_TITLE_THEME_CLASSES[props.preview.template]
            )}
          >
            <h3 className='text-base font-semibold'>{props.preview.title}</h3>
          </CardHeader>
          <CardContent className='space-y-5 p-5 sm:p-6'>
            <div className='flex items-center gap-4 sm:gap-6'>
              {props.preview.image_url && (
                <img
                  src={props.preview.image_url}
                  alt=''
                  className='w-1/4 min-w-0 shrink-0'
                />
              )}
              <div className='min-w-0 space-y-2'>
                <h3 className='text-base leading-snug font-bold sm:text-lg'>
                  {props.preview.content}
                </h3>
                {props.preview.subtitle && (
                  <p className='text-sm leading-relaxed text-[#8f959e]'>
                    {props.preview.subtitle}
                  </p>
                )}
                {props.preview.advice && (
                  <ul className='space-y-2'>
                    {props.preview.advice.map((text, index) => (
                      <li
                        key={text}
                        className='flex items-center gap-2 text-sm'
                      >
                        <img
                          src={
                            props.preview.template === 'blue'
                              ? '/notice/model-switch/alarm.png'
                              : `/notice/security-alert/${['key.png', 'prohibition.png', 'security.png'][index]}`
                          }
                          alt=''
                          className={cn(
                            'shrink-0',
                            props.preview.template === 'blue'
                              ? 'size-5'
                              : 'size-6'
                          )}
                        />
                        <span>{text}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <dl className='grid grid-cols-2 gap-x-4 gap-y-4'>
              {props.preview.fields.map((field, index) => {
                if (props.preview.template === 'blue' && index === 1) {
                  return null
                }
                return (
                  <div
                    key={field.label}
                    className={cn(
                      'flex min-w-0 items-start gap-2',
                      (index >= 2 || props.preview.template === 'blue') &&
                        'col-span-2'
                    )}
                  >
                    {icons[index] && (
                      <img
                        src={`/notice/${iconDir}/${icons[index]}`}
                        alt=''
                        className='size-7 shrink-0'
                      />
                    )}
                    <div className='min-w-0 space-y-1'>
                      <dt className='text-sm font-bold'>{field.label}</dt>
                      <dd className='text-sm break-all whitespace-pre-wrap text-[#1f2329]'>
                        {field.value}
                      </dd>
                    </div>
                  </div>
                )
              })}
            </dl>
          </CardContent>
        </Card>
      </section>
    )
  }

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
          {props.preview.image_url && (
            <img
              src={props.preview.image_url}
              alt=''
              className='h-auto w-full'
            />
          )}
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
