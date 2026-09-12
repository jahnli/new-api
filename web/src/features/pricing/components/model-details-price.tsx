import { useTranslation } from 'react-i18next'

import { DEMO_MODE_MASK } from '@/lib/demo-mode'
import { useSystemConfigStore } from '@/stores/system-config-store'

import { FILTER_ALL } from '../constants'
import { useBillingTime } from '../hooks/use-billing-time'
import {
  getDynamicDisplayGroupRatio,
  getDynamicPriceUnitLabelKey,
  getDynamicPricingSummary,
  isUnconfiguredTaskUsageModel,
  type DynamicPriceEntry,
} from '../lib/dynamic-price'
import { isTokenBasedModel } from '../lib/model-helpers'
import { formatPrice, formatRequestPrice } from '../lib/price'
import type { PriceType, PricingModel, TokenUnit } from '../types'

function SectionTitle(props: { children: React.ReactNode }) {
  return (
    <h2 className='text-muted-foreground mb-3 text-xs font-semibold tracking-wider uppercase'>
      {props.children}
    </h2>
  )
}

function DynamicPriceEntryLabel(props: { entry: DynamicPriceEntry }) {
  const { t } = useTranslation()
  if (props.entry.labelKind === 'schema') {
    return <code className='font-mono'>{props.entry.shortLabel}</code>
  }
  return t(props.entry.shortLabel)
}

