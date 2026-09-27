import { useCallback, useRef, useState } from 'react'

import {
  appendImageStudioGenerationImage,
  editImages,
  fetchGenerationLog,
  generateImages,
  getImageStudioSetting,
  storeImageStudioGeneration,
} from '../api'
import { DEFAULT_ESTIMATE_MS, ESTIMATE_SAMPLE_SIZE } from '../constants'
import {
  buildImageGenerationPayload,
  getImageModelRuntimeLimits,
  resolveParameterSize,
  restoreParametersFromRecord,
} from '../lib/model-params'
import type {
  GeneratedImage,
  GenerationRecord,
  ImageStudioConfig,
  ImageStudioGenerationRecord,
  ReferenceImage,
  StudioMode,
} from '../types'

function imageMimeTypeForOutputFormat(outputFormat: string): string {
  if (outputFormat === 'jpeg') return 'image/jpeg'
  if (outputFormat === 'webp') return 'image/webp'
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
  storedRecord: ImageStudioGenerationRecord
): GeneratedImage[] {
  return storedRecord.images.map((image) => ({
    id: image.id,
    src: image.url,
    storageId: image.id,
    mimeType: image.mime_type,
    sizeBytes: image.size_bytes,
    width: image.width,
    height: image.height,
    revisedPrompt: image.revised_prompt,
  }))
}

export interface GenerateArgs {
  config: ImageStudioConfig
  prompt: string
  mode: StudioMode
  referenceImages: ReferenceImage[]
}

