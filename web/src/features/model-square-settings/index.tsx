import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { SettingsPageFrame } from '@/features/system-settings/components/settings-page'
import { handleServerError } from '@/lib/handle-server-error'

import { getModelSquareConfig, modelSquareConfigQueryKey } from './api'
import { ModelSquareSettingsForm } from './components/settings-form'

export function ModelSquareSettings() {
  const { t } = useTranslation()
  const query = useQuery({
    queryKey: modelSquareConfigQueryKey,
    queryFn: getModelSquareConfig,
    retry: false,
    refetchOnWindowFocus: false,
  })
  useEffect(() => {
    if (query.error) handleServerError(query.error)
  }, [query.error])

  return (
    <SettingsPageFrame title={t('Model Square Settings')}>
      {query.isPending && <p role='status'>{t('Loading...')}</p>}
      {query.isError && (
        <div className='space-y-3'>
          <p role='alert'>{t('Failed to load model square settings')}</p>
          <Button
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            {t('Retry')}
          </Button>
        </div>
      )}
      {query.data && (
        <ModelSquareSettingsForm
          data={query.data.data}
          models={query.data.models}
        />
      )}
    </SettingsPageFrame>
  )
}
