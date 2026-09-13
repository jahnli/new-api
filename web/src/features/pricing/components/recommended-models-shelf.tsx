import { Star } from 'lucide-react'
import { useId, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel'

import { DEFAULT_TOKEN_UNIT } from '../constants'
import { useModelPerfBadges } from '../hooks/use-model-perf-badges'
import type { PricingModel, TokenUnit } from '../types'
import { ModelCard } from './model-card'

export interface RecommendedModelsShelfProps {
  models: PricingModel[]
  onModelClick: (modelName: string) => void
  priceRate?: number
  usdExchangeRate?: number
  tokenUnit?: TokenUnit
  showRechargePrice?: boolean
  selectedGroup?: string
  currentUserGroup?: string
  maskPrices?: boolean
}

/**
 * Curated recommendations pinned above the catalog so every recommended model
 * stays reachable without scrolling or clearing the active filters.
 */
export function RecommendedModelsShelf(props: RecommendedModelsShelfProps) {
  const { t } = useTranslation()
  const headingId = useId()
  const perfMap = useModelPerfBadges()
  const tokenUnit = props.tokenUnit ?? DEFAULT_TOKEN_UNIT
  const recommendedModels = useMemo(
    () => props.models.filter((model) => model.is_recommended),
    [props.models]
  )

  if (recommendedModels.length === 0) return null

  return (
    <Carousel
      aria-labelledby={headingId}
      opts={{ align: 'start', dragFree: true }}
      className='min-w-0'
    >
      <div className='mb-1 flex items-center justify-between gap-3'>
        <h2
          id={headingId}
          className='flex items-center gap-1.5 text-sm font-semibold'
        >
          <Star
            aria-hidden='true'
            strokeWidth={1.5}
            className='size-4 fill-amber-500 text-amber-500 dark:fill-amber-400 dark:text-amber-400'
          />
          {t('Recommended models')}
        </h2>
        <div className='flex shrink-0 items-center gap-1.5'>
          <CarouselPrevious className='static top-auto left-auto translate-y-0' />
          <CarouselNext className='static top-auto right-auto translate-y-0' />
        </div>
      </div>
      <CarouselContent className='pt-4 pb-1'>
        {recommendedModels.map((model) => (
          <CarouselItem
            key={model.id ?? model.model_name}
            className='basis-[85%] pl-4 sm:basis-[340px]'
          >
            <ModelCard
              model={model}
              tokenUnit={tokenUnit}
              priceRate={props.priceRate}
              usdExchangeRate={props.usdExchangeRate}
              showRechargePrice={props.showRechargePrice}
              selectedGroup={props.selectedGroup}
              currentUserGroup={props.currentUserGroup}
              maskPrices={props.maskPrices}
              perf={perfMap.get(model.model_name || '')}
              onClick={() => props.onModelClick(model.model_name || '')}
            />
          </CarouselItem>
        ))}
      </CarouselContent>
    </Carousel>
  )
}