export interface RetryImageArgs {
  record: GenerationRecord
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
  const [pendingImageCount, setPendingImageCount] = useState(0)
  const [imageErrors, setImageErrors] = useState<string[]>([])
  const [generationError, setGenerationError] = useState<string | null>(null)
  const [activeRecordId, setActiveRecordId] = useState<string | null>(null)
  const [retryingImageErrorIndexes, setRetryingImageErrorIndexes] = useState<
    number[]
  >([])
  const retryingImageIndexesRef = useRef(new Set<number>())
  const retryBatchRef = useRef<{
    recordId: string
    errors: string[]
    successfulIndexes: Set<number>
    latestImages: GeneratedImage[]
    transient: boolean
  } | null>(null)
  const abortRef = useRef<AbortController | null>(null)

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
  }, [])

  const generate = useCallback(
    async ({ config, prompt, mode, referenceImages }: GenerateArgs) => {
      const payload = buildImageGenerationPayload(
        config,
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
      setIsGenerating(true)
      setPendingImageCount(requestedImageCount)
      setImageErrors([])
      setGenerationError(null)

      const startedAt = Date.now()
      const recordId = `${startedAt}-${Math.random().toString(36).slice(2, 8)}`
      let activeRecord: GenerationRecord | null = null
      const successfulRequests: Array<{ requestId: string }> = []
      const requestErrors: string[] = []
      let accumulatedDurationMs = 0
      let persistenceQueue = Promise.resolve()

      try {
        const setting = await getImageStudioSetting(controller.signal)
        let saveHistory = setting.history_enabled
        const send =
          mode === 'edit' && !runtimeLimits.usesGenerationEndpointForEdits
            ? editImages
            : generateImages
        const imageMimeType = imageMimeTypeForOutputFormat(
          payload.output_format ?? 'png'
        )

        const handleCompletedRequest = async (
          requestResult: Awaited<ReturnType<typeof send>>,
          durationMs: number
        ) => {
          const imageOutputs = (requestResult.response.data ?? [])
            .map((item) => ({
              src: item.b64_json
                ? `data:${imageMimeType};base64,${item.b64_json}`
                : (item.url ?? ''),
              revisedPrompt: item.revised_prompt,
            }))
            .filter((item) => item.src)
          if (imageOutputs.length === 0) {
            throw new Error('empty image response')
          }

          successfulRequests.push({ requestId: requestResult.requestId })
          const persistImageOutputs = async () => {
            for (const imageOutput of imageOutputs) {
              let storedRecord: ImageStudioGenerationRecord | null = null
              if (saveHistory && activeRecord === null) {
                storedRecord = await storeImageStudioGeneration(
                  {
                    id: recordId,
                    created_at: startedAt,
                    mode,
                    prompt,
                    model: config.model,
                    group: config.group,
                    parameter_snapshot: { ...config.parameters },
                    size: resolveParameterSize(config.parameters),
                    quality: payload.quality,
                    moderation: payload.moderation,
                    output_format: payload.output_format,
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
              } else if (saveHistory) {
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
              if (storedRecord === null) saveHistory = false
              const images = storedRecord
                ? mapStoredImages(storedRecord)
                : [
                    ...(activeRecord?.images ?? []),
                    {
                      id: `${recordId}-${activeRecord?.images.length ?? 0}`,
                      src: imageOutput.src,
                      revisedPrompt: imageOutput.revisedPrompt,
                    },
                  ]
              const nextRecord: GenerationRecord = {
                id: recordId,
                transient: !saveHistory,
                createdAt: startedAt,
                mode,
                prompt,
                model: config.model,
                group: config.group,
                parameterSnapshot: storedRecord?.parameter_snapshot ?? {
                  ...config.parameters,
                },
                size: resolveParameterSize(config.parameters),
                quality: payload.quality,
                moderation: payload.moderation,
                outputFormat: payload.output_format,
                n: requestedImageCount,
                images,
                usage: { durationMs },
                favorite: storedRecord?.favorite,
                channelId: storedRecord?.channel_id,
                referenceImages,
              }

              if (activeRecord === null) {
                addRecord(nextRecord)
                setActiveRecordId(nextRecord.id)
              } else {
                patchRecordLocally(nextRecord.id, nextRecord)
              }
              activeRecord = nextRecord
            }
          }

          const queuedPersistence = persistenceQueue.then(persistImageOutputs)
          persistenceQueue = queuedPersistence.catch(() => undefined)
          await queuedPersistence
        }

        await Promise.all(
          Array.from({ length: requestedImageCount }, async () => {
            const requestStartedAt = Date.now()
            let durationRecorded = false
            try {
              const requestResult = await send(payload, controller.signal)
              const requestDurationMs = Date.now() - requestStartedAt
              accumulatedDurationMs += requestDurationMs
              durationRecorded = true
              await handleCompletedRequest(requestResult, accumulatedDurationMs)
            } catch (error) {
              if (!controller.signal.aborted) {
                if (!durationRecorded) {
                  accumulatedDurationMs += Date.now() - requestStartedAt
                }
                const errorMessage = extractApiErrorMessage(error)
                requestErrors.push(errorMessage)
                setImageErrors((currentErrors) => [
                  ...currentErrors,
                  errorMessage,
                ])
              }
            } finally {
              setPendingImageCount((currentCount) =>
                Math.max(0, currentCount - 1)
              )
            }
          })
        )
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
            usage: { durationMs: accumulatedDurationMs },
            referenceImages,
          }
          addRecord(failedRecord)
          setActiveRecordId(failedRecord.id)
          return failedRecord
        }

        const completedRecord = activeRecord as GenerationRecord
        const durationMs = accumulatedDurationMs
        const record: GenerationRecord = {
          ...completedRecord,
          failedImageCount: requestErrors.length,
          imageErrors: requestErrors,
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
        setIsGenerating(false)
        setPendingImageCount(0)
      }
    },
    [addRecord, patchRecord, patchRecordLocally]
  )

  const retryImage = useCallback(
    async ({ record, errorIndex }: RetryImageArgs): Promise<void> => {
      const parameters = restoreParametersFromRecord(record)
      const runtimeLimits = getImageModelRuntimeLimits(record.model)
      const referenceImages = record.referenceImages ?? []
      const editReferencesUnavailable =
        record.mode === 'edit' && referenceImages.length === 0
      if (!parameters || !runtimeLimits || editReferencesUnavailable) return

      if (retryingImageIndexesRef.current.has(errorIndex)) return
      retryingImageIndexesRef.current.add(errorIndex)
      if (
        retryBatchRef.current === null ||
        retryBatchRef.current.recordId !== record.id
      ) {
        retryBatchRef.current = {
          recordId: record.id,
          errors: [...(record.imageErrors ?? imageErrors)],
          successfulIndexes: new Set<number>(),
          latestImages: record.images,
          transient: Boolean(record.transient),
        }
      }

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
      abortRef.current = controller
      setRetryingImageErrorIndexes((currentIndexes) => [
        ...currentIndexes,
        errorIndex,
      ])

      try {
        const setting = await getImageStudioSetting(controller.signal)
        const requestResult = await send(payload, controller.signal)
        const responseImage = requestResult.response.data?.find(
          (image) => image.b64_json || image.url
        )
        if (!responseImage) throw new Error('empty image response')

        const outputFormat =
          payload.output_format ?? record.outputFormat ?? 'png'
        const imageSource = responseImage.b64_json
          ? `data:${imageMimeTypeForOutputFormat(outputFormat)};base64,${responseImage.b64_json}`
          : (responseImage.url ?? '')
        let storedRecord: ImageStudioGenerationRecord | null = null
        if (
          setting.history_enabled &&
          !record.transient &&
          !retryBatchRef.current?.transient
        ) {
          if (
            record.images.length > 0 &&
            record.images.every((image) => image.storageId)
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
                  ...record.images.map((image) => ({
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
        const retryBatch = retryBatchRef.current
        if (retryBatch && retryBatch.recordId === record.id) {
          retryBatch.successfulIndexes.add(errorIndex)
          if (storedRecord) {
            const images = new Map(
              retryBatch.latestImages.map((image) => [image.id, image])
            )
            for (const image of mapStoredImages(storedRecord)) {
              images.set(image.id, image)
            }
            retryBatch.latestImages = [...images.values()]
          } else {
            retryBatch.transient = true
            retryBatch.latestImages = [
              ...retryBatch.latestImages,
              {
                id: `${record.id}-retry-${errorIndex}-${Date.now()}`,
                src: imageSource,
                revisedPrompt: responseImage.revised_prompt,
              },
            ]
          }
          const remainingErrors = retryBatch.errors.filter(
            (_message, index) => !retryBatch.successfulIndexes.has(index)
          )
          patchRecordLocally(record.id, {
            transient: retryBatch.transient,
            images: retryBatch.latestImages,
            imageErrors: remainingErrors,
            failedImageCount: remainingErrors.length,
          })
          setImageErrors(remainingErrors)
        }
      } catch (error) {
        if (controller.signal.aborted) return
        const retryErrorMessage = extractApiErrorMessage(error)
        const retryBatch = retryBatchRef.current
        if (retryBatch && retryBatch.recordId === record.id) {
          retryBatch.errors[errorIndex] = retryErrorMessage
          const remainingErrors = retryBatch.errors.filter(
            (_message, index) => !retryBatch.successfulIndexes.has(index)
          )
          patchRecordLocally(record.id, {
            imageErrors: remainingErrors,
            failedImageCount: remainingErrors.length,
          })
          setImageErrors(remainingErrors)
        }
      } finally {
        retryingImageIndexesRef.current.delete(errorIndex)
        setRetryingImageErrorIndexes((currentIndexes) =>
          currentIndexes.filter((index) => index !== errorIndex)
        )
        if (retryingImageIndexesRef.current.size === 0) {
          retryBatchRef.current = null
          abortRef.current = null
        }
      }
    },
    [imageErrors, patchRecordLocally]
  )

  return {
    isGenerating,
    pendingImageCount,
    imageErrors,
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
