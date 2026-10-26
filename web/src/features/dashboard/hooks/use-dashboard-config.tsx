import {
  Hash,
  Coins,
  DollarSign,
  Layers,
  Download,
  Upload,
  Gauge,
  Zap,
  Flame,
  TrendingUp,
  Activity,
  type LucideIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { IconBadgeTone } from '@/components/ui/icon-badge'
import { safeDivide } from '@/features/dashboard/lib'
import { calculateUnitPricePer100MTokens } from '@/lib/unit-price'

interface StatCardConfig {
  key: string
  title: string
  description: string
  icon: LucideIcon
  iconTone: IconBadgeTone
  getValue: (stat: Record<string, number>, days?: number) => number
}

export function useModelStatCardsConfig(): StatCardConfig[] {
  const { t } = useTranslation()

  return [
    {
      key: 'tokens',
      title: t('Total Tokens'),
      description: t('Statistical tokens'),
      icon: Layers,
      iconTone: 'chart-4',
      getValue: (stat) => stat?.tpm ?? 0,
    },
    {
      key: 'quota',
      title: t('Total Cost'),
      description: t('Statistical cost'),
      icon: Coins,
      iconTone: 'success',
      getValue: (stat) => stat?.quota ?? 0,
    },
    {
      key: 'avgPrice',
      title: t('Unit Price'),
      description: t('Unit price per 100M tokens'),
      icon: DollarSign,
      iconTone: 'warning',
      getValue: (stat) =>
        calculateUnitPricePer100MTokens(stat?.quota ?? 0, stat?.tpm ?? 0),
    },
    {
      key: 'cacheRead',
      title: t('Cache Read'),
      description: t('Statistical tokens'),
      icon: Download,
      iconTone: 'chart-3',
      getValue: (stat) => stat?.cacheRead ?? 0,
    },
    {
      key: 'cacheWrite',
      title: t('Cache Write'),
      description: t('Statistical tokens'),
      icon: Upload,
      iconTone: 'success',
      getValue: (stat) => stat?.cacheWrite ?? 0,
    },
    {
      key: 'count',
      title: t('Total Requests'),
      description: t('Statistical count'),
      icon: Hash,
      iconTone: 'info',
      getValue: (stat) => stat?.rpm ?? 0,
    },
    {
      key: 'avgRpm',
      title: t('Average RPM'),
      description: t('Requests per minute'),
      icon: Gauge,
      iconTone: 'chart-2',
      getValue: (stat, timeRangeMinutes = 1) =>
        safeDivide(stat?.rpm ?? 0, timeRangeMinutes),
    },
    {
      key: 'avgTpm',
      title: t('Average TPM'),
      description: t('Tokens per minute'),
      icon: Zap,
      iconTone: 'warning',
      getValue: (stat, timeRangeMinutes = 1) =>
        safeDivide(stat?.tpm ?? 0, timeRangeMinutes),
    },
  ]
}

export function useSummaryCardsConfig(totals: {
  todayUsageDisplay: string
  usedDisplay: string
  requestCountDisplay: string
  currencyLabel: string
  currencyEnabled: boolean
}) {
  const { t } = useTranslation()

  return [
    {
      key: 'todayUsage',
      title: t('Last 24h usage'),
      value: totals.todayUsageDisplay,
      description: totals.currencyEnabled
        ? `${t('Consumed in the last 24 hours')} (${totals.currencyLabel})`
        : t('Consumed in the last 24 hours'),
      icon: Flame,
    },
    {
      key: 'usage',
      title: t('Historical Usage'),
      value: totals.usedDisplay,
      description: totals.currencyEnabled
        ? `${t('Total consumed')} (${totals.currencyLabel})`
        : t('Total consumed quota'),
      icon: TrendingUp,
    },
    {
      key: 'requests',
      title: t('Request Count'),
      value: totals.requestCountDisplay,
      description: t('Total requests made'),
      icon: Activity,
    },
  ]
}
