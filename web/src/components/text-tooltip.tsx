import type { ReactElement, ReactNode } from 'react'

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useOverflow } from '@/hooks/use-overflow'
import { cn } from '@/lib/utils'

type TextTooltipProps = {
  content: ReactNode
  children: ReactElement<{
    tabIndex?: number
    'aria-hidden'?: boolean | 'true' | 'false'
  }>
  side?: 'top' | 'bottom' | 'left' | 'right'
  contentClassName?: string
  delay?: number
  onlyWhenOverflow?: boolean
}

/** Plain text hints share timing and styling without adding a layout wrapper. */
export function TextTooltip(props: TextTooltipProps) {
  const overflow = useOverflow(props.onlyWhenOverflow === true)
  const hasContent =
    props.content !== null &&
    props.content !== undefined &&
    props.content !== '' &&
    props.content !== false
  const disabled =
    !hasContent || (props.onlyWhenOverflow === true && !overflow.isOverflowing)
  const child = props.children
  const focusableText =
    typeof child.type === 'string' &&
    ['span', 'div', 'p', 'time', 'dt', 'dd', 'h3', 'img'].includes(
      child.type
    ) &&
    child.props['aria-hidden'] !== true &&
    child.props['aria-hidden'] !== 'true'

  if (!hasContent) return child

  return (
    <Tooltip disabled={disabled}>
      <TooltipTrigger
        ref={props.onlyWhenOverflow ? overflow.ref : undefined}
        delay={props.delay}
        tabIndex={
          child.props.tabIndex ?? (focusableText && !disabled ? 0 : undefined)
        }
        render={props.children}
      />
      {hasContent && (
        <TooltipContent
          side={props.side}
          className={cn(
            'whitespace-pre-line break-words',
            props.contentClassName
          )}
        >
          {props.content}
        </TooltipContent>
      )}
    </Tooltip>
  )
}
