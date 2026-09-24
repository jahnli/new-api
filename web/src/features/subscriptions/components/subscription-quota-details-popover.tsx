import { CircleQuestionMark } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { QuotaDetailsPopover } from '@/components/quota-details-popover'
import { cn } from '@/lib/utils'

import { SubscriptionPremiumModels } from './subscription-premium-models'

export function SubscriptionQuotaDetailsPopover(props: {
  title: string
  used: string
  limit: string
  remaining: string
  description?: string
  showPremiumModels?: boolean
  iconClassName?: string
}) {
  const { t } = useTranslation()

  return (
    <QuotaDetailsPopover
      title={props.title}
      triggerLabel={`${props.title} · ${t('Details')}`}
      details={[
        { label: t('Used'), value: props.used },
        { label: t('Total Quota'), value: props.limit },
        { label: t('Remaining'), value: props.remaining },
      ]}
      description={props.description}
      additionalContent={
        props.showPremiumModels ? (
          <div className='space-y-2 border-t pt-3'>
            <p className='text-sm font-medium'>{t('Advanced model list')}</p>
            <SubscriptionPremiumModels />
          </div>
        ) : undefined
      }
      className='w-auto'
      triggerClassName='text-muted-foreground size-5 shrink-0 justify-center p-0 hover:text-foreground'
    >
      <CircleQuestionMark
        className={cn('size-3.5 translate-y-px', props.iconClassName)}
        aria-hidden='true'
      />
    </QuotaDetailsPopover>
  )
}
