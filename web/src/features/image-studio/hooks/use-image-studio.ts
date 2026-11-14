import { useCallback, useEffect, useRef, useState } from 'react'

import { handleServerError } from '@/lib/handle-server-error'

import {
  appendImageStudioGenerationImage,
  editImages,
  fetchGenerationLog,
  generateImages,
  getImageStudioSetting,
  storeImageStudioGeneration,
} from '../api'
import { DEFAULT_ESTIMATE_MS, ESTIMATE_SAMPLE_SIZE } from '../constants'
import { getImageFailures } from '../lib/image-failures'
import {
  buildImageGenerationPayload,
  getImageModelRuntimeLimits,
  normalizeConfigForModel,
  resolveParameterSize,
  restoreParametersFromRecord,
} from '../lib/model-params'
import type {
  GeneratedImage,
  GenerationRecord,
  ImageGenerationError,
  ImageStudioConfig,
  ImageStudioGenerationRecord,
  ReferenceImage,
  StudioMode,
} from '../types'

function imageMimeTypeForOutputFormat(outputFormat: string): string {
  if (outputFormat === 'jpeg') return 'image/jpeg'
  if (outputFormat === 'webp') return 'image/webp'
  if (outputFormat === 'gif') return 'image/gif'
  if (outputFormat === 'svg') return 'image/svg+xml'
  return 'image/png'
}

function extractApiErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null) {
    const maybeAxios = error as {
      response?: { data?: { error?: { message?: string }; message?: string } }
      message?: string
    }
    const apiMessage =
      maybeAxios.response?.data?.error?.message ??
      maybeAxios.response?.data?.message
    if (apiMessage) return apiMessage
    if (maybeAxios.message) return maybeAxios.message
  }
  return String(error)
}

function mapStoredImages(
  storedRecord: ImageStudioGenerationRecord,
  previousImages: GeneratedImage[] = [],
  requestIndex?: number,
  durationMs?: number
): GeneratedImage[] {
  return storedRecord.images.map((image) => {
    const previousImage = previousImages.find(
      (previous) => previous.storageId === image.id
    )
    return {
      id: image.id,
      requestIndex: previousImage ? previousImage.requestIndex : requestIndex,
      durationMs: previousImage ? previousImage.durationMs : durationMs,
      src: image.url,
      storageId: image.id,
      mimeType: image.mime_type,
      sizeBytes: image.size_bytes,
      width: image.width,
      height: image.height,
      revisedPrompt: image.revised_prompt,
    }
  })
}

export interface GenerateArgs {
  config: ImageStudioConfig
  prompt: string
  mode: StudioMode
  referenceImages: ReferenceImage[]
}

export interface RetryImageArgs {
  record: GenerationRecord
  /** The failure's immutable retryIndex, not its current array position. */
  errorIndex: number
}

