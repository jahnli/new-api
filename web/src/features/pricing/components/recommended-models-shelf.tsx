import AutoScroll from 'embla-carousel-auto-scroll'
import { useEffect, useId, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel'
import { useMediaQuery } from '@/hooks/use-media-query'

import { DEFAULT_TOKEN_UNIT } from '../constants'
import { useModelPerfBadges } from '../hooks/use-model-perf-badges'
import type { PricingModel, TokenUnit } from '../types'
import { ModelCard } from './model-card'
import { ModelRecommendationBadge } from './model-recommendation-badge'

/** Pixels per frame the shelf drifts; slow enough to read a card while it moves. */
const SHELF_SCROLL_SPEED = 2
/**
 * Milliseconds AutoScroll waits before drifting again. The plugin reuses one
 * timer for the first start and for every resume, so the 1000ms default makes
 * the shelf look stuck after the pointer leaves.
 */
const SHELF_SCROLL_START_DELAY = 0

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
 * stays reachable without scrolling or clearing the active filters. The shelf
 * drifts forward on its own and loops, pausing on hover and keyboard focus.
 */
export function RecommendedModelsShelf(props: RecommendedModelsShelfProps) {
  const { t } = useTranslation()
  const headingId = useId()
  const perfMap = useModelPerfBadges()
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const [api, setApi] = useState<CarouselApi>()
  const [isScrollable, setIsScrollable] = useState(false)
  const tokenUnit = props.tokenUnit ?? DEFAULT_TOKEN_UNIT
  const recommendedModels = useMemo(
    () =>
      props.models
        .filter((model) => model.is_recommended)
        // The shelf mirrors the admin's configured order; models without a
        // rank keep their catalog position because sort is stable.
        .sort(
          (a, b) =>
            (a.recommendation_rank ?? Number.MAX_SAFE_INTEGER) -
            (b.recommendation_rank ?? Number.MAX_SAFE_INTEGER)
        ),
    [props.models]
  )
  const plugins = useMemo(
    () =>
      prefersReducedMotion
        ? []
        : [
            AutoScroll({
              speed: SHELF_SCROLL_SPEED,
              startDelay: SHELF_SCROLL_START_DELAY,
              stopOnMouseEnter: true,
              stopOnInteraction: false,
              // Pausing is scoped to the slides' viewport, which is embla's
              // default root node: pointing at the heading row keeps the drift
              // running, so the arrows have to stop it themselves.
            }),
          ],
    [prefersReducedMotion]
  )

  // The drift keeps advancing under the pointer unless a slide is hovered, so an
  // arrow stops it first and lets it resume once the scroll has settled.
  const step = (direction: 'prev' | 'next') => {
    api?.plugins().autoScroll?.reset()
    if (direction === 'prev') {
      api?.scrollPrev()
      return
    }
    api?.scrollNext()
  }

  useEffect(() => {
    if (!api) return
    const measure = () =>
      setIsScrollable(
        api.containerNode().scrollWidth > api.rootNode().clientWidth
      )
    measure()
    api.on('reInit', measure).on('resize', measure)
    return () => {
      api.off('reInit', measure).off('resize', measure)
    }
  }, [api])

  if (recommendedModels.length === 0) return null

  return (
    <Carousel
      setApi={setApi}
      aria-labelledby={headingId}
      opts={{ align: 'start', dragFree: true, loop: true }}
      plugins={plugins}
      className='min-w-0'
    >
      <div className='mb-1 flex items-center justify-between gap-3'>
        <h2 id={headingId} className='flex items-center'>
          <ModelRecommendationBadge
            prominent
            label={t('Recommended models')}
            count={recommendedModels.length}
          />
        </h2>
        {isScrollable && (
          <div className='flex shrink-0 items-center gap-1.5'>
            <CarouselPrevious
              className='static top-auto left-auto translate-y-0'
              onClick={() => step('prev')}
            />
            <CarouselNext
              className='static top-auto right-auto translate-y-0'
              onClick={() => step('next')}
            />
          </div>
        )}
      </div>
      <CarouselContent className='pt-4 pb-1'>
        {recommendedModels.map((model) => (
          <CarouselItem
            key={model.id ?? model.model_name}
            className='basis-[88%] pl-4 sm:basis-[380px]'
          >
            <ModelCard
              model={model}
              showRecommendationBadge={false}
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
