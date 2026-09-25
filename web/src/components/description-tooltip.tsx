import { Info } from 'lucide-react'

import { TextTooltip } from '@/components/text-tooltip'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function DescriptionTooltip(props: {
  description: string
  className?: string
}) {
  return (
    <TextTooltip
      content={props.description}
      delay={0}
      contentClassName='max-w-64 leading-relaxed'
    >
      <Button
        type='button'
        variant='ghost'
        size='icon-xs'
        className={cn(
          'text-muted-foreground size-6 shrink-0 cursor-help',
          props.className
        )}
        aria-label={props.description}
      >
        <Info className='size-3.5' aria-hidden='true' />
      </Button>
    </TextTooltip>
  )
}
