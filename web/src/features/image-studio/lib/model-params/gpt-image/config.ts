import { t } from 'i18next'

import type {
  GptImageCapabilities,
  GptImageConfig,
  GptImageParameterConfig,
  GptImagePayload,
} from './types'

const CUSTOM_SIZE = 'custom'

export const GPT_IMAGE_SIZE_LABELS: Readonly<Record<string, string>> = {
  '1024x1024': '1K · 1024×1024 · 1:1',
  '1536x1024': '1.5K · 1536×1024 · 3:2',
  '1024x1536': '1.5K · 1024×1536 · 2:3',
  '2048x2048': '2K · 2048×2048 · 1:1',
  '2048x1152': '2K · 2048×1152 · 16:9',
  '1152x2048': '2K · 1152×2048 · 9:16',
  '3840x2160': '4K · 3840×2160 · 16:9',
  '2160x3840': '4K · 2160×3840 · 9:16',
}

export const DEFAULT_GPT_IMAGE_PARAMETERS: GptImageConfig = {
  family: 'gpt-image',
  size: 'auto',
  customWidth: 1024,
  customHeight: 1024,
  quality: 'auto',
  moderation: 'auto',
  n: 1,
  background: 'auto',
  outputFormat: 'png',
  outputCompression: 100,
  stream: false,
  partialImages: 0,
}

const STANDARD_CAPABILITIES: GptImageCapabilities = {
  defaultParameters: DEFAULT_GPT_IMAGE_PARAMETERS,
  sizePresets: ['1024x1024', '1536x1024', '1024x1536'],
  qualityOptions: ['auto', 'low', 'medium', 'high'],
  moderationOptions: ['auto', 'low'],
  backgroundOptions: ['auto', 'opaque', 'transparent'],
  outputFormatOptions: ['png', 'jpeg', 'webp'],
  supportsCustomSize: false,
  supportsInputFidelity: false,
  supportsComplexity: false,
  runtimeLimits: {
    maxImages: 10,
    maxReferenceImages: 16,
    maxTotalImages: null,
    usesGenerationEndpointForEdits: false,
  },
}

const GPT_IMAGE_2_CAPABILITIES: GptImageCapabilities = {
  ...STANDARD_CAPABILITIES,
  supportsCustomSize: true,
  sizePresets: [
    ...STANDARD_CAPABILITIES.sizePresets,
    '2048x2048',
    '2048x1152',
    '1152x2048',
    '3840x2160',
    '2160x3840',
  ],
}

const GPT_IMAGE_25_CAPABILITIES: GptImageCapabilities = {
  ...GPT_IMAGE_2_CAPABILITIES,
  qualityOptions: ['auto', 'low', 'medium', 'high', 'xhigh', 'max'],
}

const GPT_IMAGE_26_CAPABILITIES: GptImageCapabilities = {
  ...GPT_IMAGE_2_CAPABILITIES,
  defaultParameters: {
    ...DEFAULT_GPT_IMAGE_PARAMETERS,
    complexity: 'high',
  },
  outputFormatOptions: ['png', 'jpeg', 'webp', 'gif', 'svg'],
  supportsComplexity: true,
}

const GPT_IMAGE_15_CAPABILITIES: GptImageCapabilities = {
  ...STANDARD_CAPABILITIES,
  defaultParameters: { ...DEFAULT_GPT_IMAGE_PARAMETERS, inputFidelity: 'low' },
  supportsInputFidelity: true,
}

// Keep this list explicit: unknown aliases must not inherit unsupported options.
export function getGptImageCapabilities(
  model: string
): GptImageCapabilities | null {
  switch (model.toLowerCase()) {
    case 'gpt-image-1.5':
      return GPT_IMAGE_15_CAPABILITIES
    case 'gpt-image-1-mini':
    case 'chatgpt-image-latest':
      return STANDARD_CAPABILITIES
    case 'gpt-image-2':
    case 'gpt-image-2-2026-04-21':
      return GPT_IMAGE_2_CAPABILITIES
    case 'gpt-image-2.5-sunburst':
    case 'gpt-image-2.5-sunburst-2026-09-08':
    case 'gpt-image-2.5-flare':
    case 'gpt-image-2.5-flare-2026-09-08':
      return GPT_IMAGE_25_CAPABILITIES
    case 'gpt-image-2.6-sunburst':
    case 'gpt-image-2.6-flare':
      return GPT_IMAGE_26_CAPABILITIES
    default:
      return null
  }
}

function normalizeInteger(
  value: number | null | undefined,
  fallback: number,
  minimum: number,
  maximum: number
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(maximum, Math.max(minimum, Math.trunc(value)))
}

