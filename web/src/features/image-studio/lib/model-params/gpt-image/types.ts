import type { ImageGenerationPayload, StudioMode } from '../../../types'

export interface GptImageConfig {
  family: 'gpt-image'
  size: string
  customWidth: number
  customHeight: number
  quality: string
  moderation: string
  n: number
  background: string
  outputFormat: string
  outputCompression: number | null
  inputFidelity?: string
  stream?: boolean
  partialImages?: number
  complexity?: string
  frameCount?: number
  frameDurationMs?: number
}

export type GptImageConfigUpdater = <Key extends keyof GptImageConfig>(
  key: Key,
  value: GptImageConfig[Key]
) => void

export interface GptImageCapabilities {
  defaultParameters: GptImageConfig
  sizePresets: readonly string[]
  qualityOptions: readonly string[]
  moderationOptions: readonly string[]
  backgroundOptions: readonly string[]
  outputFormatOptions: readonly string[]
  supportsCustomSize: boolean
  supportsInputFidelity: boolean
  supportsComplexity: boolean
  runtimeLimits: {
    maxImages: number
    maxReferenceImages: number
    maxTotalImages: null
    usesGenerationEndpointForEdits: false
  }
}

export type GptImagePayload = Partial<ImageGenerationPayload>

export interface GptImageParameterConfig extends GptImageCapabilities {
  normalizeParameters: (
    parameters: GptImageConfig,
    model?: string,
    mode?: StudioMode
  ) => GptImageConfig
  isCustomSizeValid: (
    parameters: GptImageConfig,
    model?: string,
    mode?: StudioMode
  ) => boolean
  buildPayload: (
    parameters: GptImageConfig,
    mode?: StudioMode,
    model?: string
  ) => GptImagePayload
}
