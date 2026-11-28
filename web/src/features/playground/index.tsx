import { useCallback, useState } from 'react'

import { ChatPlayground } from './components/chat-playground'
import { SystemOnePlayground } from './components/system-one-playground'
import { usePlaygroundOptions } from './hooks/use-playground-options'
import { getInitialPlaygroundConfig } from './lib/state/playground-state-utils'
import { saveConfig } from './lib/storage/storage'
import type { GroupOption, ModelOption, PlaygroundConfig } from './types'

export function Playground() {
  const [config, setConfig] = useState(getInitialPlaygroundConfig)
  const [models, setModels] = useState<ModelOption[]>([])
  const [groups, setGroups] = useState<GroupOption[]>([])
  const updateConfig = useCallback(
    <K extends keyof PlaygroundConfig>(key: K, value: PlaygroundConfig[K]) => {
      setConfig((previous) => {
        const updated = { ...previous, [key]: value }
        saveConfig(updated)
        return updated
      })
    },
    []
  )

  const { isLoadingModels } = usePlaygroundOptions({
    currentGroup: config.group,
    currentModel: config.model,
    setGroups,
    setModels,
    updateConfig,
  })

  if (models.some((model) => model.value === config.model && model.systemOne)) {
    return (
      <SystemOnePlayground
        key={JSON.stringify([config.model, config.group])}
        selectedModel={config.model}
        selectedGroup={config.group}
        models={models}
        groups={groups}
        onModelChange={(value) => updateConfig('model', value)}
        onGroupChange={(value) => updateConfig('group', value)}
        disabled={isLoadingModels}
      />
    )
  }

  return (
    <ChatPlayground
      config={config}
      models={models}
      groups={groups}
      isLoadingModels={isLoadingModels}
      updateConfig={updateConfig}
    />
  )
}
