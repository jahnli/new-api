import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { TextTooltip } from '@/components/text-tooltip'
import {
  Combobox,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  useComboboxAnchor,
} from '@/components/ui/combobox'
import { ComboboxInput as ChannelComboboxInput } from '@/components/ui/combobox-input'
import { useDebounce } from '@/hooks/use-debounce'
import { useDemoMode } from '@/hooks/use-demo-mode'
import { getDemoModeUsername } from '@/lib/demo-mode'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

import { getLogKeySuggestions } from '../api'
import type { LogKeyChoice } from '../types'

export function LogKeyNameFilter({
  personalPicker,
  isAdmin,
  visible,
  value,
  onChange,
}: {
  personalPicker: boolean
  isAdmin: boolean
  visible: boolean
  value: LogKeyChoice
  onChange: (value: LogKeyChoice, apply?: boolean) => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [personalQuery, setPersonalQuery] = useState<string | null>(null)
  const anchor = useComboboxAnchor()
  const demoMode = useDemoMode()
  const userId = useAuthStore((state) => state.auth.user?.id)
  const name = value.keyName ?? ''
  const keyword = (personalPicker ? (personalQuery ?? '') : name).trim()
  const debounced = useDebounce(keyword, 250)
  const canSuggest = !isAdmin || keyword !== ''
  const pickerOpen = personalPicker ? personalQuery !== null : open
  const enabled = pickerOpen && !!userId && canSuggest && debounced === keyword
  const query = useQuery({
    queryKey: ['log-key-names', userId, isAdmin, debounced],
    queryFn: ({ signal }) => getLogKeySuggestions(isAdmin, debounced, signal),
    enabled,
    staleTime: 30_000,
  })
  const personalOptions = useMemo(() => {
    if (!personalPicker || !enabled) return []
    return (query.data ?? []).map(({ name }) => ({ value: name, label: name }))
  }, [personalPicker, enabled, query.data])
  if (personalPicker) {
    let emptyText = 'No results found'
    if (!enabled || query.isLoading) emptyText = 'Loading...'
    else if (query.isError) emptyText = 'Failed to load'
    const mask = visible ? undefined : '[-webkit-text-security:disc]'
    return (
      <ChannelComboboxInput
        aria-label={t('API key name')}
        placeholder={t('API key name')}
        options={personalOptions}
        value={name}
        emptyText={emptyText}
        openOnFocus
        allowCustomValue
        showCustomValueHint={false}
        className={mask}
        itemClassName={mask}
        onSearchQueryChange={setPersonalQuery}
        onValueChange={(keyName, reason) => {
          const owner = reason === 'select' ? userId : undefined
          onChange(
            { keyName: keyName || undefined, keyOwnerId: owner },
            reason === 'custom'
          )
        }}
      />
    )
  }
  const suggestions = enabled ? (query.data ?? []) : []
  const choices = suggestions.map((item) => ({
    keyName: item.name,
    keyOwnerId: item.user_id,
    keyUsername: item.username && getDemoModeUsername(item.username, demoMode),
    keyDisplayName:
      item.display_name && getDemoModeUsername(item.display_name, demoMode),
  }))
  const label = (item: LogKeyChoice) => {
    const ownerName = item.keyDisplayName || item.keyUsername
    return isAdmin && ownerName
      ? `${item.keyName} · ${getDemoModeUsername(ownerName, demoMode)}`
      : (item.keyName ?? '')
  }
  let hint = ''
  if (!enabled || query.isLoading) hint = t('Loading...')
  else if (query.isError) hint = t('Failed to load')
  else if (!suggestions.length) hint = t('No results found')
  return (
    <Combobox<LogKeyChoice>
      items={choices}
      filter={null}
      value={value.keyOwnerId ? value : null}
      isItemEqualToValue={(item, selected) =>
        item.keyOwnerId === selected.keyOwnerId &&
        item.keyName === selected.keyName
      }
      highlightItemOnHover={false}
      open={open}
      onOpenChange={setOpen}
      inputValue={open ? name : label(value)}
      onInputValueChange={(text, details) => {
        // Closing the popup can emit input-clear for free text. Keep the filter draft.
        if (details.reason === 'input-change') {
          onChange({ keyName: text || undefined })
        }
      }}
      itemToStringLabel={label}
      onValueChange={(item) => {
        if (item) onChange(item, true)
      }}
    >
      <div ref={anchor}>
        <ComboboxInput
          aria-label={t('API key name')}
          placeholder={t('API key name')}
          triggerAriaLabel={t('Open')}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (
              event.key !== 'Enter' ||
              event.nativeEvent.isComposing ||
              event.nativeEvent.keyCode === 229
            ) {
              return
            }
            if (
              open &&
              event.currentTarget.getAttribute('aria-activedescendant')
            ) {
              return
            }
            event.preventDefault()
            setOpen(false)
            onChange(
              value.keyOwnerId ? value : { keyName: keyword || undefined },
              true
            )
          }}
          className={
            visible ? undefined : '[&_input]:[-webkit-text-security:disc]'
          }
        />
      </div>
      {canSuggest && (
        <ComboboxContent anchor={anchor}>
          <ComboboxList>
            {(item: LogKeyChoice) => {
              const ownerName = isAdmin
                ? getDemoModeUsername(
                    item.keyDisplayName || item.keyUsername || '',
                    demoMode
                  )
                : ''
              return (
                <ComboboxItem
                  key={JSON.stringify([item.keyOwnerId, item.keyName])}
                  value={item}
                >
                  <span
                    className={cn(
                      'flex w-full min-w-0 items-center justify-between gap-4',
                      !visible && '[-webkit-text-security:disc]'
                    )}
                  >
                    <TextTooltip
                      content={visible ? item.keyName : undefined}
                      onlyWhenOverflow
                    >
                      <span className='min-w-0 flex-1 truncate'>
                        {item.keyName}
                      </span>
                    </TextTooltip>
                    {ownerName && (
                      <TextTooltip
                        content={visible ? ownerName : undefined}
                        onlyWhenOverflow
                      >
                        <span className='text-muted-foreground max-w-1/2 min-w-0 truncate text-right'>
                          {ownerName}
                        </span>
                      </TextTooltip>
                    )}
                  </span>
                </ComboboxItem>
              )
            }}
          </ComboboxList>
          {hint && (
            <div
              role='status'
              className='text-muted-foreground px-2 py-1.5 text-xs'
            >
              {hint}
            </div>
          )}
        </ComboboxContent>
      )}
    </Combobox>
  )
}
