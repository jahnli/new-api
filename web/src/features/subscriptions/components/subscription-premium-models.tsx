import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'

import { getPremiumModelNames } from '../premium-api'

export function SubscriptionPremiumModels() {
  const { t } = useTranslation()
  const query = useQuery({
    queryKey: ['subscription-premium', 'configured-models'],
    queryFn: getPremiumModelNames,
    meta: { errorToast: false },
  })

  if (query.isPending) {
    return <p className='text-muted-foreground text-sm'>{t('Loading...')}</p>
  }
  if (query.isError) {
    return (
      <p className='text-muted-foreground text-sm'>{t('Failed to load')}</p>
    )
  }
  if (!query.data?.length) {
    return (
      <p className='text-muted-foreground text-sm'>
        {t('No available models')}
      </p>
    )
  }

  return (
    <ul className='flex max-h-32 flex-wrap gap-1.5 overflow-y-auto pr-1'>
      {query.data.map((modelName) => (
        <li key={modelName} className='max-w-full'>
          <Badge
            variant='secondary'
            className='h-auto max-w-full py-1 text-left text-sm [overflow-wrap:anywhere] whitespace-normal'
          >
            {modelName}
          </Badge>
        </li>
      ))}
    </ul>
  )
}
