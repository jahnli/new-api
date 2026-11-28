import { NeuralNetworkIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useMutation } from '@tanstack/react-query'
import { isAxiosError, isCancel } from 'axios'
import { ListChecksIcon } from 'lucide-react'
import { useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Shimmer } from '@/components/ai-elements/shimmer'
import { JsonCodeEditor } from '@/components/json-code-editor'
import type { ModelGroupSelectorProps } from '@/components/model-group-selector'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Combobox } from '@/components/ui/combobox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/lib/api'
import { getServerErrorMessage } from '@/lib/server-error-message'
import { cn } from '@/lib/utils'

import type { GroupOption } from '../types'
import { PlaygroundInputControls } from './input/playground-input-controls'
import { SystemOneResult, type SystemOneResponse } from './system-one-result'

export function SystemOnePlayground(
  props: ModelGroupSelectorProps & { groups: GroupOption[] }
) {
  const { t } = useTranslation()
  const shouldReduceMotion = useReducedMotion()
  const [text, setText] = useState(() =>
    t(
      'The project is due this Friday, but a key feature is still unfinished and we need two more days for integration.'
    )
  )
  const [questions, setQuestions] = useState(() => ({
    noul: t('Does this update indicate a risk of delay?'),
    choice: t('What is the project status?'),
    score: t('How high is the risk of delay?'),
  }))
  const [kind, setKind] = useState<keyof typeof questions>('noul')
  const question = questions[kind]
  const questionTypes = [
    { value: 'noul', label: t('Yes or no') },
    { value: 'choice', label: t('Single choice') },
    { value: 'score', label: t('Rating') },
  ] as const
  const [choices, setChoices] = useState(() =>
    [t('On track'), t('At risk'), t('Delayed')].join('\n')
  )
  const [levels, setLevels] = useState(() =>
    [t('Low'), t('Medium'), t('High')].join('\n')
  )
  const [advanced, setAdvanced] = useState(false)
  const [customJSON, setCustomJSON] = useState<string | null>(null)
  const pending = useRef<AbortController | null>(null)
  useEffect(() => () => pending.current?.abort(), [])

  const entries = (kind === 'choice' ? choices : levels)
    .split('\n')
    .map((entry) => entry.trim())
    .filter(Boolean)
  let criteria: string[] | Record<string, null> | undefined
  let criteriaError = ''
  if (kind === 'choice') {
    criteria = Object.fromEntries(entries.map((name) => [name, null]))
    if (
      entries.length === 0 ||
      entries.length > 255 ||
      new Set(entries).size !== entries.length
    ) {
      criteriaError = t('Enter 1 to 255 distinct choices, one per line.')
    }
  } else if (kind === 'score') {
    criteria = entries
    if (entries.length === 0 || entries.length > 10) {
      criteriaError = t('Enter 1 to 10 levels, from lowest to highest.')
    }
  }
  const formBody = {
    model: props.selectedModel,
    state: text,
    questions: { answer: { type: kind, instructions: question, criteria } },
  }
  const draft = advanced
    ? (customJSON ?? JSON.stringify(formBody, null, 2))
    : JSON.stringify(formBody)
  const ready = advanced
    ? Boolean(draft.trim())
    : Boolean(text.trim() && question.trim() && !criteriaError)
  const request = useMutation({
    retry: false,
    mutationFn: async () => {
      let body: unknown
      try {
        body = JSON.parse(draft)
      } catch {
        throw new Error(t('Invalid JSON'))
      }
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        throw new Error(t('JSON must be an object'))
      }
      if (!('model' in body) || body.model !== props.selectedModel) {
        throw new Error(t('The request model must match the selected model.'))
      }
      const controller = new AbortController()
      pending.current = controller
      try {
        const response = await api.post<SystemOneResponse>(
          '/pg/systemone',
          draft,
          {
            headers: { 'Content-Type': 'application/json' },
            params: { group: props.selectedGroup },
            signal: controller.signal,
            skipErrorHandler: true,
          }
        )
        if (
          !response.data?.answers ||
          typeof response.data.answers !== 'object'
        ) {
          throw new Error(
            getServerErrorMessage(response.data, t('Request failed'))
          )
        }
        const labels = Object.fromEntries(
          Object.entries(
            'questions' in body &&
              body.questions &&
              typeof body.questions === 'object'
              ? body.questions
              : {}
          ).map(([name, item]) => [
            name,
            typeof item?.instructions === 'string' ? item.instructions : name,
          ])
        )
        return { response: response.data, questions: labels }
      } catch (error) {
        const detail = isAxiosError(error) && error.response?.data?.detail
        if (detail) {
          throw new Error(
            typeof detail === 'string' ? detail : JSON.stringify(detail)
          )
        }
        throw error
      } finally {
        pending.current = null
      }
    },
  })
  return (
    <div className='relative flex size-full min-h-0 flex-col overflow-hidden'>
      <div
        className='min-h-0 flex-1 [scrollbar-gutter:stable_both-edges] overflow-y-auto [overflow-anchor:none] lg:overflow-hidden'
        aria-live='polite'
      >
        <div
          className={cn(
            'mx-auto flex min-h-full w-full flex-col gap-4 p-4 md:p-6',
            request.isSuccess
              ? 'max-w-6xl md:pt-10 lg:h-full lg:min-h-0'
              : 'max-w-4xl justify-center'
          )}
        >
          {request.isSuccess ? (
            <SystemOneResult {...request.data} />
          ) : (
            <div className='mx-auto grid justify-items-center gap-4 text-center'>
              <ListChecksIcon
                className={cn(
                  'text-primary size-10 md:size-12',
                  request.isPending && 'motion-safe:animate-pulse'
                )}
                aria-hidden='true'
              />
              <h2 className='text-xl font-semibold md:text-2xl'>
                {props.selectedModel}
              </h2>
              <div className='text-muted-foreground flex min-h-7 items-center justify-center gap-2.5 text-sm md:text-base'>
                {request.isPending ? (
                  <>
                    {shouldReduceMotion ? (
                      <p>{t('Analyzing')}</p>
                    ) : (
                      <Shimmer duration={1.2} spread={3}>
                        {t('Analyzing')}
                      </Shimmer>
                    )}
                    <HugeiconsIcon
                      icon={NeuralNetworkIcon}
                      className='text-primary size-6 shrink-0 motion-safe:animate-spin motion-safe:[animation-duration:1.5s] motion-safe:[&>path]:animate-pulse motion-safe:[&>path]:[animation-duration:1.2s] motion-safe:[&>path:nth-child(2n)]:[animation-delay:200ms] motion-safe:[&>path:nth-child(3n)]:[animation-delay:400ms]'
                      aria-hidden='true'
                    />
                  </>
                ) : (
                  <p>{t('Enter text and a question below to evaluate it.')}</p>
                )}
              </div>
            </div>
          )}
          {request.isError && !isCancel(request.error) && (
            <Alert variant='destructive'>
              <AlertDescription>
                {getServerErrorMessage(request.error)}
              </AlertDescription>
            </Alert>
          )}
        </div>
      </div>
      <div className='mx-auto flex max-h-[65%] min-h-0 w-full max-w-4xl shrink-0 flex-col px-1 md:pb-4'>
        <form
          className='border-border/70 bg-background flex min-h-0 flex-col overflow-hidden rounded-xl border shadow-sm'
          onSubmit={(event) => {
            event.preventDefault()
            if (ready && !props.disabled && !pending.current) request.mutate()
          }}
        >
          <fieldset
            disabled={request.isPending}
            className='grid min-h-0 min-w-0 gap-3 overflow-y-auto p-3 md:p-4'
          >
            {advanced ? (
              <JsonCodeEditor
                ariaLabel={t('Request body')}
                value={draft}
                onChange={setCustomJSON}
                disabled={request.isPending}
                heightClassName='h-56'
              />
            ) : (
              <>
                <div className='grid gap-1.5'>
                  <Label htmlFor='jev-text'>{t('Text to analyze')}</Label>
                  <Textarea
                    id='jev-text'
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                  />
                </div>
                <div className='grid gap-3 sm:grid-cols-[minmax(8rem,1fr)_minmax(0,3fr)]'>
                  <div className='grid gap-1.5'>
                    <Label htmlFor='jev-kind'>{t('Question type')}</Label>
                    <Combobox
                      id='jev-kind'
                      aria-label={t('Question type')}
                      className='h-8 w-full'
                      options={questionTypes}
                      value={kind}
                      disabled={request.isPending}
                      openOnFocus
                      onValueChange={(value: string | null) => {
                        const option = questionTypes.find(
                          (item) => item.value === value
                        )
                        if (option) setKind(option.value)
                      }}
                    />
                  </div>
                  <div className='grid gap-1.5'>
                    <Label htmlFor='jev-question'>{t('Question')}</Label>
                    <Input
                      id='jev-question'
                      value={question}
                      onChange={(event) =>
                        setQuestions({
                          ...questions,
                          [kind]: event.target.value,
                        })
                      }
                    />
                  </div>
                </div>
                {kind !== 'noul' && (
                  <div className='grid gap-1.5'>
                    <Label htmlFor='jev-criteria'>
                      {kind === 'choice'
                        ? t('Choices (one per line)')
                        : t('Levels (lowest to highest, one per line)')}
                    </Label>
                    <Textarea
                      id='jev-criteria'
                      value={kind === 'choice' ? choices : levels}
                      onChange={(event) =>
                        (kind === 'choice' ? setChoices : setLevels)(
                          event.target.value
                        )
                      }
                      aria-invalid={Boolean(criteriaError)}
                      aria-describedby={
                        criteriaError ? 'jev-criteria-error' : undefined
                      }
                    />
                    {criteriaError && (
                      <p
                        className='text-destructive text-xs'
                        id='jev-criteria-error'
                      >
                        {criteriaError}
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
          </fieldset>
          <div className='border-border/60 bg-muted/20 shrink-0 border-t px-3 py-2.5'>
            <PlaygroundInputControls
              groups={props.groups}
              models={props.models}
              modelValue={props.selectedModel}
              groupValue={props.selectedGroup}
              onModelChange={props.onModelChange}
              onGroupChange={props.onGroupChange}
              isModelLoading={props.disabled}
              disabled={props.disabled || request.isPending}
              isGenerating={request.isPending}
              onStop={() => pending.current?.abort()}
              text={ready ? draft : ''}
              submitLabel={t('Run')}
              tools={
                <Label>
                  <Switch
                    size='sm'
                    checked={advanced}
                    onCheckedChange={setAdvanced}
                    disabled={request.isPending}
                  />
                  {t('JSON mode')}
                </Label>
              }
            />
          </div>
        </form>
      </div>
    </div>
  )
}
