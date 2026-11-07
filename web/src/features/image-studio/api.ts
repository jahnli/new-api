import { t } from 'i18next'

import { api, getFreshAuthHeaders } from '@/lib/api'
import { createServerError } from '@/lib/server-error-message'

import { API_ENDPOINTS, DEFAULT_HISTORY_DISPLAY_LIMIT } from './constants'
import { isGptImageModel } from './lib/model-params/gpt-image/config'
import {
  supportsGptImageMarkup,
  validateGptImageEditLayer,
  validateGptImageReference,
} from './lib/model-params/gpt-image/edit-input'
import type {
  GroupOption,
  ImageApiResponse,
  ImageGenerationPayload,
  ImageStudioGenerationRecord,
  ModelOption,
  StoreImageStudioGenerationPayload,
} from './types'

export interface AppendImageStudioGenerationImagePayload {
  src: string
  revised_prompt?: string
}

export interface ImageRequestResult {
  response: ImageApiResponse
  requestId: string
}

export type ImagePreviewCallback = (src: string | null) => void
export type ImageCompletedCallback = (
  result: ImageRequestResult
) => Promise<void>

async function postImageRequest(
  endpoint: string,
  payload: ImageGenerationPayload,
  signal?: AbortSignal,
  onPreview?: ImagePreviewCallback,
  onCompleted?: ImageCompletedCallback
): Promise<ImageRequestResult> {
  let body: ImageGenerationPayload | FormData = payload
  if (
    endpoint === API_ENDPOINTS.IMAGE_EDITS &&
    isGptImageModel(payload.model)
  ) {
    const references = (payload.image ?? []).map((dataUrl) => ({
      id: '',
      name: '',
      dataUrl,
    }))
    if (references.length < 1 || references.length > 16) {
      throw new Error(
        t('Image edits require between 1 and 16 reference images')
      )
    }
    for (const image of references) validateGptImageReference(image)
    if (payload.mask && payload.markup) {
      throw new Error(t('Mask and markup cannot be combined'))
    }
    if (payload.mask && payload.output_format === 'gif') {
      throw new Error(t('GIF output does not support masks'))
    }
    if (payload.markup && !supportsGptImageMarkup(payload.model)) {
      throw new Error(t('This image model does not support markup'))
    }
    for (const key of ['mask', 'markup'] as const) {
      if (payload[key]) {
        await validateGptImageEditLayer(
          { id: '', name: '', dataUrl: payload[key] },
          references[0],
          key
        )
      }
    }
    const form = new FormData()
    for (const [key, value] of Object.entries(payload)) {
      if (
        value === undefined ||
        key === 'image' ||
        key === 'mask' ||
        key === 'markup'
      ) {
        continue
      }
      form.append(key, String(value))
    }
    for (const [index, src] of (payload.image ?? []).entries()) {
      const blob = await (await fetch(src, { signal })).blob()
      form.append('image[]', blob, `image-${index}.${blob.type.split('/')[1]}`)
    }
    for (const key of ['mask', 'markup'] as const) {
      if (!payload[key]) continue
      const blob = await (await fetch(payload[key], { signal })).blob()
      form.append(key, blob, `${key}.png`)
    }
    body = form
  }
  if (payload.stream) {
    const headers = new Headers(await getFreshAuthHeaders())
    headers.set('Accept', 'text/event-stream')
    if (body instanceof FormData) headers.delete('Content-Type')
    else headers.set('Content-Type', 'application/json')
    const res = await fetch(endpoint, {
      method: 'POST',
      credentials: 'include',
      headers,
      body: body instanceof FormData ? body : JSON.stringify(body),
      signal,
    })
    if (!res.ok || !res.body) {
      throw createServerError(
        await res.json().catch(() => ({ status: res.status }))
      )
    }
    const requestId = res.headers.get('x-oneapi-request-id') ?? ''
    if (!res.headers.get('content-type')?.includes('text/event-stream')) {
      const response = (await res.json()) as ImageApiResponse
      await onCompleted?.({ response, requestId })
      return { response, requestId }
    }
    const response: ImageApiResponse = { data: [] }
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    try {
      for (;;) {
        const { done, value } = await reader.read()
        buffer += done
          ? decoder.decode()
          : decoder.decode(value, { stream: true })
        const events = buffer.split(/\r?\n\r?\n/)
        buffer = done ? '' : (events.pop() ?? '')
        for (const event of events) {
          const lines = event.split(/\r?\n/)
          const data = lines
            .filter((line) => line.startsWith('data:'))
            .map((line) => line.slice(5).trimStart())
            .join('\n')
          if (!data || data === '[DONE]') continue
          const item = JSON.parse(data) as ImageApiResponse & {
            type?: string
            b64_json?: string
            error?: unknown
            message?: string
          }
          const eventType =
            item.type ??
            lines
              .find((line) => line.startsWith('event:'))
              ?.slice(6)
              .trim()
          if (item.error || eventType === 'error') throw createServerError(item)
          if (
            eventType !== 'image_generation.partial_image' &&
            eventType !== 'image_edit.partial_image' &&
            eventType !== 'image_generation.completed' &&
            eventType !== 'image_edit.completed'
          ) {
            continue
          }
          if (!item.b64_json) continue
          if (eventType.endsWith('.partial_image')) {
            const format = item.output_format ?? payload.output_format ?? 'png'
            onPreview?.(`data:image/${format};base64,${item.b64_json}`)
            continue
          }
          response.data?.push({ b64_json: item.b64_json })
          response.created = item.created
          response.background = item.background
          response.output_format = item.output_format ?? payload.output_format
          response.quality = item.quality
          response.size = item.size
          response.usage = item.usage ?? response.usage
          await onCompleted?.({
            response: { ...response, data: [{ b64_json: item.b64_json }] },
            requestId,
          })
          onPreview?.(null)
        }
        if (done) break
      }
      if (!response.data?.length) {
        throw new Error(t('Image stream ended without a completed image'))
      }
      return { response, requestId }
    } finally {
      await reader.cancel().catch(() => undefined)
      reader.releaseLock()
      onPreview?.(null)
    }
  }
  const res = await api.post(endpoint, body, {
    signal,
    skipErrorHandler: true,
    ...(body instanceof FormData
      ? { headers: { 'Content-Type': undefined } }
      : {}),
  })
  return {
    response: res.data as ImageApiResponse,
    requestId: String(res.headers?.['x-oneapi-request-id'] ?? ''),
  }
}

