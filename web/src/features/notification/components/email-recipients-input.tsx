import {
  useCallback,
  useId,
  useRef,
  useState,
  type ComponentProps,
} from 'react'

import { Button } from '@/components/ui/button'
import { Popover, PopoverContent } from '@/components/ui/popover'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

const EMAIL_DOMAINS = ['qq.com', '163.com', 'gmail.com']

type EmailRecipientsInputProps = Omit<
  ComponentProps<typeof Textarea>,
  'value' | 'defaultValue' | 'onChange'
> & {
  defaultValue: string
  onValueChange: (value: string) => void
}

export function EmailRecipientsInput(props: EmailRecipientsInputProps) {
  const { defaultValue, onValueChange, ref, ...textareaProps } = props
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const setInputRef = useCallback(
    (node: HTMLTextAreaElement | null) => {
      inputRef.current = node
      if (typeof ref === 'function') ref(node)
      else if (ref) ref.current = node
    },
    [ref]
  )
  const [text, setText] = useState(defaultValue)
  const [caret, setCaret] = useState(0)
  const [active, setActive] = useState(false)
  const [suggestionIndex, setSuggestionIndex] = useState(0)
  const overlayRef = useRef<HTMLDivElement>(null)
  const anchorRef = useRef<HTMLSpanElement>(null)
  const listId = useId()
  const match = text
    .slice(0, caret)
    .match(/(?:^|[\s,;，；])([^\s,;，；@]*@)([^\s,;，；@]*)$/)
  const suffix = match?.[2].toLowerCase()
  const tokenEnd = caret + text.slice(caret).search(/[\s,;，；]|$/)
  const domains =
    active && suffix !== undefined && caret === tokenEnd
      ? EMAIL_DOMAINS.filter(
          (domain) => domain.startsWith(suffix) && domain !== suffix
        )
      : []
  const suggestion = domains[suggestionIndex % domains.length]
  const acceptDomain = (domain: string) => {
    const remaining = text.slice(caret)
    const existingSeparator = remaining.match(/^[\s,;，；]+/)?.[0] ?? ''
    const separator = existingSeparator || ', '
    const completion = domain.slice(suffix?.length ?? 0) + separator
    const nextText =
      text.slice(0, caret) +
      completion +
      remaining.slice(existingSeparator.length)
    const nextCaret = caret + completion.length
    setText(nextText)
    setCaret(nextCaret)
    setActive(false)
    onValueChange(nextText)
    inputRef.current?.focus()
    requestAnimationFrame(() =>
      inputRef.current?.setSelectionRange(nextCaret, nextCaret)
    )
  }

  return (
    <div
      className='relative'
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setActive(false)
      }}
    >
      <Textarea
        {...textareaProps}
        ref={setInputRef}
        value={text}
        aria-autocomplete='list'
        aria-expanded={domains.length > 0}
        aria-controls={domains.length > 0 ? listId : undefined}
        aria-activedescendant={
          suggestion ? `${listId}-${suggestion}` : undefined
        }
        wrap='soft'
        onScroll={(event) => {
          if (overlayRef.current) {
            overlayRef.current.scrollTop = event.currentTarget.scrollTop
            overlayRef.current.scrollLeft = event.currentTarget.scrollLeft
          }
          props.onScroll?.(event)
        }}
        onFocus={(event) => {
          setCaret(event.currentTarget.selectionStart)
          setActive(true)
          props.onFocus?.(event)
        }}
        onSelect={(event) => {
          setCaret(event.currentTarget.selectionStart)
          setActive(
            event.currentTarget.selectionStart ===
              event.currentTarget.selectionEnd
          )
          props.onSelect?.(event)
        }}
        onChange={(event) => {
          setSuggestionIndex(0)
          setText(event.target.value)
          setCaret(event.target.selectionStart)
          setActive(true)
          onValueChange(event.target.value)
        }}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) return
          if (
            suggestion &&
            (event.key === 'Enter' || (event.key === 'Tab' && !event.shiftKey))
          ) {
            event.preventDefault()
            acceptDomain(suggestion)
            return
          }
          if (
            suggestion &&
            (event.key === 'ArrowDown' || event.key === 'ArrowUp')
          ) {
            event.preventDefault()
            setSuggestionIndex(
              (index) =>
                (index + (event.key === 'ArrowDown' ? 1 : domains.length - 1)) %
                domains.length
            )
            return
          }
          if (event.key === 'Escape') setActive(false)
          props.onKeyDown?.(event)
        }}
      />
      <div
        ref={overlayRef}
        aria-hidden='true'
        className='pointer-events-none absolute inset-px overflow-hidden px-2.5 py-2 font-mono text-sm [overflow-wrap:break-word] whitespace-pre-wrap'
      >
        {suggestion && (
          <>
            <span className='invisible'>{text.slice(0, caret)}</span>
            <span
              ref={anchorRef}
              className='inline-block h-5 w-px align-text-bottom'
            />
            <span className='invisible'>{text.slice(caret)}</span>
          </>
        )}
      </div>
      <Popover
        open={domains.length > 0}
        onOpenChange={(open) => {
          if (!open) setActive(false)
        }}
      >
        <PopoverContent
          anchor={anchorRef}
          align='start'
          initialFocus={false}
          finalFocus={false}
          className='w-48 gap-0 p-1'
        >
          <div
            id={listId}
            role='listbox'
            aria-label={props['aria-label'] ?? props.placeholder}
          >
            {domains.map((domain) => (
              <Button
                key={domain}
                id={`${listId}-${domain}`}
                type='button'
                role='option'
                aria-selected={domain === suggestion}
                variant='ghost'
                className={cn(
                  'h-8 w-full justify-start font-mono text-sm',
                  domain === suggestion && 'bg-accent'
                )}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => acceptDomain(domain)}
              >
                @{domain}
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