export const GPT_IMAGE_PARAMETERS: GptImageParameterConfig = {
  ...GPT_IMAGE_2_CAPABILITIES,
  normalizeParameters(parameters, model = 'gpt-image-2', mode = 'generate') {
    const capabilities = getGptImageCapabilities(model)
    if (!capabilities) throw new Error(`Unsupported image model: ${model}`)
    let outputFormat = parameters.outputFormat
    if (
      !capabilities.outputFormatOptions.includes(outputFormat) ||
      (outputFormat === 'svg' && mode === 'edit')
    ) {
      outputFormat = 'png'
    }
    const isGif = outputFormat === 'gif'
    const isSvg = outputFormat === 'svg'
    const supportsCompression =
      outputFormat === 'jpeg' || outputFormat === 'webp'
    const supportsTransparency =
      outputFormat === 'png' || outputFormat === 'webp'
    const supportsCustomSize = capabilities.supportsCustomSize || isGif
    let size = parameters.size
    let customWidth = Number.isFinite(parameters.customWidth)
      ? parameters.customWidth
      : 1024
    let customHeight = Number.isFinite(parameters.customHeight)
      ? parameters.customHeight
      : 1024
    const dimensions = /^(\d+)x(\d+)$/.exec(size)
    if (
      supportsCustomSize &&
      dimensions &&
      !capabilities.sizePresets.includes(size)
    ) {
      size = CUSTOM_SIZE
      customWidth = Number(dimensions[1])
      customHeight = Number(dimensions[2])
    }
    if (
      size !== 'auto' &&
      !(size === CUSTOM_SIZE && supportsCustomSize) &&
      !capabilities.sizePresets.includes(size)
    ) {
      size = 'auto'
    }
    const normalized: GptImageConfig = {
      family: 'gpt-image',
      size,
      customWidth,
      customHeight,
      quality: capabilities.qualityOptions.includes(parameters.quality)
        ? parameters.quality
        : capabilities.defaultParameters.quality,
      moderation: capabilities.moderationOptions.includes(parameters.moderation)
        ? parameters.moderation
        : 'auto',
      n: normalizeInteger(
        parameters.n,
        1,
        1,
        isSvg ? 1 : capabilities.runtimeLimits.maxImages
      ),
      background:
        capabilities.backgroundOptions.includes(parameters.background) &&
        (parameters.background !== 'transparent' || supportsTransparency)
          ? parameters.background
          : 'auto',
      outputFormat,
      outputCompression: supportsCompression
        ? normalizeInteger(parameters.outputCompression, 100, 0, 100)
        : null,
    }
    if (!isGif && !isSvg) {
      normalized.stream = parameters.stream === true
      normalized.partialImages = normalized.stream
        ? normalizeInteger(parameters.partialImages, 0, 0, 3)
        : 0
    }
    if (capabilities.supportsInputFidelity) {
      normalized.inputFidelity =
        parameters.inputFidelity === 'high' ? 'high' : 'low'
    }
    if (capabilities.supportsComplexity) {
      normalized.complexity = ['low', 'medium', 'high'].includes(
        parameters.complexity ?? ''
      )
        ? parameters.complexity
        : 'high'
    }
    if (isGif) {
      normalized.frameCount = normalizeInteger(parameters.frameCount, 9, 2, 16)
      normalized.frameDurationMs =
        Math.round(
          normalizeInteger(parameters.frameDurationMs, 200, 20, 2000) / 10
        ) * 10
    }
    return normalized
  },
  isCustomSizeValid(parameters, model = 'gpt-image-2') {
    const capabilities = getGptImageCapabilities(model)
    if (!capabilities) return false
    if (parameters.size !== CUSTOM_SIZE) return true
    const isGif =
      parameters.outputFormat === 'gif' &&
      capabilities.outputFormatOptions.includes('gif')
    if (!capabilities.supportsCustomSize && !isGif) return false
    const validDimensions =
      Number.isSafeInteger(parameters.customWidth) &&
      Number.isSafeInteger(parameters.customHeight) &&
      parameters.customWidth > 0 &&
      parameters.customHeight > 0 &&
      parameters.customWidth % 16 === 0 &&
      parameters.customHeight % 16 === 0
    if (!validDimensions) return false
    // OpenAI does not publish the GIF pixel budget; do not apply still-image limits.
    if (isGif) return true
    const aspectRatio = parameters.customWidth / parameters.customHeight
    const pixels = parameters.customWidth * parameters.customHeight
    return (
      aspectRatio >= 1 / 3 &&
      aspectRatio <= 3 &&
      parameters.customWidth <= 3840 &&
      parameters.customHeight <= 3840 &&
      pixels >= 655360 &&
      pixels <= 8294400
    )
  },
  buildPayload(parameters, mode = 'generate', model = 'gpt-image-2') {
    const normalized = this.normalizeParameters(parameters, model, mode)
    if (!this.isCustomSizeValid(normalized, model, mode)) {
      throw new Error(t('Invalid image size'))
    }
    const payload: GptImagePayload = {
      n: normalized.n,
      size:
        normalized.size === CUSTOM_SIZE
          ? `${normalized.customWidth}x${normalized.customHeight}`
          : normalized.size,
      quality: normalized.quality,
      moderation: normalized.moderation,
      background: normalized.background,
      output_format: normalized.outputFormat,
    }
    if (normalized.outputCompression !== null) {
      payload.output_compression = normalized.outputCompression
    }
    if (normalized.stream !== undefined) payload.stream = normalized.stream
    if (normalized.stream) payload.partial_images = normalized.partialImages
    if (mode === 'edit' && normalized.inputFidelity !== undefined) {
      payload.input_fidelity = normalized.inputFidelity
    }
    if (normalized.complexity !== undefined) {
      payload.complexity = normalized.complexity
    }
    if (normalized.frameCount !== undefined) {
      payload.frame_count = normalized.frameCount
    }
    if (normalized.frameDurationMs !== undefined) {
      payload.frame_duration_ms = normalized.frameDurationMs
    }
    return payload
  },
}

export function isGptImageModel(model: string): boolean {
  return getGptImageCapabilities(model) !== null
}
