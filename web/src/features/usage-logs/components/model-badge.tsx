import { Route } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card'
import { getLobeIcon } from '@/lib/lobe-icon'
import { resolveModelProvider } from '@/lib/model-provider'
import { cn } from '@/lib/utils'

interface ModelBadgeProps {
  modelName: string
  actualModel?: string
  className?: string
  wrapText?: boolean
  onInspect?: () => void
}

function ModelBadgeContent(props: ModelBadgeProps) {
  const provider = resolveModelProvider(props.modelName)

  return (
    <StatusBadge
      copyText={props.modelName}
      copyable={!props.onInspect}
      size='sm'
      showDot={!provider?.icon}
      autoColor={provider?.icon ? undefined : props.modelName}
      className={cn(
        'border-border/60 bg-muted/30 h-6 max-w-none gap-1.5 rounded-md border px-2 [font-family:var(--font-body)]',
        provider?.icon && 'text-foreground',
        props.wrapText && 'h-auto min-h-6 max-w-full py-0.5 whitespace-normal',
        props.className
      )}
    >
      <span
        className={cn(
          'flex items-center gap-1.5',
          props.wrapText ? 'max-w-full min-w-0' : 'max-w-none'
        )}
      >
        {provider?.icon && (
          <span
            className='flex h-[18px] w-[18px] shrink-0 items-center justify-center'
            title={provider.label ?? provider.name}
            aria-label={provider.label ?? provider.name}
          >
            {getLobeIcon(provider.icon, 18)}
          </span>
        )}
        <span
          className={
            props.wrapText
              ? 'line-clamp-2 [overflow-wrap:anywhere]'
              : 'whitespace-nowrap'
          }
        >
          {props.modelName}
        </span>
      </span>
    </StatusBadge>
  )
}

export function ModelBadge(props: ModelBadgeProps) {
  const { t } = useTranslation()

  if (props.onInspect) {
    return (
      <Button
        variant='ghost'
        aria-label={`${t('Model')}: ${props.modelName}`}
        aria-haspopup='dialog'
        onClick={props.onInspect}
        className='h-auto min-h-8 max-w-full min-w-0 justify-start gap-1 px-0 py-0 text-left font-normal whitespace-normal'
      >
        <ModelBadgeContent {...props} />
        {props.actualModel && (
          <Route className='text-muted-foreground size-3 shrink-0' />
        )}
      </Button>
    )
  }

  if (!props.actualModel) {
    return <ModelBadgeContent {...props} />
  }

  return (
    <HoverCard>
      <HoverCardTrigger
        delay={0}
        closeDelay={100}
        render={
          <button type='button' className='inline-flex items-center gap-1' />
        }
      >
        <ModelBadgeContent {...props} />
        <Route
          className='text-muted-foreground size-3 shrink-0'
          aria-hidden='true'
        />
      </HoverCardTrigger>
      <HoverCardContent
        align='start'
        className='w-[24rem] max-w-[calc(100vw-2rem)] p-4'
      >
        <div className='grid grid-cols-[7rem_minmax(0,1fr)] items-start gap-x-4 gap-y-3'>
          <span className='text-muted-foreground text-xs'>
            {t('Request Model:')}
          </span>
          <span className='min-w-0 text-right font-mono text-xs font-medium break-all'>
            {props.modelName}
          </span>
          <span className='text-muted-foreground text-xs'>
            {t('Actual Model:')}
          </span>
          <span className='min-w-0 text-right font-mono text-xs font-medium break-all'>
            {props.actualModel}
          </span>
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}
