import { Star } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

import '@/styles/model-recommendation.css'

export function ModelRecommendationBadge(props: { prominent?: boolean }) {
  const { t } = useTranslation()

  return (
    <span
      className={cn(
        'inline-flex max-w-full shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-[11px] leading-4 font-normal text-amber-800 dark:text-amber-300',
        props.prominent
          ? 'model-recommendation-glow relative isolate gap-1.5 rounded-lg border border-amber-300/70 bg-amber-50 px-3.5 py-0.75 text-sm leading-4 shadow-xs dark:border-amber-700/70 dark:bg-amber-950'
          : 'bg-amber-500/10 dark:bg-amber-400/10'
      )}
    >
      <Star
        aria-hidden='true'
        className={cn(
          'shrink-0 fill-amber-500 text-amber-500 dark:fill-amber-400 dark:text-amber-400',
          props.prominent ? 'model-recommendation-breathe size-4' : 'size-3'
        )}
        strokeWidth={1.5}
      />
      <span className='min-w-0 truncate'>{t('Recommended')}</span>
    </span>
  )
}