export function useImageGeneration({
  history,
  addRecord,
  patchRecordLocally,
  patchRecord,
}: {
  history: GenerationRecord[]
  addRecord: (record: GenerationRecord) => void
  patchRecordLocally: (id: string, patch: Partial<GenerationRecord>) => void
  patchRecord: (id: string, patch: Partial<GenerationRecord>) => void
}) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [pendingImageIndexes, setPendingImageIndexes] = useState<number[]>([])
  const [partialImages, setPartialImages] = useState<Record<number, string>>({})
  const [imageFailures, setImageFailures] = useState<ImageGenerationError[]>([])
  const [generationError, setGenerationError] = useState<string | null>(null)
  const [activeRecordId, setActiveRecordId] = useState<string | null>(null)
  const [retryingImageErrorIndexes, setRetryingImageErrorIndexes] = useState<
    number[]
  >([])
  const retryBatchRef = useRef<{
    recordId: string
    failures: ImageGenerationError[]
    latestImages: GeneratedImage[]
    transient: boolean
    controllers: Map<string, AbortController>
    persistenceQueue: Promise<void>
  } | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const generationRunningRef = useRef(false)
  const isBusyNow = useCallback(
    () =>
      generationRunningRef.current ||
      (retryBatchRef.current?.controllers.size ?? 0) > 0,
    []
  )

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      for (const controller of retryBatchRef.current?.controllers.values() ??
        []) {
        controller.abort()
      }
    }
  }, [])

  /** moving average of recent generation durations for the model */
  const estimateDurationMs = useCallback(
    (model: string): number => {
      const samples = history
        .filter((r) => r.model === model)
        .map((r) => r.usage?.durationMs ?? 0)
        .filter((duration) => duration > 0)
        .slice(0, ESTIMATE_SAMPLE_SIZE)
      if (samples.length === 0) return DEFAULT_ESTIMATE_MS
      return samples.reduce((sum, v) => sum + v, 0) / samples.length
    },
    [history]
  )

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort()
    for (const controller of retryBatchRef.current?.controllers.values() ??
      []) {
      controller.abort()
    }
  }, [])

  const generate = useCallback(
    async ({
      config: rawConfig,
      prompt,
      mode,
      referenceImages,
    }: GenerateArgs) => {
      if (
        generationRunningRef.current ||
        (retryBatchRef.current?.controllers.size ?? 0) > 0
      ) {
        return null
      }

      const config = normalizeConfigForModel(rawConfig, mode)
      if (!config) return null
      const payload = buildImageGenerationPayload(
        { ...config, parameters: { ...config.parameters, n: 1 } },
        prompt,
        mode,
        referenceImages
      )
      const runtimeLimits = getImageModelRuntimeLimits(config.model)
      if (!runtimeLimits) {
        throw new Error(`Unsupported image model: ${config.model}`)
      }
      const requestedImageCount = Math.min(
        runtimeLimits.maxImages,
        Math.max(1, config.parameters.n)
      )
      const controller = new AbortController()
      abortRef.current = controller
      generationRunningRef.current = true
      retryBatchRef.current = null
      setIsGenerating(true)
      setIsSaving(false)
      setPendingImageIndexes(
        Array.from({ length: requestedImageCount }, (_, index) => index)
      )
      setPartialImages({})
      setImageFailures([])
      setGenerationError(null)

      const startedAt = Date.now()
      const recordId = `${startedAt}-${Math.random().toString(36).slice(2, 8)}`
      let activeRecord: GenerationRecord | null = null
      const successfulRequests: Array<{ requestId: string }> = []
      const requestErrors: string[] = []
      const requestFailures: ImageGenerationError[] = []
      let generationDurationMs = 0
      let persistenceQueue = Promise.resolve()

      try {
        const setting = await getImageStudioSetting(controller.signal)
        // SVG storage does not yet preserve its format correctly; keep these results in this session.
        let saveHistory =
          setting.history_enabled && payload.output_format !== 'svg'
        const send =
          mode === 'edit' && !runtimeLimits.usesGenerationEndpointForEdits
            ? editImages
            : generateImages
        let persistedImages: GeneratedImage[] = []
        const handleCompletedRequest = (
          requestResult: Awaited<ReturnType<typeof send>>,
          durationMs: number,
          requestIndex: number
        ) => {
          const outputFormat =
            requestResult.response.output_format ??
            payload.output_format ??
            'png'
          const imageMimeType = imageMimeTypeForOutputFormat(outputFormat)
          const imageOutputs = (requestResult.response.data ?? [])
            .map((item, index) => ({
              id: `${recordId}-request-${requestIndex}-image-${index}`,
              requestIndex,
              durationMs,
              src: item.b64_json
                ? `data:${imageMimeType};base64,${item.b64_json}`
                : (item.url ?? ''),
              revisedPrompt: item.revised_prompt,
            }))
            .filter((item) => item.src)
          if (imageOutputs.length === 0) {
            throw new Error('empty image response')
          }

          if (
            !successfulRequests.some(
              (request) => request.requestId === requestResult.requestId
            )
          ) {
            successfulRequests.push({ requestId: requestResult.requestId })
          }
          const nextRecord: GenerationRecord = {
            ...activeRecord,
            id: recordId,
            transient: !saveHistory,
            createdAt: startedAt,
            mode,
            prompt,
            model: config.model,
            group: config.group,
            parameterSnapshot: { ...config.parameters },
            size:
              requestResult.response.size ??
              resolveParameterSize(config.parameters),
            quality: requestResult.response.quality ?? payload.quality,
            moderation: payload.moderation,
            outputFormat,
            n: requestedImageCount,
            images: [...(activeRecord?.images ?? []), ...imageOutputs],
            usage: { durationMs: generationDurationMs },
            referenceImages,
            imageUsage: requestResult.response.usage,
            background: requestResult.response.background,
            svgUsage: requestResult.response.svg_usage,
          }
          // Publish the response immediately; saving one image must not hold up
          // another completed request or its stream reader.
          if (activeRecord === null) {
            addRecord(nextRecord)
            setActiveRecordId(nextRecord.id)
          } else {
            patchRecordLocally(nextRecord.id, nextRecord)
          }
          activeRecord = nextRecord

          const persistImageOutputs = async () => {
            for (const imageOutput of imageOutputs) {
              if (!saveHistory || controller.signal.aborted) return
              let storedRecord: ImageStudioGenerationRecord | null = null
              if (persistedImages.length === 0) {
                storedRecord = await storeImageStudioGeneration(
                  {
                    id: recordId,
                    created_at: startedAt,
                    mode,
                    prompt,
                    model: config.model,
                    group: config.group,
                    parameter_snapshot: { ...config.parameters },
                    size:
                      requestResult.response.size ??
                      resolveParameterSize(config.parameters),
                    quality: requestResult.response.quality ?? payload.quality,
                    moderation: payload.moderation,
                    output_format: outputFormat,
                    n: requestedImageCount,
                    duration_ms: durationMs,
                    images: [
                      {
                        src: imageOutput.src,
                        revised_prompt: imageOutput.revisedPrompt,
                      },
                    ],
                  },
                  controller.signal
                )
              } else {
                storedRecord = await appendImageStudioGenerationImage(
                  recordId,
                  {
                    src: imageOutput.src,
                    revised_prompt: imageOutput.revisedPrompt,
                  },
                  controller.signal
                )
              }

              // A disabled recording response is intentional, not a generation failure.
              if (controller.signal.aborted || activeRecord === null) return
              if (storedRecord === null) {
                saveHistory = false
                activeRecord = { ...activeRecord, transient: true }
                patchRecordLocally(recordId, { transient: true })
                return
              }
              const storedImages = mapStoredImages(
                storedRecord,
                persistedImages,
                requestIndex,
                durationMs
              )
              const storedImage = storedImages.find(
                (image) =>
                  !persistedImages.some((stored) => stored.id === image.id)
              )
              persistedImages = storedImages
              activeRecord = {
                ...activeRecord,
                images: activeRecord.images.map((image) =>
                  image.id === imageOutput.id && storedImage
                    ? storedImage
                    : image
                ),
                favorite: storedRecord.favorite,
                channelId: storedRecord.channel_id,
              }
              patchRecordLocally(recordId, activeRecord)
            }
          }

          persistenceQueue = persistenceQueue
            .then(persistImageOutputs)
            .catch((error) => {
              if (controller.signal.aborted) return
              saveHistory = false
              if (activeRecord) {
                activeRecord = { ...activeRecord, transient: true }
                patchRecordLocally(recordId, { transient: true })
              }
              handleServerError(error)
            })
        }

        await Promise.all(
          Array.from(
            { length: requestedImageCount },
            async (_, requestIndex) => {
              const requestStartedAt = Date.now()
              let imageCompleted = false
              const onCompleted = async (
                result: Awaited<ReturnType<typeof send>>
              ) => {
                const requestDurationMs = Date.now() - requestStartedAt
                generationDurationMs = Math.max(
                  generationDurationMs,
                  requestDurationMs
                )
                handleCompletedRequest(result, requestDurationMs, requestIndex)
                imageCompleted = true
                setPendingImageIndexes((indexes) =>
                  indexes.filter((index) => index !== requestIndex)
                )
              }
              try {
                const requestResult = await send(
                  payload,
                  controller.signal,
                  (preview) => {
                    setPartialImages((current) => {
                      const next = { ...current }
                      if (preview) next[requestIndex] = preview
                      else delete next[requestIndex]
                      return next
                    })
                  },
                  payload.stream ? onCompleted : undefined
                )
                if (!payload.stream) {
                  await onCompleted(requestResult)
                }
              } catch (error) {
                if (!controller.signal.aborted) {
                  if (!imageCompleted) {
                    generationDurationMs = Math.max(
                      generationDurationMs,
                      Date.now() - requestStartedAt
                    )
                    const errorMessage = extractApiErrorMessage(error)
                    requestFailures.push({
                      id: `${recordId}-request-${requestIndex}`,
                      requestIndex,
                      retryIndex: requestFailures.length,
                      message: errorMessage,
                    })
                    requestErrors.push(errorMessage)
                    setImageFailures([...requestFailures])
                  }
                }
              } finally {
                if (!imageCompleted) {
                  setPendingImageIndexes((indexes) =>
                    indexes.filter((index) => index !== requestIndex)
                  )
                }
              }
            }
          )
        )
        // Individual images are saved as they arrive. After the last request,
        // keep the batch busy while the remaining saves finish.
        setIsSaving(true)
        setIsGenerating(false)
        await persistenceQueue
        if (controller.signal.aborted) return null
        if (activeRecord === null) {
          const failedRecord: GenerationRecord = {
            id: recordId,
            transient: !saveHistory,
            createdAt: startedAt,
            mode,
            prompt,
            model: config.model,
            group: config.group,
            parameterSnapshot: { ...config.parameters },
            size: resolveParameterSize(config.parameters),
            quality: payload.quality,
            moderation: payload.moderation,
            outputFormat: payload.output_format,
            n: requestedImageCount,
            images: [],
            failedImageCount: requestErrors.length,
            imageErrors: requestErrors,
            imageFailures: [...requestFailures],
            usage: { durationMs: generationDurationMs },
            referenceImages,
          }
          addRecord(failedRecord)
          setActiveRecordId(failedRecord.id)
          return failedRecord
        }

        const completedRecord = activeRecord as GenerationRecord
        const durationMs = generationDurationMs
        const record: GenerationRecord = {
          ...completedRecord,
          failedImageCount: requestErrors.length,
          imageErrors: requestErrors,
          imageFailures: [...requestFailures],
          usage: { durationMs },
        }
        patchRecordLocally(record.id, record)

        // Billing info lands in logs slightly after the response.
        const requestIds = successfulRequests
          .map((result) => result.requestId)
          .filter((requestId) => requestId.length > 0)
        window.setTimeout(() => {
          const logRequests =
            requestedImageCount === 1
              ? [fetchGenerationLog(requestIds[0] ?? '', config.model)]
              : requestIds.map((requestId) => fetchGenerationLog(requestId, ''))
          if (logRequests.length === 0) return

          void Promise.all(logRequests).then((logs) => {
            const availableLogs = logs.filter((log) => log !== null)
            if (availableLogs.length === 0) return

            const usage = availableLogs.reduce(
              (total, log) => ({
                quota: total.quota + log.quota,
                promptTokens: total.promptTokens + log.promptTokens,
                completionTokens: total.completionTokens + log.completionTokens,
              }),
              { quota: 0, promptTokens: 0, completionTokens: 0 }
            )
            const channelId =
              availableLogs.find((log) => log.channelId > 0)?.channelId ?? 0
            patchRecord(record.id, {
              usage: {
                durationMs,
                quota: usage.quota,
                promptTokens: usage.promptTokens,
                completionTokens: usage.completionTokens,
                channelId,
              },
              channelId,
            })
          })
        }, 1200)
        return record
      } catch (error) {
        if (controller.signal.aborted) return null
        setGenerationError(extractApiErrorMessage(error))
        return null
      } finally {
        abortRef.current = null
        generationRunningRef.current = false
        setIsGenerating(false)
        setIsSaving(false)
        setPendingImageIndexes([])
        setPartialImages({})
      }
    },
    [addRecord, patchRecord, patchRecordLocally]
  )

  const retryImage = useCallback(
    async ({ record, errorIndex }: RetryImageArgs): Promise<void> => {
      if (generationRunningRef.current) return
      if (
        retryBatchRef.current?.recordId !== record.id &&
        (retryBatchRef.current?.controllers.size ?? 0) > 0
      ) {
        return
      }

      const parameters = restoreParametersFromRecord(record)
      const runtimeLimits = getImageModelRuntimeLimits(record.model)
      const referenceImages = record.referenceImages ?? []
      const editReferencesUnavailable =
        record.mode === 'edit' && referenceImages.length === 0
      if (!parameters || !runtimeLimits || editReferencesUnavailable) return

      if (
        retryBatchRef.current === null ||
        retryBatchRef.current.recordId !== record.id
      ) {
        retryBatchRef.current = {
          recordId: record.id,
          failures: getImageFailures(record),
          latestImages: record.images,
          transient: Boolean(record.transient),
          controllers: new Map(),
          persistenceQueue: Promise.resolve(),
        }
      }
      // Capture this batch. Async responses must never mutate a later batch.
      const retryBatch = retryBatchRef.current
      const failure = retryBatch.failures.find(
        (item) => item.retryIndex === errorIndex
      )
      if (!failure || retryBatch.controllers.has(failure.id)) return

      const retryConfig: ImageStudioConfig = {
        model: record.model,
        group: record.group,
        parameters: { ...parameters, n: 1 },
      }
      const payload = buildImageGenerationPayload(
        retryConfig,
        record.prompt,
        record.mode,
        referenceImages
      )
      const send =
        record.mode === 'edit' && !runtimeLimits.usesGenerationEndpointForEdits
          ? editImages
          : generateImages
      const controller = new AbortController()
      retryBatch.controllers.set(failure.id, controller)
      // Normalize old history once, before any successful retry removes a failure.
      patchRecordLocally(record.id, { imageFailures: retryBatch.failures })
      setRetryingImageErrorIndexes((currentIndexes) => [
        ...currentIndexes,
        errorIndex,
      ])

      try {
        const setting = await getImageStudioSetting(controller.signal)
        const requestStartedAt = Date.now()
        const requestResult = await send(payload, controller.signal)
        const durationMs = Date.now() - requestStartedAt
        if (controller.signal.aborted) return
        const responseImage = requestResult.response.data?.find(
          (image) => image.b64_json || image.url
        )
        if (!responseImage) throw new Error('empty image response')

        const outputFormat =
          requestResult.response.output_format ??
          payload.output_format ??
          record.outputFormat ??
          'png'
        const imageSource = responseImage.b64_json
          ? `data:${imageMimeTypeForOutputFormat(outputFormat)};base64,${responseImage.b64_json}`
          : (responseImage.url ?? '')
        // Generation may run concurrently; storage must use the latest committed
        // image list, so only the first successful retry creates the record.
        const persistence = retryBatch.persistenceQueue.then(async () => {
          if (controller.signal.aborted) return
          let storedRecord: ImageStudioGenerationRecord | null = null
          if (setting.history_enabled && !retryBatch.transient) {
            if (
              retryBatch.latestImages.length > 0 &&
              retryBatch.latestImages.every((image) => image.storageId)
            ) {
              storedRecord = await appendImageStudioGenerationImage(
                record.id,
                {
                  src: imageSource,
                  revised_prompt: responseImage.revised_prompt,
                },
                controller.signal
              )
            } else {
              storedRecord = await storeImageStudioGeneration(
                {
                  id: record.id,
                  created_at: record.createdAt,
                  mode: record.mode,
                  prompt: record.prompt,
                  model: record.model,
                  group: record.group,
                  parameter_snapshot: { ...parameters },
                  size: record.size,
                  quality: record.quality,
                  moderation: record.moderation,
                  output_format: record.outputFormat,
                  n: record.n,
                  duration_ms: record.usage?.durationMs ?? 0,
                  images: [
                    ...retryBatch.latestImages.map((image) => ({
                      src: image.src,
                      revised_prompt: image.revisedPrompt,
                    })),
                    {
                      src: imageSource,
                      revised_prompt: responseImage.revised_prompt,
                    },
                  ],
                },
                controller.signal
              )
            }
          }
          if (controller.signal.aborted) return
          if (storedRecord) {
            retryBatch.latestImages = mapStoredImages(
              storedRecord,
              retryBatch.latestImages,
              failure.requestIndex,
              durationMs
            )
          } else {
            retryBatch.transient = true
            retryBatch.latestImages = [
              ...retryBatch.latestImages,
              {
                id: `${failure.id}-image`,
                requestIndex: failure.requestIndex,
                durationMs,
                src: imageSource,
                revisedPrompt: responseImage.revised_prompt,
              },
            ]
          }
          retryBatch.failures = retryBatch.failures.filter(
            (item) => item.id !== failure.id
          )
          const remainingErrors = retryBatch.failures.map(
            (item) => item.message
          )
          patchRecordLocally(record.id, {
            transient: retryBatch.transient,
            images: retryBatch.latestImages,
            imageFailures: retryBatch.failures,
            imageErrors: remainingErrors,
            failedImageCount: retryBatch.failures.length,
          })
          setImageFailures(retryBatch.failures)
        })
        retryBatch.persistenceQueue = persistence.catch(() => undefined)
        await persistence
      } catch (error) {
        if (controller.signal.aborted) return
        const retryErrorMessage = extractApiErrorMessage(error)
        retryBatch.failures = retryBatch.failures.map((item) =>
          item.id === failure.id
            ? { ...item, message: retryErrorMessage }
            : item
        )
        const remainingErrors = retryBatch.failures.map((item) => item.message)
        patchRecordLocally(record.id, {
          imageFailures: retryBatch.failures,
          imageErrors: remainingErrors,
          failedImageCount: retryBatch.failures.length,
        })
        setImageFailures(retryBatch.failures)
      } finally {
        retryBatch.controllers.delete(failure.id)
        setRetryingImageErrorIndexes((currentIndexes) =>
          currentIndexes.filter((index) => index !== errorIndex)
        )
      }
    },
    [patchRecordLocally]
  )

  return {
    isGenerating,
    isSaving,
    isBusy: isGenerating || isSaving || retryingImageErrorIndexes.length > 0,
    isBusyNow,
    pendingImageCount: pendingImageIndexes.length,
    pendingImageIndexes,
    partialImage: Object.values(partialImages)[0] ?? null,
    partialImages,
    imageErrors: imageFailures.map((failure) => failure.message),
    imageFailures,
    retryingImageErrorIndexes,
    generationError,
    setGenerationError,
    activeRecordId,
    setActiveRecordId,
    estimateDurationMs,
    generate,
    retryImage,
    stopGeneration,
  }
}
