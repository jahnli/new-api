import type { GptImageConfig } from './lib/model-params/gpt-image/types'
import type { SeedreamConfig } from './lib/model-params/seedream/types'

export type StudioMode = 'generate' | 'edit'

export type ImageStudioParameters = GptImageConfig | SeedreamConfig

export interface ImageStudioConfig {
  group: string
  model: string
  parameters: ImageStudioParameters
}

export interface ModelOption {
  label: string
  value: string
}

export interface GroupOption {
  label: string
  value: string
  ratio: number
  desc: string
}

export interface ReferenceImage {
  id: string
  dataUrl: string
  name: string
}

export interface GeneratedImage {
  id: string
  /** Stored image URL or a temporary source returned by the provider. */
  src: string
  storageId?: string
  mimeType?: string
  sizeBytes?: number
  width?: number
  height?: number
  revisedPrompt?: string
}

export interface GenerationUsage {
  durationMs: number
  quota?: number
  promptTokens?: number
  completionTokens?: number
  channelId?: number
}

export interface ImageGenerationError {
  id: string
  message: string
}

export interface GenerationRecord {
  id: string
  /** Temporary page state; never saved or shown in persistent history. */
  transient?: boolean
  createdAt: number
  mode: StudioMode
  prompt: string
  model: string
  group: string
  /** Exact family parameters used for this generation. */
  parameterSnapshot?: ImageStudioParameters
  /** Legacy display fields retained for stored records created before snapshots. */
  size: string
  quality?: string
  moderation?: string
  outputFormat?: string
  n: number
  images: GeneratedImage[]
  failedImageCount?: number
  imageErrors?: string[]
  usage?: GenerationUsage
  channelId?: number
  favorite?: boolean
  referenceImages?: ReferenceImage[]
}

export interface ImageGenerationPayload {
  model: string
  group?: string
  prompt: string
  size?: string
  quality?: string
  moderation?: string
  background?: string
  output_format?: string
  output_compression?: number
  response_format?: string
  watermark?: boolean
  sequential_image_generation?: 'disabled' | 'auto'
  sequential_image_generation_options?: { max_images: number }
  optimize_prompt_options?: { mode: 'standard' | 'fast' }
  image?: string[]
}

export interface ImageApiResponseData {
  url?: string
  b64_json?: string
  revised_prompt?: string
}

export interface ImageApiResponse {
  created?: number
  data?: ImageApiResponseData[]
}

export interface StoredImageAsset {
  id: string
  url: string
  mime_type: string
  size_bytes: number
  width?: number
  height?: number
  revised_prompt?: string
}

export interface ImageStudioGenerationRecord {
  id: string
  created_at: number
  mode: StudioMode
  prompt: string
  model: string
  group: string
  parameter_snapshot?: ImageStudioParameters
  size: string
  quality?: string
  moderation?: string
  output_format?: string
  n: number
  duration_ms: number
  quota?: number
  prompt_tokens?: number
  completion_tokens?: number
  channel_id?: number
  favorite?: boolean
  images: StoredImageAsset[]
}

export interface StoreImageStudioGenerationPayload {
  id: string
  created_at: number
  mode: StudioMode
  prompt: string
  model: string
  group: string
  parameter_snapshot?: ImageStudioParameters
  size: string
  quality?: string
  moderation?: string
  output_format?: string
  n: number
  duration_ms: number
  images: Array<{
    src: string
    revised_prompt?: string
  }>
}

export interface PromptPreset {
  /** i18n key of the category */
  category: string
  prompts: string[]
}
