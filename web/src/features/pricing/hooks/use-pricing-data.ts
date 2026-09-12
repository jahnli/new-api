import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import { useStatus } from '@/hooks/use-status'
import { requireServerSuccess } from '@/lib/server-error-message'

import { getPricing } from '../api'
import type { ModelRecommendationScenario } from '../types'

export function usePricingData(enabled = true) {
  const { status } = useStatus()

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['pricing'],
    queryFn: async () => requireServerSuccess(await getPricing()),
    staleTime: 5 * 60 * 1000,
    enabled,
  })

  // Ensure rates never reach zero to prevent division errors
  const priceRate = useMemo(
    () => Math.max((status?.price as number) ?? 1, 0.001),
    [status?.price]
  )
  const usdExchangeRate = useMemo(
    () => Math.max((status?.usd_exchange_rate as number) ?? priceRate, 0.001),
    [status?.usd_exchange_rate, priceRate]
  )

  const models = useMemo(() => {
    if (!data?.data || !data?.vendors) return []

    const vendorMap = new Map(data.vendors.map((v) => [v.id, v]))
    const recommendationScenarios = new Map<
      string,
      ModelRecommendationScenario[]
    >()
    for (const recommendation of data.recommendations ?? []) {
      if (!recommendation.enabled) continue
      const scenarios = recommendationScenarios.get(recommendation.model_name)
      if (scenarios) {
        if (!scenarios.includes(recommendation.scenario)) {
          scenarios.push(recommendation.scenario)
        }
      } else {
        recommendationScenarios.set(recommendation.model_name, [
          recommendation.scenario,
        ])
      }
    }
    const groupVendorRatio = data.group_vendor_ratio || {}
    // 命中用户特殊倍率的分组优先于供应商倍率，保持后端 group_ratio 中的覆盖值
    const specialGroups = new Set(data.group_special_ratios || [])

    // 供应商倍率命中时直接替换该分组的基础倍率（非叠乘）
    const effectiveGroupRatio = (vendorId?: number): Record<string, number> => {
      if (!vendorId) return data.group_ratio
      const vendorKey = String(vendorId)
      let overridden: Record<string, number> | null = null
      for (const [group, vendorRatios] of Object.entries(groupVendorRatio)) {
        if (specialGroups.has(group)) continue
        const ratio = vendorRatios?.[vendorKey]
        if (typeof ratio === 'number' && Number.isFinite(ratio)) {
          overridden ??= { ...data.group_ratio }
          overridden[group] = ratio
        }
      }
      return overridden ?? data.group_ratio
    }

    return data.data.map((model) => {
      const vendor = model.vendor_id
        ? vendorMap.get(model.vendor_id)
        : undefined
      const scenarios = recommendationScenarios.get(model.model_name) ?? []
      return {
        ...model,
        key: model.model_name,
        is_recommended: scenarios.length > 0,
        recommendation_scenarios: scenarios,
        vendor_name: vendor?.name,
        vendor_icon: vendor?.icon,
        vendor_description: vendor?.description,
        group_ratio: effectiveGroupRatio(model.vendor_id),
      }
    })
  }, [data])

  return {
    models,
    vendors: data?.vendors ?? [],
    groupRatio: data?.group_ratio ?? {},
    usableGroup: data?.usable_group ?? {},
    endpointMap: data?.supported_endpoint ?? {},
    autoGroups: data?.auto_groups ?? [],
    isLoading,
    error,
    refetch,
    priceRate,
    usdExchangeRate,
  }
}
