import { Box } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { DescriptionTooltip } from '@/components/description-tooltip'
import { EmptyState } from '@/components/empty-state'
import { LoadingState } from '@/components/loading-state'
import { LongText } from '@/components/long-text'
import { TextTooltip } from '@/components/text-tooltip'
import type { QuotaDataItem } from '@/features/dashboard/types'
import { toIntlLocale } from '@/i18n/languages'
import { formatNumber } from '@/lib/format'
import { getLobeIcon } from '@/lib/lobe-icon'
import { resolveModelProvider } from '@/lib/model-provider'

export function TopModelsSummary(props: {
  data?: QuotaDataItem[]
  loading: boolean
}) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const topModels = useMemo(() => {
    const counts = new Map<string, number>()
    for (const item of props.data ?? []) {
      const count = Number(item.count)
      if (!item.model_name || !Number.isFinite(count) || count <= 0) continue
      counts.set(item.model_name, (counts.get(item.model_name) ?? 0) + count)
    }
    return [...counts]
      .sort(
        ([nameA, countA], [nameB, countB]) =>
          countB - countA || nameA.localeCompare(nameB)
      )
      .slice(0, 3)
  }, [props.data])

  return (
    <section
      className='flex min-w-0 flex-col gap-2 border-t pt-3 2xl:flex-row 2xl:items-center 2xl:gap-4'
      aria-label={t('Frequently used models')}
      aria-busy={props.loading}
    >
      <div className='flex shrink-0 items-center gap-1'>
        <h4 className='text-muted-foreground text-[13px] leading-4 font-medium'>
          {t('Frequently used models')}
        </h4>
        <DescriptionTooltip
          description={t('Ranked by request count in the selected time range.')}
        />
      </div>
      {props.loading && (
        <LoadingState inline size='sm' message={t('Loading...')} />
      )}
      {!props.loading && topModels.length === 0 && (
        <EmptyState className='min-h-0 p-2' />
      )}
      {!props.loading && topModels.length > 0 && (
        <ol className='grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-3'>
          {topModels.map(([model, count]) => {
            const provider = resolveModelProvider(model)

            return (
              <li
                key={model}
                className='bg-muted/40 flex min-w-0 items-center gap-2 rounded-lg px-2.5 py-2'
              >
                <TextTooltip content={provider?.label ?? provider?.name}>
                  <span
                    className='flex size-5 shrink-0 items-center justify-center [&_svg]:pointer-events-none'
                    role='img'
                    aria-label={provider?.label ?? provider?.name ?? model}
                  >
                    {provider ? (
                      getLobeIcon(provider.icon, 18)
                    ) : (
                      <Box className='text-muted-foreground size-4.5' />
                    )}
                  </span>
                </TextTooltip>
                <LongText className='min-w-0 flex-1 font-mono text-[13px] leading-4'>
                  {model}
                </LongText>
                <span className='text-muted-foreground shrink-0 text-[13px] leading-4 tabular-nums'>
                  {t('Requests: {{value}}', {
                    value: formatNumber(count, locale),
                  })}
                </span>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
