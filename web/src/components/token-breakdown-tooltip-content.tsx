import { useTranslation } from 'react-i18next'

import { toIntlLocale } from '@/i18n/languages'
import { formatNumber } from '@/lib/format'

export function TokenBreakdownTooltipContent(props: {
  totalTokens?: number
  unit?: 'count' | '100M'
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
}) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const formatter = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  const rows = [
    { label: t('Input'), value: props.inputTokens },
    { label: t('Output'), value: props.outputTokens },
    { label: t('Cache Read'), value: props.cacheReadTokens },
    { label: t('Cache Write'), value: props.cacheWriteTokens },
  ]

  return (
    <div
      data-slot='token-breakdown'
      className='text-background w-[17rem] space-y-2.5 font-mono text-xs'
    >
      {props.totalTokens !== undefined && (
        <div className='flex items-baseline justify-between gap-4'>
          <span>{t('Total Tokens')}</span>
          <span className='font-semibold'>
            {formatter.format(props.totalTokens / 100_000_000)} {t('100M')}
          </span>
        </div>
      )}
      <div
        className={
          props.totalTokens === undefined
            ? 'space-y-2.5'
            : 'border-border/40 space-y-2.5 border-t pt-2.5'
        }
      >
        {rows.map((row) => (
          <div
            key={row.label}
            className='flex items-baseline justify-between gap-4'
          >
            <span className='font-medium'>{row.label}</span>
            <span>
              {props.unit === 'count'
                ? formatNumber(row.value, locale)
                : `${formatter.format(row.value / 100_000_000)} ${t('100M')}`}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
