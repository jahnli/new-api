import { useChatHandler } from '../hooks/use-chat-handler'
import { usePlaygroundConversation } from '../hooks/use-playground-conversation'
import { usePlaygroundState } from '../hooks/use-playground-state'
import type { GroupOption, ModelOption, PlaygroundConfig } from '../types'
import { PlaygroundChat } from './chat/playground-chat'
import { PlaygroundInput } from './input/playground-input'

interface ChatPlaygroundProps {
  config: PlaygroundConfig
  models: ModelOption[]
  groups: GroupOption[]
  isLoadingModels: boolean
  updateConfig: <K extends keyof PlaygroundConfig>(
    key: K,
    value: PlaygroundConfig[K]
  ) => void
}

export function ChatPlayground(props: ChatPlaygroundProps) {
  const {
    parameterEnabled,
    messages,
    isLoadingMessages,
    updateMessages,
    updateParameterEnabled,
    clearMessages,
  } = usePlaygroundState()

  const { sendChat, stopGeneration, isGenerating } = useChatHandler({
    config: props.config,
    parameterEnabled,
    onMessageUpdate: updateMessages,
  })
  const {
    editingMessageKey,
    handleSendMessage,
    handleRegenerateMessage,
    handleEditMessage,
    handleEditOpenChange,
    applyEdit,
    handleDeleteMessage,
  } = usePlaygroundConversation({ messages, updateMessages, sendChat })

  const handleClearMessages = () => {
    handleEditOpenChange(false)
    clearMessages()
  }

  return (
    <div className='relative flex size-full min-h-0 flex-col overflow-hidden'>
      <div className='flex min-h-0 flex-1 flex-col overflow-hidden'>
        <PlaygroundChat
          messages={messages}
          isLoadingMessages={isLoadingMessages}
          onRegenerateMessage={handleRegenerateMessage}
          onEditMessage={handleEditMessage}
          onDeleteMessage={handleDeleteMessage}
          onSelectPrompt={handleSendMessage}
          isGenerating={isGenerating}
          editingKey={editingMessageKey}
          onCancelEdit={handleEditOpenChange}
          onSaveEdit={(newContent) => applyEdit(newContent, false)}
          onSaveEditAndSubmit={(newContent) => applyEdit(newContent, true)}
        />
      </div>
      <div className='mx-auto w-full max-w-4xl'>
        <PlaygroundInput
          config={props.config}
          disabled={isGenerating}
          groups={props.groups}
          groupValue={props.config.group}
          isGenerating={isGenerating}
          isModelLoading={props.isLoadingModels}
          modelValue={props.config.model}
          models={props.models}
          onGroupChange={(value) => props.updateConfig('group', value)}
          onConfigChange={props.updateConfig}
          onClearMessages={handleClearMessages}
          onModelChange={(value) => props.updateConfig('model', value)}
          onParameterEnabledChange={updateParameterEnabled}
          onStop={stopGeneration}
          onSubmit={handleSendMessage}
          parameterEnabled={parameterEnabled}
          hasMessages={messages.length > 0}
        />
      </div>
    </div>
  )
}
