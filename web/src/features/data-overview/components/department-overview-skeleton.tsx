import { Building2, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

const STATS_SKELETON_KEYS = Array.from(
  { length: 10 },
  (_, index) => `stats-skeleton-${index}`
)
const USAGE_ANALYSIS_SKELETON_KEYS = Array.from(
  { length: 8 },
  (_, index) => `usage-analysis-skeleton-${index}`
)
const USER_TABLE_ROW_KEYS = Array.from(
  { length: 8 },
  (_, index) => `user-table-row-skeleton-${index}`
)

export function StatsCardsSkeleton() {
  return (
    <div className='overflow-hidden rounded-lg border'>
      <div className='divide-border/60 grid min-w-0 grid-cols-2 divide-x sm:grid-cols-3 lg:grid-cols-5'>
        {STATS_SKELETON_KEYS.map((key) => (
          <div key={key} className='min-w-0 px-3 py-2.5 sm:px-5 sm:py-4'>
            <Skeleton className='h-3.5 w-20' />
            <Skeleton className='mt-2 h-7 w-24' />
          </div>
        ))}
      </div>
    </div>
  )
}

export function SubDepartmentStatsSkeleton() {
  const { t } = useTranslation()

  return (
    <Card className='mt-4'>
      <CardHeader className='pb-3'>
        <CardTitle className='flex items-center gap-2 text-base'>
          <Building2 className='text-primary size-5' />
          {t('Sub-department Statistics')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className='space-y-3'>
          {Array.from({ length: 4 }, (_, index) => (
            <div
              key={`sub-dept-row-skeleton-${index}`}
              className='flex items-center gap-4'
            >
              <Skeleton className='h-4 w-32' />
              <Skeleton className='h-4 flex-1' />
              <Skeleton className='h-4 w-16' />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export function UsersTableSkeleton() {
  const { t } = useTranslation()

  return (
    <Card className='mt-4'>
      <CardHeader className='flex flex-row items-center justify-between pb-3'>
        <CardTitle className='flex items-center gap-2 text-base'>
          <Users className='text-primary size-5' />
          {t('Department Personnel List')}
        </CardTitle>
        <Skeleton className='h-8 w-16' />
      </CardHeader>
      <CardContent className='px-4 pt-0 pb-4'>
        <div className='border-border/60 overflow-hidden rounded-lg border'>
          <div className='bg-muted/30 flex gap-4 border-b px-4 py-3'>
            <Skeleton className='h-4 w-20' />
            <Skeleton className='h-4 w-24' />
            <Skeleton className='h-4 w-16' />
            <Skeleton className='hidden h-4 w-20 sm:block' />
            <Skeleton className='hidden h-4 w-20 md:block' />
          </div>
          {USER_TABLE_ROW_KEYS.map((key) => (
            <div
              key={key}
              className='border-border/60 flex gap-4 border-b px-4 py-3 last:border-b-0'
            >
              <Skeleton className='h-4 w-24' />
              <Skeleton className='h-4 w-32' />
              <Skeleton className='h-4 w-16' />
              <Skeleton className='hidden h-4 w-20 sm:block' />
              <Skeleton className='hidden h-4 w-20 md:block' />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export function UsageAnalysisSkeleton() {
  return (
    <Card className='mt-4'>
      <CardHeader className='pb-3'>
        <CardTitle className='flex items-center gap-2 text-base'>
          <Skeleton className='size-5' />
          <Skeleton className='h-4 w-24' />
        </CardTitle>
      </CardHeader>
      <CardContent className='p-0'>
        <div className='grid grid-cols-1 lg:grid-cols-2'>
          {USAGE_ANALYSIS_SKELETON_KEYS.map((key) => (
            <div
              key={key}
              className='border-border/60 border-b lg:odd:border-r'
            >
              <div className='px-5 py-3'>
                <Skeleton className='h-4 w-32' />
              </div>
              <div
                className='flex items-center justify-center p-2'
                style={{ height: 300 }}
              >
                <Skeleton className='h-[240px] w-[240px] rounded-full' />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export function DepartmentOverviewSkeleton() {
  const { t } = useTranslation()

  return (
    <div role='status' aria-busy='true' aria-label={t('Loading...')}>
      <span className='sr-only'>{t('Loading...')}</span>
      <StatsCardsSkeleton />
      <SubDepartmentStatsSkeleton />
      <UsersTableSkeleton />
      <UsageAnalysisSkeleton />
    </div>
  )
}
