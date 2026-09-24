import { useTranslation } from 'react-i18next'

import { toIntlLocale } from '@/i18n/languages'

export function TokenBreakdownTooltipContent(props: {
  totalTokens: number
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
    <div className='text-background w-[17rem] space-y-2.5 font-mono text-xs'>
      <div className='flex items-baseline justify-between gap-4'>
        <span>{t('Total Tokens')}</span>
        <span className='font-semibold'>
          {formatter.format(props.totalTokens / 100_000_000)} {t('100M')}
        </span>
      </div>
      <div className='border-border/40 space-y-2.5 border-t pt-2.5'>
        {rows.map((row) => (
          <div
            key={row.label}
            className='flex items-baseline justify-between gap-4'
          >
            <span className='font-medium'>{row.label}</span>
            <span>
              {formatter.format(row.value / 100_000_000)} {t('100M')}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
