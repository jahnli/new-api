import { useQuery } from '@tanstack/react-query'
import { CircleQuestionMark } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { QuotaDetailsPopover } from '@/components/quota-details-popover'
import { Badge } from '@/components/ui/badge'

import { getPremiumModelNames } from '../premium-api'

export function SubscriptionQuotaDetailsPopover(props: {
  title: string
  used: string
  limit: string
  remaining: string
  description: string
  showPremiumModels?: boolean
}) {
  const { t } = useTranslation()
  const premiumModelsQuery = useQuery({
    queryKey: ['subscription-premium', 'configured-models'],
    queryFn: getPremiumModelNames,
    enabled: props.showPremiumModels === true,
    meta: { errorToast: false },
  })
  let modelNamesContent: ReactNode = null
  if (premiumModelsQuery.isPending) {
    modelNamesContent = (
      <p className='text-muted-foreground text-xs'>{t('Loading...')}</p>
    )
  } else if (premiumModelsQuery.isError) {
    modelNamesContent = (
      <p className='text-muted-foreground text-xs'>{t('Failed to load')}</p>
    )
  } else if (premiumModelsQuery.data?.length) {
    modelNamesContent = (
      <ul className='flex max-h-32 flex-wrap gap-1.5 overflow-y-auto pr-1'>
        {premiumModelsQuery.data.map((modelName) => (
          <li key={modelName} className='max-w-full'>
            <Badge
              variant='secondary'
              className='h-auto max-w-full py-1 text-left [overflow-wrap:anywhere] whitespace-normal'
            >
              {modelName}
            </Badge>
          </li>
        ))}
      </ul>
    )
  } else {
    modelNamesContent = (
      <p className='text-muted-foreground text-xs'>
        {t('No available models')}
      </p>
    )
  }

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
            <p className='text-xs font-medium'>{t('Advanced models')}</p>
            {modelNamesContent}
          </div>
        ) : undefined
      }
      className='w-auto'
      triggerClassName='text-muted-foreground size-5 shrink-0 justify-center p-0 hover:text-foreground'
    >
      <CircleQuestionMark
        className='size-3.5 translate-y-px'
        aria-hidden='true'
      />
    </QuotaDetailsPopover>
  )
}
