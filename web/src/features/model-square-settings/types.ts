/**
 * Preset scenario values are the i18n keys themselves, so the stored value
 * renders through `t(value)` in every locale. Custom values are stored and
 * displayed verbatim.
 */
export const MODEL_SQUARE_SCENARIO_PRESETS = [
  'General recommendations',
  'Image generation',
  'Self-hosted models',
] as const

export const MODEL_SQUARE_MAX_SCENARIOS = 10
export const MODEL_SQUARE_MAX_SCENARIO_LENGTH = 40

export type ModelSquareRecommendation = {
  model_name: string
  /** Ordered, possibly empty list of usage scenarios. */
  scenarios: string[]
  reason?: string
  enabled: boolean
}

export type ModelSquareConfig = {
  enabled: boolean
  recommendations: ModelSquareRecommendation[]
}

export type ModelSquareConfigData = {
  data: ModelSquareConfig
  models: string[]
}