export function generateImages(
  payload: ImageGenerationPayload,
  signal?: AbortSignal,
  onPreview?: ImagePreviewCallback,
  onCompleted?: ImageCompletedCallback
): Promise<ImageRequestResult> {
  return postImageRequest(
    API_ENDPOINTS.IMAGE_GENERATIONS,
    payload,
    signal,
    onPreview,
    onCompleted
  )
}

export function editImages(
  payload: ImageGenerationPayload,
  signal?: AbortSignal,
  onPreview?: ImagePreviewCallback,
  onCompleted?: ImageCompletedCallback
): Promise<ImageRequestResult> {
  return postImageRequest(
    API_ENDPOINTS.IMAGE_EDITS,
    payload,
    signal,
    onPreview,
    onCompleted
  )
}

interface ApiEnvelope<T> {
  success: boolean
  data?: T
  message?: string
}

function unwrapApiData<T>(data: ApiEnvelope<T>, message: string): T {
  if (!data.success || data.data === undefined) {
    throw new Error(data.message || message)
  }
  return data.data
}

export async function storeImageStudioGeneration(
  payload: StoreImageStudioGenerationPayload,
  signal?: AbortSignal
): Promise<ImageStudioGenerationRecord | null> {
  const res = await api.post(API_ENDPOINTS.IMAGE_STUDIO_GENERATIONS, payload, {
    signal,
  })
  const result = unwrapApiData(
    res.data as ApiEnvelope<ImageStudioGenerationRecord | { persisted: false }>,
    'failed to store generated images'
  )
  return 'persisted' in result ? null : result
}

export async function appendImageStudioGenerationImage(
  generationId: string,
  payload: AppendImageStudioGenerationImagePayload,
  signal?: AbortSignal
): Promise<ImageStudioGenerationRecord | null> {
  const res = await api.post(
    `${API_ENDPOINTS.IMAGE_STUDIO_GENERATIONS}/${generationId}/images`,
    payload,
    { signal }
  )
  const result = unwrapApiData(
    res.data as ApiEnvelope<ImageStudioGenerationRecord | { persisted: false }>,
    'failed to store generated image'
  )
  return 'persisted' in result ? null : result
}

