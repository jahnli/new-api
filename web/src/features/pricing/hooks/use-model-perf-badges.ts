import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import { getPerfMetricsSummary } from '@/features/performance-metrics/api'
import { requireServerSuccess } from '@/lib/server-error-message'

import type { ModelPerfBadgeData } from '../components/model-perf-badge'

/**
 * Last-24-hours performance metrics keyed by model name, shared by every surface
 * that renders model cards (grid and recommendation shelf). Only the model names
 * the caller actually displays are requested so recent status samples come back
 * without gaps.
 */
export function useModelPerfBadges(modelNames: string[]) {
  const recentModels = modelNames.map((modelName) => modelName || '')
  const perfQuery = useQuery({
    queryKey: ['perf-metrics-summary', 24, recentModels],
    queryFn: async () =>
      requireServerSuccess(await getPerfMetricsSummary(24, recentModels)),
    enabled: recentModels.length > 0,
    staleTime: 60 * 1000,
    retry: false,
  })

  return useMemo(() => {
    const map = new Map<string, ModelPerfBadgeData>()
    for (const model of perfQuery.data?.data?.models ?? []) {
      map.set(model.model_name, {
        ...model,
        window_start: perfQuery.data?.data.window_start,
        window_end: perfQuery.data?.data.window_end,
      })
    }
    for (const [name, series] of Object.entries(
      perfQuery.data?.data?.recent_success_series ?? {}
    )) {
      map.set(name, {
        avg_latency_ms: Number.NaN,
        avg_tps: Number.NaN,
        success_rate: Number.NaN,
        ...map.get(name),
        recent_success_series: series,
      })
    }
    return map
  }, [perfQuery.data])
}
