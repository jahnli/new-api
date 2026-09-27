import { useQuery } from '@tanstack/react-query'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { ScrollArea } from '@/components/ui/scroll-area'

import { getImageStudioSetting } from './api'
import { GeneratePanel } from './components/generate-panel'
import { HistoryPanel } from './components/history-panel'
import { ParamsPanel } from './components/params-panel'
import { ResultGrid } from './components/result-grid'
import {
  useGenerationHistory,
  useImageGeneration,
  useImageStudioState,
} from './hooks'
import { imageSrcToDataUrl } from './lib/image-utils'
import {
  getImageModelRuntimeLimits,
  isCustomSizeValid,
} from './lib/model-params'
import type {
  GeneratedImage,
  GenerationRecord,
  ReferenceImage,
  StudioMode,
} from './types'

export function ImageStudio() {
  const { t } = useTranslation()
  const recordingSetting = useQuery({
    queryKey: ['image-studio', 'setting'],
    queryFn: () => getImageStudioSetting(),
  })
  const {
    config,
    updateGroup,
    updateModel,
    updateParameters,
    updateGptImageConfig,
    updateSeedreamConfig,
    groups,
    models,
    isLoadingModels,
  } = useImageStudioState()
  const {
    history,
    isLoadingHistory,
    addRecord,
    patchRecordLocally,
    patchRecord,
    removeRecord,
    clearHistory,
    toggleFavorite,
  } = useGenerationHistory()
  const {
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
  } = useImageGeneration({
    history,
    addRecord,
    patchRecordLocally,
    patchRecord,
  })

  const [mode, setMode] = useState<StudioMode>('generate')
  const [prompt, setPrompt] = useState('')
  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>([])

  const activeRecord = useMemo(
    () => history.find((record) => record.id === activeRecordId) ?? null,
    [history, activeRecordId]
  )

  const runtimeLimits = getImageModelRuntimeLimits(config.model)
  const customSizeValid = isCustomSizeValid(config)
  const imageCountValid =
    runtimeLimits !== null &&
    config.parameters.n >= 1 &&
    config.parameters.n <= runtimeLimits.maxImages

  const referenceCountValid =
    runtimeLimits !== null &&
    referenceImages.length <= runtimeLimits.maxReferenceImages
  const totalImageCountValid =
    runtimeLimits !== null &&
    (runtimeLimits.maxTotalImages === null ||
      mode !== 'edit' ||
      referenceImages.length + config.parameters.n <=
        runtimeLimits.maxTotalImages)

  const canGenerate =
    !isGenerating &&
    !isLoadingHistory &&
    Boolean(config.model) &&
    prompt.trim().length > 0 &&
    customSizeValid &&
    imageCountValid &&
    referenceCountValid &&
    totalImageCountValid &&
    (mode === 'generate' || referenceImages.length > 0)

  const canReset =
    prompt.length > 0 ||
    referenceImages.length > 0 ||
    activeRecord !== null ||
    generationError !== null

  const handleGenerate = useCallback(() => {
    if (!canGenerate) return
    setActiveRecordId(null)
    setGenerationError(null)
    void generate({
      config,
      prompt: prompt.trim(),
      mode,
      referenceImages,
    })
  }, [
    canGenerate,
    setActiveRecordId,
    setGenerationError,
    generate,
    config,
    prompt,
    mode,
    referenceImages,
  ])

  const handleRestore = useCallback(
    (record: GenerationRecord) => {
      setActiveRecordId(record.id)
      setGenerationError(null)
      setPrompt(record.prompt)
      setMode(record.mode)
      setReferenceImages(record.referenceImages ?? [])
      updateModel(record.model)
      if (record.parameterSnapshot) {
        updateParameters(record.parameterSnapshot)
      }
    },
    [setActiveRecordId, setGenerationError, updateModel, updateParameters]
  )

  const handleEditImage = useCallback(
    async (image: GeneratedImage) => {
      try {
        const dataUrl = await imageSrcToDataUrl(image.src)
        setMode('edit')
        setReferenceImages([
          {
            id: `${Date.now()}-edit`,
            dataUrl,
            name: 'generated-image',
          },
        ])
      } catch {
        toast.error(t('Unable to load this image for editing'))
      }
    },
    [t]
  )

  const handleModeChange = useCallback(
    (nextMode: StudioMode) => {
      setMode(nextMode)
      if (
        nextMode !== 'edit' ||
        referenceImages.length > 0 ||
        !activeRecord ||
        activeRecord.images.length === 0
      ) {
        return
      }

      const firstGeneratedImage = activeRecord.images[0]
      void handleEditImage(firstGeneratedImage)
    },
    [activeRecord, handleEditImage, referenceImages.length]
  )

  const handleDelete = useCallback(
    (id: string) => {
      if (id === activeRecordId) setActiveRecordId(null)
      removeRecord(id)
    },
    [activeRecordId, removeRecord, setActiveRecordId]
  )

  const handleReset = useCallback(() => {
    setActiveRecordId(null)
    setGenerationError(null)
    setPrompt('')
    setReferenceImages([])
  }, [setActiveRecordId, setGenerationError])

  const handleClear = useCallback(() => {
    setActiveRecordId(null)
    clearHistory()
  }, [clearHistory, setActiveRecordId])

  return (
    <div className='flex size-full min-h-0 flex-col gap-4 p-4 lg:grid lg:h-full lg:grid-cols-[280px_minmax(0,1fr)_300px] lg:gap-0 lg:p-0'>
      {/* Params panel */}
      <ScrollArea className='lg:after:bg-border min-h-0 rounded-lg border p-3 lg:relative lg:h-full lg:rounded-none lg:border-0 lg:p-4 lg:after:absolute lg:after:top-1.5 lg:after:right-0 lg:after:bottom-1.5 lg:after:w-px'>
        <ParamsPanel
          config={config}
          updateModel={updateModel}
          updateGroup={updateGroup}
          updateGptImageConfig={updateGptImageConfig}
          updateSeedreamConfig={updateSeedreamConfig}
          groups={groups}
          models={models}
          isLoadingModels={isLoadingModels}
          disabled={isGenerating}
        />
      </ScrollArea>

      {/* Workspace */}
      <div className='flex min-h-0 flex-col gap-4 lg:overflow-hidden lg:p-4'>
        {(recordingSetting.data?.history_enabled === false ||
          activeRecord?.transient) && (
          <Alert>
            <AlertDescription>
              {t(
                'New images are not saved to history. Download them before refreshing or leaving this page.'
              )}
            </AlertDescription>
          </Alert>
        )}
        <GeneratePanel
          model={config.model}
          mode={mode}
          onModeChange={handleModeChange}
          prompt={prompt}
          onPromptChange={setPrompt}
          referenceImages={referenceImages}
          onReferenceImagesChange={setReferenceImages}
          isGenerating={isGenerating}
          estimateMs={estimateDurationMs(config.model)}
          onGenerate={handleGenerate}
          onStop={stopGeneration}
          onReset={handleReset}
          canGenerate={canGenerate}
          canReset={canReset}
        />
        <ScrollArea className='min-h-0 flex-1'>
          <ResultGrid
            record={activeRecord}
            error={generationError}
            onRetry={handleGenerate}
            onRetryImage={(errorIndex) => {
              if (!activeRecord) return
              void retryImage({ record: activeRecord, errorIndex })
            }}
            retryingImageErrorIndexes={retryingImageErrorIndexes}
            onEditImage={handleEditImage}
            isGenerating={isGenerating}
            pendingImageCount={pendingImageCount}
            imageErrors={imageErrors}
          />
        </ScrollArea>
      </div>

      {/* History */}
      <div className='lg:before:bg-border min-h-64 rounded-lg border p-3 lg:relative lg:h-full lg:min-h-0 lg:rounded-none lg:border-0 lg:p-4 lg:before:absolute lg:before:top-1.5 lg:before:bottom-1.5 lg:before:left-0 lg:before:w-px'>
        <HistoryPanel
          history={history.filter((record) => !record.transient)}
          activeRecordId={activeRecordId}
          onRestore={handleRestore}
          onDelete={handleDelete}
          onClear={handleClear}
          onToggleFavorite={toggleFavorite}
          disabled={isGenerating}
        />
      </div>
      <span className='sr-only'>{t('Online Image Generation')}</span>
    </div>
  )
}
