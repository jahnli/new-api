import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'

import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import { Combobox } from '@/components/ui/combobox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { useStatus } from '@/hooks/use-status'

import {
  buildMagpieImportUrl,
  magpieApps,
  type MagpieApp,
} from '../../lib/magpie-import'
import type { ApiKey } from '../../types'

const modelListSchema = z.object({
  data: z.array(z.object({ id: z.string() })),
})

export function MagpieDialog({
  token,
  fullKey,
  onClose,
}: {
  token: ApiKey
  fullKey: string
  onClose: () => void
}) {
  const { t } = useTranslation()
  const { status, loading } = useStatus()
  const [name, setName] = useState('My Codex')
  const [app, setApp] = useState<MagpieApp>('Codex')
  const [model, setModel] = useState<string | null>(null)
  const models = useQuery({
    queryKey: ['magpie-import-models', token.id],
    queryFn: async ({ signal }) => {
      // The relay applies this key's group and model limits to its catalog.
      const response = await fetch('/v1/models', {
        headers: { Authorization: `Bearer ${fullKey}` },
        credentials: 'omit',
        redirect: 'error',
        cache: 'no-store',
        signal,
      })
      if (!response.ok) throw new Error('Failed to load models')
      const { data } = modelListSchema.parse(await response.json())
      return data
        .filter(({ id }) => id && !id.includes(','))
        .map(({ id }) => ({ value: id, label: id }))
    },
    retry: false,
    gcTime: 0,
  })
  const canImport =
    !!name.trim() &&
    !loading &&
    models.isSuccess &&
    models.data.some(({ value }) => value === model)

  function handleImport() {
    if (!canImport || !model) return
    const configuredAddress =
      typeof status?.server_address === 'string' && status.server_address.trim()
    const url = buildMagpieImportUrl({
      serverAddress: configuredAddress || window.location.origin,
      tokenId: token.id,
      fullKey,
      name,
      app,
      model,
    })
    if (!url) {
      toast.error(t('Invalid inference server address'))
      return
    }
    try {
      window.location.assign(url)
      onClose()
    } catch {
      toast.error(t('An unexpected error occurred'))
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={t('Import to Magpie')}
      contentClassName='sm:max-w-md'
      bodyClassName='space-y-4'
      footer={
        <>
          <Button variant='outline' onClick={onClose}>
            {t('Cancel')}
          </Button>
          <Button onClick={handleImport} disabled={!canImport}>
            {t('Open Magpie')}
          </Button>
        </>
      }
    >
      <div className='space-y-2'>
        <Label id='magpie-application'>{t('Application')}</Label>
        <RadioGroup
          aria-labelledby='magpie-application'
          value={app}
          onValueChange={(value) => {
            const selected = magpieApps.find((item) => item === value)
            if (selected && selected !== app) {
              setApp(selected)
              setName(`My ${selected}`)
              setModel(null)
            }
          }}
          className='flex flex-wrap gap-4'
        >
          {magpieApps.map((item) => (
            <div key={item} className='flex items-center gap-2'>
              <RadioGroupItem id={`magpie-app-${item}`} value={item} />
              <Label htmlFor={`magpie-app-${item}`} className='cursor-pointer'>
                {t(item)}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </div>
      <div className='space-y-2'>
        <Label htmlFor='magpie-name' required>
          {t('Name')}
        </Label>
        <Input
          id='magpie-name'
          value={name}
          placeholder={`My ${app}`}
          maxLength={80}
          onChange={(event) => setName(event.target.value)}
        />
      </div>
      <div className='space-y-2'>
        <Label htmlFor='magpie-model' required>
          {t('Model')}
        </Label>
        <Combobox
          id='magpie-model'
          aria-label={t('Model')}
          options={models.data ?? []}
          value={model}
          onValueChange={setModel}
          disabled={!models.isSuccess}
          placeholder={models.isPending ? t('Loading...') : t('Select a model')}
          emptyText={t('No models found')}
        />
        {models.isError && (
          <div className='flex items-center gap-2'>
            <span role='alert' className='text-destructive text-sm'>
              {t('Failed to load models')}
            </span>
            <Button
              size='sm'
              variant='outline'
              disabled={models.isFetching}
              onClick={() => void models.refetch()}
            >
              {t('Retry')}
            </Button>
          </div>
        )}
      </div>
    </Dialog>
  )
}
