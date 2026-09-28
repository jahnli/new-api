import { useQuery } from '@tanstack/react-query'
import { AlertCircle, Loader2 } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'

import { getDepartmentStats, getUsageAnalysis } from '../api'
import type { SubDepartmentStat } from '../types'
import { DepartmentStatsCards } from './department-stats-cards'
import { UsageAnalysisSection } from './usage-analysis'

interface SubDepartmentStatsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  department: SubDepartmentStat | null
  companyId: number
  startTimestamp: number
  endTimestamp: number
}

const USAGE_ANALYSIS_SKELETON_KEYS = Array.from(
  { length: 8 },
  (_, index) => `sub-department-usage-analysis-skeleton-${index}`
)

export function SubDepartmentStatsDialog(props: SubDepartmentStatsDialogProps) {
  const { t } = useTranslation()
  const departmentId = props.department?.department_id

  const queryParams = useMemo(() => {
    if (!departmentId) return null
    return {
      company_id: props.companyId,
      department_id: departmentId,
      start_timestamp: props.startTimestamp,
      end_timestamp: props.endTimestamp,
    }
  }, [departmentId, props.companyId, props.startTimestamp, props.endTimestamp])

  const statsQuery = useQuery({
    queryKey: ['department', 'stats', 'sub-dialog', queryParams],
    queryFn: () => {
      if (!queryParams) throw new Error('Missing query params')
      return getDepartmentStats(queryParams)
    },
    enabled: props.open && !!queryParams,
    staleTime: 60 * 1000,
  })

  const usageQuery = useQuery({
    queryKey: ['department', 'usage-analysis', 'sub-dialog', queryParams],
    queryFn: () => {
      if (!queryParams) throw new Error('Missing query params')
      return getUsageAnalysis(queryParams)
    },
    enabled: props.open && !!queryParams,
    staleTime: 60 * 1000,
  })

  if (!props.department) return null

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className='flex h-[85vh] max-h-[85vh] w-[min(1360px,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] flex-col overflow-hidden sm:max-w-[calc(100vw-2rem)]'>
        <DialogHeader className='shrink-0'>
          <DialogTitle>
            {t('Sub-department Statistics')} -{' '}
            {props.department.department_name}
          </DialogTitle>
        </DialogHeader>

        <div className='min-h-0 space-y-4 overflow-y-auto pt-2 pr-1'>
          {statsQuery.isError && (
            <Alert variant='destructive'>
              <AlertCircle className='size-4' />
              <AlertTitle>{t('Failed to load statistics')}</AlertTitle>
              <AlertDescription>
                {statsQuery.error instanceof Error
                  ? statsQuery.error.message
                  : t('An unexpected error occurred')}
              </AlertDescription>
            </Alert>
          )}

          {statsQuery.isFetching && !statsQuery.data && (
            <div className='overflow-hidden rounded-lg border'>
              <div className='divide-border/60 grid min-w-0 grid-cols-2 divide-x sm:grid-cols-3 lg:grid-cols-5'>
                {Array.from({ length: 10 }, (_, index) => (
                  <div
                    key={`sub-department-stats-skeleton-${index}`}
                    className='min-w-0 px-3 py-2.5 sm:px-5 sm:py-4'
                  >
                    <Skeleton className='h-3.5 w-20' />
                    <Skeleton className='mt-2 h-7 w-24' />
                  </div>
                ))}
              </div>
            </div>
          )}

          {statsQuery.data?.data && (
            <DepartmentStatsCards stat={statsQuery.data.data} />
          )}

          {usageQuery.isFetching && !usageQuery.data && (
            <div className='overflow-hidden rounded-lg border'>
              <div className='grid grid-cols-1 lg:grid-cols-2'>
                {USAGE_ANALYSIS_SKELETON_KEYS.map((key) => (
                  <div
                    key={key}
                    className='border-border/60 border-b lg:odd:border-r'
                  >
                    <div className='px-5 py-3'>
                      <Skeleton className='h-4 w-32' />
                    </div>
                    <div className='flex h-[300px] items-center justify-center p-2'>
                      <Loader2 className='text-muted-foreground size-6 animate-spin' />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {usageQuery.data?.data && (
            <UsageAnalysisSection data={usageQuery.data.data} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
