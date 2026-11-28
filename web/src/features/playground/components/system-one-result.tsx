import {
  ChartColumnIcon,
  ChevronRightIcon,
  CircleHelpIcon,
  ListChecksIcon,
  WorkflowIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { CodeBlock } from '@/components/ai-elements/code-block'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { IconBadge } from '@/components/ui/icon-badge'
import { Progress } from '@/components/ui/progress'
import { toIntlLocale } from '@/i18n/languages'
import { formatNumber } from '@/lib/format'

export type SystemOneResponse = {
  model: string
  answers: Record<
    string,
    {
      type: string
      noul?: number
      choice?: string
      score?: number
      confidence?: number | null
      probabilities?: Record<string, number>
      legend?: Record<string, unknown>
    }
  >
  usage?: { input_tokens: number; output_tokens: number }
}

export function SystemOneResult({
  response,
  questions,
}: {
  response: SystemOneResponse
  questions: Record<string, string>
}) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  return (
    <section
      className='grid min-w-0 shrink-0 items-start gap-6 lg:min-h-0 lg:flex-1 lg:shrink lg:grid-cols-2 lg:items-stretch'
      aria-label={t('Response')}
    >
      <div className='grid min-w-0 content-start gap-4 lg:min-h-0 lg:overflow-y-auto'>
        <h2 className='flex min-h-7 items-center gap-2 font-semibold'>
          <WorkflowIcon className='text-primary size-4' aria-hidden='true' />
          {t('Response')}
        </h2>
        {Object.entries(response.answers).map(([key, answer]) => {
          let AnswerIcon = CircleHelpIcon
          if (answer.type === 'choice') AnswerIcon = ListChecksIcon
          else if (answer.type === 'score') AnswerIcon = ChartColumnIcon
          const probabilities =
            answer.type === 'noul' && typeof answer.noul === 'number'
              ? { [t('Probability of yes')]: answer.noul }
              : answer.probabilities
          return (
            <article
              key={key}
              className='border-primary/20 bg-primary/5 grid min-w-0 gap-3 rounded-xl border p-4'
            >
              <h3 className='flex items-start gap-2.5 text-sm font-medium'>
                <IconBadge size='sm' tone='primary'>
                  <AnswerIcon />
                </IconBadge>
                <span className='min-w-0 self-center break-words'>
                  {questions[key] || key}
                </span>
              </h3>
              {answer.type === 'choice' && (
                <strong className='text-primary text-xl'>
                  {answer.choice}
                </strong>
              )}
              {answer.type === 'score' && (
                <strong className='text-primary text-xl'>
                  {t('Rating')} · {formatNumber(answer.score, locale)}
                </strong>
              )}
              {Object.entries(probabilities ?? {}).map(([option, value]) => {
                const description = answer.legend?.[option]
                const label =
                  typeof description === 'string'
                    ? `${option} · ${description}`
                    : option
                return (
                  <div key={option} className='grid gap-1.5'>
                    <div className='flex items-baseline justify-between gap-3 text-sm'>
                      <span className='break-words'>{label}</span>
                      <span className='text-primary font-semibold tabular-nums'>
                        {formatNumber(value, locale, {
                          style: 'percent',
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                    <Progress aria-label={label} value={value * 100} />
                  </div>
                )
              })}
              {typeof answer.confidence === 'number' && (
                <p className='text-muted-foreground text-xs'>
                  {t('Confidence')} ·{' '}
                  {formatNumber(answer.confidence, locale, {
                    style: 'percent',
                    maximumFractionDigits: 2,
                  })}
                </p>
              )}
              {!['noul', 'score', 'choice'].includes(answer.type) && (
                <CodeBlock
                  language='json'
                  code={JSON.stringify(answer, null, 2)}
                />
              )}
            </article>
          )
        })}
        <div className='text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs'>
          <span>{response.model}</span>
          {response.usage && (
            <>
              <span>
                {t('Input tokens')} ·{' '}
                {formatNumber(response.usage.input_tokens, locale)}
              </span>
              <span>
                {t('Output tokens')} ·{' '}
                {formatNumber(response.usage.output_tokens, locale)}
              </span>
            </>
          )}
        </div>
      </div>
      <Collapsible
        defaultOpen
        className='grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)]'
      >
        <CollapsibleTrigger
          render={
            <Button
              className='group -ml-2.5 justify-self-start'
              variant='ghost'
              size='sm'
              type='button'
            />
          }
        >
          <ChevronRightIcon
            className='size-4 transition-transform duration-300 ease-out group-data-[panel-open]:rotate-90 motion-reduce:transition-none'
            aria-hidden='true'
          />
          {t('Raw response')}
        </CollapsibleTrigger>
        <CollapsibleContent className='CollapsibleContent h-full min-h-0'>
          <div className='h-80 pt-4 lg:h-full'>
            <CodeBlock
              className='my-0 pl-4'
              language='json'
              fillHeight
              enableCollapse={false}
              code={JSON.stringify(response, null, 2)}
            />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </section>
  )
}
