import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

type ModelRecommendationScenariosProps = {
  scenarios?: string[]
  compact?: boolean
}

export function ModelRecommendationScenarios(
  props: ModelRecommendationScenariosProps
) {
  const { t } = useTranslation()

  // Preset scenarios are stored as their i18n key; custom text falls through
  // to the key itself, which is exactly what should be displayed.
  const scenarios = (props.scenarios ?? []).filter((scenario) =>
    scenario.trim()
  )
  if (scenarios.length === 0) return null

  return (
    <div
      role='list'
      aria-label={t('Scenario')}
      className={cn(
        'flex min-w-0 flex-wrap items-center gap-1.5',
        props.compact ? 'mt-1.5' : 'mt-3 gap-2'
      )}
    >
      {scenarios.map((scenario) => (
        <span
          key={scenario}
          role='listitem'
          className={cn(
            'border border-amber-300/60 bg-amber-500/8 text-amber-800 dark:border-amber-700/60 dark:bg-amber-400/10 dark:text-amber-300',
            props.compact
              ? 'rounded-md px-2 py-0.5 text-xs leading-4'
              : 'rounded-md px-2.5 py-1 text-[13px] leading-4'
          )}
        >
          {t(scenario)}
        </span>
      ))}
    </div>
  )
}
