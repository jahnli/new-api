import { memo, useCallback, useState, type ComponentProps } from 'react'
import { useTranslation } from 'react-i18next'

import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import { InputGroupButton } from '@/components/ui/input-group'

import { NOTIFICATION_TITLE_ICONS } from '../lib/message'

interface TitleIconPickerProps extends Pick<
  ComponentProps<typeof InputGroupButton>,
  'id' | 'aria-invalid' | 'aria-describedby' | 'onBlur' | 'ref'
> {
  value: string
  onChange: (icon: string) => void
}

export function TitleIconPicker(props: TitleIconPickerProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const onChange = props.onChange

  const selectIcon = useCallback(
    (icon: string): void => {
      onChange(icon)
      setOpen(false)
    },
    [onChange]
  )

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      title={t('Select icon')}
      keepMounted
      // Override the default keyframes; Base UI waits for this opacity transition.
      contentClassName='animate-none! transition-opacity duration-200! ease-out data-starting-style:opacity-0 data-ending-style:opacity-0 motion-reduce:transition-none sm:max-w-2xl'
      overlayClassName='animate-none! transition-opacity duration-200! ease-out data-starting-style:opacity-0 data-ending-style:opacity-0 motion-reduce:transition-none supports-backdrop-filter:backdrop-filter-none'
      trigger={
        props.value ? (
          <InputGroupButton
            id={props.id}
            ref={props.ref}
            size='icon-xs'
            className='relative left-0.5 flex items-center justify-center p-0 leading-none'
            onBlur={props.onBlur}
            aria-invalid={props['aria-invalid']}
            aria-describedby={props['aria-describedby']}
            aria-label={`${t('Select icon')}: ${props.value || t('None')}`}
            title={t('Select icon')}
          >
            <span
              className='relative -top-0.5 flex size-5 items-center justify-center text-base leading-none'
              aria-hidden='true'
            >
              {props.value}
            </span>
          </InputGroupButton>
        ) : (
          <Button
            id={props.id}
            ref={props.ref}
            type='button'
            variant='ghost'
            size='sm'
            className='text-muted-foreground h-6 px-2 text-xs'
            onBlur={props.onBlur}
            aria-invalid={props['aria-invalid']}
            aria-describedby={props['aria-describedby']}
          >
            {t('Select icon')}
          </Button>
        )
      }
    >
      <TitleIconGrid value={props.value} onSelect={selectIcon} />
    </Dialog>
  )
}

// Keep the mounted buttons out of the dialog's open/close render path.
const TitleIconGrid = memo(function TitleIconGrid(props: {
  value: string
  onSelect: (icon: string) => void
}) {
  const { t } = useTranslation()

  return (
    <div className='grid max-h-[60vh] grid-cols-6 gap-2 overflow-y-auto p-1 sm:grid-cols-10'>
      <Button
        type='button'
        variant={props.value === '' ? 'secondary' : 'outline'}
        className='aria-pressed:ring-primary h-11 w-full border-dashed aria-pressed:ring-2'
        aria-label={t('None')}
        title={t('None')}
        aria-pressed={props.value === ''}
        onClick={() => props.onSelect('')}
      />
      {NOTIFICATION_TITLE_ICONS.map((icon) => (
        <Button
          key={icon}
          type='button'
          variant={props.value === icon ? 'secondary' : 'ghost'}
          className='aria-pressed:ring-primary h-11 w-full text-2xl aria-pressed:ring-2'
          aria-label={`${t('Select icon')}: ${icon}`}
          aria-pressed={props.value === icon}
          onClick={() => props.onSelect(icon)}
        >
          <span aria-hidden='true'>{icon}</span>
        </Button>
      ))}
    </div>
  )
})
