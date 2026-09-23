import { useMutation } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import type { ColumnFiltersState } from '@tanstack/react-table'
import { Download, Loader2 } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { handleServerError } from '@/lib/handle-server-error'
import { useAuthStore } from '@/stores/auth-store'

import { useLogsViewScope } from './usage-logs-provider'

const route = getRouteApi('/_authenticated/usage-logs/$section')

export function CommonLogsExportButton(props: {
  columnFilters: ColumnFiltersState
}) {
  const { t } = useTranslation()
  const searchParams = route.useSearch()
  const { canManageScope, isAdminView } = useLogsViewScope()
  const selfUsername = useAuthStore((state) => state.auth.user?.username)
  const abortController = useRef<AbortController | null>(null)
  useEffect(() => () => abortController.current?.abort(), [])
  const exportMutation = useMutation({
    mutationFn: async () => {
      const controller = new AbortController()
      abortController.current = controller
      const config = {
        searchParams,
        columnFilters: props.columnFilters,
        canManageScope,
        isAdmin: isAdminView,
        selfUsername,
      }
      const { exportUsageLogs } = await import('../lib/export-excel')
      return exportUsageLogs(config, controller.signal)
    },
    onSuccess: (count) => {
      if (count === 0) {
        toast.info(t('No data'))
      } else {
        toast.success(t('Export successful'))
      }
    },
    onError: (error) => handleServerError(error, t('Export failed')),
    onSettled: () => {
      abortController.current = null
    },
  })

  return (
    <>
      <Button
        type='button'
        variant='outline'
        onClick={() => exportMutation.mutate()}
        disabled={exportMutation.isPending}
        aria-busy={exportMutation.isPending}
      >
        {exportMutation.isPending ? (
          <Loader2 className='animate-spin' aria-hidden='true' />
        ) : (
          <Download aria-hidden='true' />
        )}
        {exportMutation.isPending ? t('Exporting...') : t('Export')}
      </Button>
      {exportMutation.isPending && (
        <Button
          type='button'
          variant='ghost'
          onClick={() => abortController.current?.abort()}
        >
          {t('Cancel')}
        </Button>
      )}
    </>
  )
}
