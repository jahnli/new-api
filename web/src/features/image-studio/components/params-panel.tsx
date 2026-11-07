import { useTranslation } from 'react-i18next'

import { ModelGroupSelector } from '@/components/model-group-selector'
import { Label } from '@/components/ui/label'

import { resolveImageModelAdapter } from '../lib/model-params'
import { GptImageParams } from '../lib/model-params/gpt-image/params'
import type { GptImageConfigUpdater } from '../lib/model-params/gpt-image/types'
import { SeedreamParams } from '../lib/model-params/seedream/params'
import type { SeedreamConfigUpdater } from '../lib/model-params/seedream/types'
import type {
  GroupOption,
  ImageStudioConfig,
  ModelOption,
  StudioMode,
} from '../types'

interface ParamsPanelProps {
  config: ImageStudioConfig
  updateModel: (model: string) => void
  updateGroup: (group: string) => void
  updateGptImageConfig: GptImageConfigUpdater
  updateSeedreamConfig: SeedreamConfigUpdater
  groups: GroupOption[]
  models: ModelOption[]
  isLoadingModels: boolean
  disabled: boolean
  mode?: StudioMode
}

export function ParamsPanel(props: ParamsPanelProps) {
  const { t } = useTranslation()
  const adapter = resolveImageModelAdapter(props.config.model)

  let modelParameters: React.ReactNode = null
  if (
    adapter?.family === 'gpt-image' &&
    props.config.parameters.family === 'gpt-image'
  ) {
    modelParameters = (
      <GptImageParams
        model={props.config.model}
        mode={props.mode}
        config={props.config.parameters}
        updateConfig={props.updateGptImageConfig}
        disabled={props.disabled}
      />
    )
  } else if (
    adapter?.family === 'seedream' &&
    props.config.parameters.family === 'seedream'
  ) {
    modelParameters = (
      <SeedreamParams
        config={props.config.parameters}
        updateConfig={props.updateSeedreamConfig}
        disabled={props.disabled}
      />
    )
  }

  return (
    <div className='flex flex-col gap-4'>
      <div className='flex flex-col gap-1.5'>
        <Label className='text-muted-foreground text-xs font-medium'>
          {t('Model')}
        </Label>
        <ModelGroupSelector
          selectedModel={props.config.model}
          models={props.models}
          onModelChange={props.updateModel}
          selectedGroup={props.config.group}
          groups={props.groups}
          onGroupChange={props.updateGroup}
          disabled={props.disabled || props.isLoadingModels}
        />
      </div>
      {modelParameters}
    </div>
  )
}