export function PriceSection(props: {
  model: PricingModel
  priceRate: number
  usdExchangeRate: number
  tokenUnit: TokenUnit
  showRechargePrice: boolean
  selectedGroup?: string
  currentUserGroup?: string
  maskPrices?: boolean
}) {
  const { t } = useTranslation()

  const isTokenBased = isTokenBasedModel(props.model)
  const tokenUnitLabel = props.tokenUnit === 'K' ? '1K' : '1M'
  const billingTime = useBillingTime(props.model.billing_expr)
  // Currency is read indirectly by the price formatter; subscribe so a
  // currency change re-renders the base price card.
  useSystemConfigStore((state) => state.config.currency)
  let pricingGroup = props.currentUserGroup
  if (props.selectedGroup && props.selectedGroup !== FILTER_ALL) {
    pricingGroup = props.selectedGroup
  }
  const dynamicSummary = getDynamicPricingSummary(props.model, {
    now: billingTime === undefined ? undefined : new Date(billingTime),
    tokenUnit: props.tokenUnit,
    showRechargePrice: props.showRechargePrice,
    priceRate: props.priceRate,
    usdExchangeRate: props.usdExchangeRate,
    groupRatioMultiplier: getDynamicDisplayGroupRatio(
      props.model,
      pricingGroup
    ),
  })

  const primaryPriceTypes: { label: string; type: PriceType }[] = [
    { label: t('Input'), type: 'input' },
    { label: t('Output'), type: 'output' },
  ]
  const secondaryPriceTypes: {
    label: string
    type: PriceType
    available: boolean
  }[] = [
    {
      label: t('Cached input'),
      type: 'cache',
      available: props.model.cache_ratio != null,
    },
    {
      label: t('Cache write'),
      type: 'create_cache',
      available: props.model.create_cache_ratio != null,
    },
    {
      label: t('Image input'),
      type: 'image',
      available: props.model.image_ratio != null,
    },
    {
      label: t('Audio input'),
      type: 'audio_input',
      available: props.model.audio_ratio != null,
    },
    {
      label: t('Audio output'),
      type: 'audio_output',
      available:
        props.model.audio_ratio != null &&
        props.model.audio_completion_ratio != null,
    },
  ]

  if (dynamicSummary) {
    if (dynamicSummary.isSpecialExpression) {
      return (
        <section>
          <SectionTitle>{t('Base Price')}</SectionTitle>
          <div className='rounded-lg border border-amber-200/70 bg-amber-50/70 p-3 dark:border-amber-500/20 dark:bg-amber-500/10'>
            <div className='text-sm font-medium text-amber-800 dark:text-amber-200'>
              {t('Special billing expression')}
            </div>
            <p className='text-muted-foreground mt-1 text-xs'>
              {t('Unable to parse structured pricing')}
            </p>
            <div className='mt-3'>
              <div className='text-muted-foreground mb-1 text-[10px] font-medium tracking-wider uppercase'>
                {t('Raw expression')}
              </div>
              <code className='text-muted-foreground bg-background/80 block max-h-28 overflow-auto rounded-md border px-2 py-1.5 font-mono text-xs break-all'>
                {props.maskPrices
                  ? DEMO_MODE_MASK
                  : dynamicSummary.rawExpression}
              </code>
            </div>
          </div>
        </section>
      )
    }

    return (
      <section>
        <SectionTitle>{t('Base Price')}</SectionTitle>
        {dynamicSummary.primaryEntries.length > 0 ? (
          <div className='grid grid-cols-2 gap-2'>
            {dynamicSummary.primaryEntries.map((entry) => {
              const unitLabelKey = getDynamicPriceUnitLabelKey(entry)
              const displayedPrice = props.maskPrices
                ? DEMO_MODE_MASK
                : (entry.formattedRange ?? entry.formatted)
              return (
                <div
                  key={entry.key}
                  className='bg-muted/20 rounded-lg border p-3'
                >
                  <div className='text-muted-foreground text-xs'>
                    <DynamicPriceEntryLabel entry={entry} />
                  </div>
                  <div className='text-foreground mt-1 font-mono text-base font-semibold tabular-nums'>
                    {displayedPrice}
                    <span className='text-muted-foreground/40 ml-1 text-xs font-normal'>
                      / {unitLabelKey ? t(unitLabelKey) : tokenUnitLabel}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <p className='text-muted-foreground text-sm'>
            {t('Dynamic Pricing')}
          </p>
        )}
        {dynamicSummary.secondaryEntries.length > 0 && (
          <div className='bg-muted/20 mt-3 rounded-lg border px-3 py-2.5'>
            <div className='space-y-1.5'>
              {dynamicSummary.secondaryEntries.map((entry) => {
                const unitLabelKey = getDynamicPriceUnitLabelKey(entry)
                return (
                  <div
                    key={entry.key}
                    className='flex items-baseline justify-between gap-4'
                  >
                    <span className='text-muted-foreground/70 text-sm'>
                      <DynamicPriceEntryLabel entry={entry} />
                    </span>
                    <span className='text-muted-foreground font-mono text-sm tabular-nums'>
                      {props.maskPrices ? DEMO_MODE_MASK : entry.formatted}
                      <span className='text-muted-foreground/40 ml-1 text-xs font-normal'>
                        / {unitLabelKey ? t(unitLabelKey) : tokenUnitLabel}
                      </span>
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </section>
    )
  }

  if (isUnconfiguredTaskUsageModel(props.model)) {
    return (
      <section>
        <SectionTitle>{t('Base Price')}</SectionTitle>
        <div className='bg-muted/20 rounded-lg border p-3'>
          <p className='text-foreground text-sm font-medium'>
            {t('Usage-based billing · price not configured')}
          </p>
          <p className='text-muted-foreground mt-1 text-xs'>
            {t(
              'This model is billed by usage, but the administrator has not configured its pricing yet.'
            )}
          </p>
        </div>
      </section>
    )
  }

  if (!isTokenBased) {
    return (
      <section>
        <SectionTitle>{t('Base Price')}</SectionTitle>
        <div className='flex items-baseline justify-between'>
          <span className='text-muted-foreground text-sm'>
            {t('Per request')}
          </span>
          <span className='text-foreground font-mono text-sm font-semibold tabular-nums'>
            {props.maskPrices
              ? DEMO_MODE_MASK
              : formatRequestPrice(
                  props.model,
                  props.showRechargePrice,
                  props.priceRate,
                  props.usdExchangeRate,
                  pricingGroup
                )}
          </span>
        </div>
      </section>
    )
  }

  const secondaryItems = secondaryPriceTypes.filter((p) => p.available)
  const renderPrice = (type: PriceType) => (
    <>
      {props.maskPrices
        ? DEMO_MODE_MASK
        : formatPrice(
            props.model,
            type,
            props.tokenUnit,
            props.showRechargePrice,
            props.priceRate,
            props.usdExchangeRate,
            pricingGroup
          )}
      <span className='text-muted-foreground/40 ml-1 text-xs font-normal'>
        / {tokenUnitLabel}
      </span>
    </>
  )

  return (
    <section>
      <SectionTitle>{t('Base Price')}</SectionTitle>
      <div className='grid grid-cols-2 gap-2'>
        {primaryPriceTypes.map((item) => (
          <div key={item.type} className='bg-muted/20 rounded-lg border p-3'>
            <div className='text-muted-foreground text-xs'>{item.label}</div>
            <div className='text-foreground mt-1 font-mono text-base font-semibold tabular-nums'>
              {renderPrice(item.type)}
            </div>
          </div>
        ))}
      </div>
      {secondaryItems.length > 0 && (
        <div className='bg-muted/20 mt-3 rounded-lg border px-3 py-2.5'>
          <div className='space-y-1.5'>
            {secondaryItems.map((item) => (
              <div
                key={item.type}
                className='flex items-baseline justify-between gap-4'
              >
                <span className='text-muted-foreground/70 text-sm'>
                  {item.label}
                </span>
                <span className='text-muted-foreground font-mono text-sm tabular-nums'>
                  {renderPrice(item.type)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