export async function getImageStudioSetting(
  signal?: AbortSignal
): Promise<{ history_enabled: boolean }> {
  const res = await api.get('/api/image-studio/setting', { signal })
  return unwrapApiData(
    res.data as ApiEnvelope<{ history_enabled: boolean }>,
    'failed to load image history settings'
  )
}

export interface ImageStudioGenerationListResult {
  records: ImageStudioGenerationRecord[]
  displayLimit: number
}

export async function listImageStudioGenerations(): Promise<ImageStudioGenerationListResult> {
  const res = await api.get(API_ENDPOINTS.IMAGE_STUDIO_GENERATIONS)
  const { data } = res
  const headerLimit = Number.parseInt(
    String(res.headers?.['x-image-studio-display-history-limit'] ?? ''),
    10
  )
  const displayLimit =
    Number.isInteger(headerLimit) && headerLimit > 0
      ? Math.min(1000, headerLimit)
      : DEFAULT_HISTORY_DISPLAY_LIMIT
  if (!data.success || !Array.isArray(data.data)) {
    return { records: [], displayLimit }
  }
  return {
    records: data.data as ImageStudioGenerationRecord[],
    displayLimit,
  }
}

export async function deleteImageStudioGeneration(id: string): Promise<void> {
  await api.delete(`${API_ENDPOINTS.IMAGE_STUDIO_GENERATIONS}/${id}`)
}

export async function clearImageStudioGenerations(): Promise<void> {
  await api.delete(API_ENDPOINTS.IMAGE_STUDIO_GENERATIONS)
}

export async function updateImageStudioGenerationFavorite(
  id: string,
  favorite: boolean
): Promise<void> {
  await api.patch(`${API_ENDPOINTS.IMAGE_STUDIO_GENERATIONS}/${id}/favorite`, {
    favorite,
  })
}

export async function updateImageStudioGenerationUsage(
  id: string,
  usage: {
    quota?: number
    promptTokens?: number
    completionTokens?: number
    channelId?: number
  }
): Promise<void> {
  await api.patch(`${API_ENDPOINTS.IMAGE_STUDIO_GENERATIONS}/${id}/usage`, {
    quota: usage.quota ?? 0,
    prompt_tokens: usage.promptTokens ?? 0,
    completion_tokens: usage.completionTokens ?? 0,
    channel_id: usage.channelId ?? 0,
  })
}

export async function getUserModels(group: string): Promise<ModelOption[]> {
  const res = await api.get(API_ENDPOINTS.USER_MODELS, {
    params: { group },
  })
  const { data } = res

  if (!data.success || !Array.isArray(data.data)) {
    return []
  }

  return data.data.map((model: string) => ({
    label: model,
    value: model,
  }))
}

export async function getUserGroups(): Promise<GroupOption[]> {
  const res = await api.get(API_ENDPOINTS.USER_GROUPS)
  const { data } = res

  if (!data.success || !data.data) {
    return []
  }

  const groupData = data.data as Record<string, { desc: string; ratio: number }>

  return Object.entries(groupData).map(([group, info]) => ({
    label: group,
    value: group,
    ratio: info.ratio,
    desc: info.desc,
  }))
}

export interface GenerationLogInfo {
  quota: number
  promptTokens: number
  completionTokens: number
  useTimeSeconds: number
  channelId: number
}

/**
 * Fetch billing info of a finished generation from the user's own logs.
 * Matched by request id when available, otherwise falls back to the
 * latest consume log of the model.
 */
export async function fetchGenerationLog(
  requestId: string,
  modelName: string
): Promise<GenerationLogInfo | null> {
  try {
    const params: Record<string, unknown> = {
      p: 1,
      page_size: 1,
      type: 2, // consume logs
    }
    if (requestId) {
      params.request_id = requestId
    } else if (modelName) {
      params.model_name = modelName
    }
    const res = await api.get('/api/log/self', { params })
    const { data } = res
    if (!data.success) return null
    const items = data.data?.items
    if (!Array.isArray(items) || items.length === 0) return null
    const log = items[0]
    return {
      quota: Number(log.quota ?? 0),
      promptTokens: Number(log.prompt_tokens ?? 0),
      completionTokens: Number(log.completion_tokens ?? 0),
      useTimeSeconds: Number(log.use_time ?? 0),
      channelId: Number(log.channel ?? 0),
    }
  } catch {
    return null
  }
}
