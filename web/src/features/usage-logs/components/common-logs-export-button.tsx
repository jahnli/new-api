import { useMutation } from '@tanstack/react-query'
import { Download, Loader2 } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { handleServerError } from '@/lib/handle-server-error'
import { useAuthStore } from '@/stores/auth-store'

import { useLogsViewScope } from './usage-logs-provider'

export function CommonLogsExportButton(props: {
  searchParams: Record<string, unknown>
}) {
  const { t } = useTranslation()
  const { canManageScope, isAdminView } = useLogsViewScope()
  const selfUsername = useAuthStore((state) => state.auth.user?.username)
  const abortController = useRef<AbortController | null>(null)
  useEffect(() => () => abortController.current?.abort(), [])
  const exportMutation = useMutation({
    mutationFn: async () => {
      const controller = new AbortController()
      abortController.current = controller
      const config = {
        searchParams: props.searchParams,
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
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type='button'
            variant='ghost'
            size='icon'
            className='text-muted-foreground hover:text-foreground size-7 max-sm:size-11'
            onClick={() => exportMutation.mutate()}
            disabled={exportMutation.isPending}
            aria-busy={exportMutation.isPending}
            aria-label={
              exportMutation.isPending ? t('Exporting...') : t('Export')
            }
          />
        }
      >
        {exportMutation.isPending ? (
          <Loader2 className='animate-spin' aria-hidden='true' />
        ) : (
          <Download aria-hidden='true' />
        )}
      </TooltipTrigger>
      <TooltipContent>
        {exportMutation.isPending ? t('Exporting...') : t('Export')}
      </TooltipContent>
    </Tooltip>
  )
}
