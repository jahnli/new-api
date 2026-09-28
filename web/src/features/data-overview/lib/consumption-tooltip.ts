import type { TFunction } from 'i18next'

import { formatNumber } from '@/lib/format'
import { calculateUnitPricePer100MTokens } from '@/lib/unit-price'

interface ConsumptionTooltipDatum {
  name?: string
  tokens?: number
  cost?: number
  unit_price_per_100m_tokens?: number
  total_requests?: number
  uncached_input_tokens?: number
  cache_read_tokens?: number
  cache_write_tokens?: number
  common_model?: string
}

interface ConsumptionTooltip {
  title: { value: (datum: ConsumptionTooltipDatum) => string }
  content: {
    key: string
    value: (datum: ConsumptionTooltipDatum) => string
  }[]
}

export function createConsumptionTooltip(
  t: TFunction,
  locale: string | undefined,
  formatCost: (value: number) => string,
  includeCommonModel = true
): ConsumptionTooltip {
  return {
    title: { value: (datum: ConsumptionTooltipDatum) => datum.name ?? '' },
    content: [
      {
        key: t('Tokens'),
        value: (datum: ConsumptionTooltipDatum) =>
          formatNumber(datum.tokens ?? 0, locale),
      },
      {
        key: t('Cost'),
        value: (datum: ConsumptionTooltipDatum) => formatCost(datum.cost ?? 0),
      },
      {
        key: t('Unit Price'),
        value: (datum: ConsumptionTooltipDatum) => {
          if (!datum.tokens || datum.tokens <= 0) return '-'
          const unitPrice =
            datum.unit_price_per_100m_tokens ??
            calculateUnitPricePer100MTokens(datum.cost ?? 0, datum.tokens)
          return `${formatCost(unitPrice)}/${t('100M Tokens')}`
        },
      },
      {
        key: t('Request Count'),
        value: (datum: ConsumptionTooltipDatum) =>
          formatNumber(datum.total_requests, locale),
      },
      {
        key: t('Cache Hit Rate'),
        value: (datum: ConsumptionTooltipDatum) => {
          if (
            datum.uncached_input_tokens == null ||
            datum.cache_read_tokens == null ||
            datum.cache_write_tokens == null
          ) {
            return '-'
          }
          // Cache writes are misses, matching the overview statistics.
          const inputTokens =
            datum.uncached_input_tokens +
            datum.cache_read_tokens +
            datum.cache_write_tokens
          return formatNumber(
            inputTokens > 0 ? datum.cache_read_tokens / inputTokens : 0,
            locale,
            {
              style: 'percent',
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
            }
          )
        },
      },
      ...(includeCommonModel
        ? [
            {
              key: t('Common Model'),
              value: (datum: ConsumptionTooltipDatum) =>
                datum.common_model || '-',
            },
          ]
        : []),
    ],
  }
}
