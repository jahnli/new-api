import { useQuery } from '@tanstack/react-query'
import { AlertCircle, Building2, Loader2, Search } from 'lucide-react'
import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react'
import { useTranslation } from 'react-i18next'

import { SectionPageLayout } from '@/components/layout'
import { FadeIn } from '@/components/page-transition'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { CompactDateTimeRangePicker } from '@/features/usage-logs/components/compact-date-time-range-picker'
import dayjs from '@/lib/dayjs'

import {
  getDepartmentTree,
  getCompanySubtree,
  getDepartmentStats,
  getSubDepartmentStats,
  getUsageAnalysis,
  getDepartmentUsers,
  getDepartmentUserRankings,
} from './api'
import {
  DepartmentOverviewSkeleton,
  StatsCardsSkeleton,
  SubDepartmentStatsSkeleton,
  UsageAnalysisSkeleton,
} from './components/department-overview-skeleton'
import { DepartmentSearchPrompt } from './components/department-search-prompt'
import { DepartmentStatsCards } from './components/department-stats-cards'
import { DepartmentTreeSelect } from './components/department-tree-select'
import { DepartmentUsersTable } from './components/department-users-table'
import { ExportDialog } from './components/export-dialog'
import { NotifySettingsDialog } from './components/notify-settings-dialog'
import { SubDepartmentStats } from './components/sub-department-stats'
import { UsageAnalysisSection } from './components/usage-analysis'
import {
  createDepartmentQueryParams,
  findDepartmentNodeByValue,
  findFirstSelectableNode,
  isDepartmentNodeDisabled,
} from './lib/department-selection'
import {
  DEPARTMENT_USERS_INITIAL_PAGE_SIZE,
  DEPARTMENT_USERS_INITIAL_SORT_BY,
  DEPARTMENT_USERS_INITIAL_SORT_ORDER,
} from './lib/department-users-query'
import { getOverviewLoadingState } from './lib/overview-loading'
import type { DepartmentQueryParams, DeptTreeNode } from './types'

const EMPTY_DEPARTMENT_TREE: DeptTreeNode[] = []

export function DataOverview() {
  const { t } = useTranslation()
  const [selectedNode, setSelectedNode] = useState<DeptTreeNode | null>(null)
  const [dateRange, setDateRange] = useState<{ start?: Date; end?: Date }>(
    () => ({
      start: dayjs().startOf('month').toDate(),
      end: dayjs().endOf('month').toDate(),
    })
  )
  const [queryParams, setQueryParams] = useState<DepartmentQueryParams | null>(
    null
  )
  // Company subtrees fetched lazily when the user expands a company node,
  // keyed by the company node value (e.g. "company:2").
  const [lazyCompanySubtrees, setLazyCompanySubtrees] = useState<
    Record<string, DeptTreeNode>
  >({})
  // Company node values whose subtree request is currently in-flight.
  const [loadingCompanyValues, setLoadingCompanyValues] = useState<Set<string>>(
    () => new Set()
  )

  const treeQuery = useQuery({
    queryKey: ['department', 'tree'],
    queryFn: getDepartmentTree,
    staleTime: 5 * 60 * 1000,
    retry: 2,
  })

  const statsQuery = useQuery({
    queryKey: ['department', 'stats', queryParams],
    queryFn: () => {
      if (!queryParams) throw new Error('Missing query params')
      return getDepartmentStats(queryParams)
    },
    enabled: !!queryParams,
    staleTime: 60 * 1000,
  })

  const subStatsQuery = useQuery({
    queryKey: ['department', 'sub-stats', queryParams],
    queryFn: () => {
      if (!queryParams) throw new Error('Missing query params')
      return getSubDepartmentStats(queryParams)
    },
    enabled: !!queryParams,
    staleTime: 60 * 1000,
  })

  const usageQuery = useQuery({
    queryKey: ['department', 'usage-analysis', queryParams],
    queryFn: () => {
      if (!queryParams) throw new Error('Missing query params')
      return getUsageAnalysis(queryParams)
    },
    enabled: !!queryParams,
    staleTime: 60 * 1000,
  })

  const usersQuery = useQuery({
    queryKey: ['department', 'initial-users', queryParams],
    queryFn: () => {
      if (!queryParams) throw new Error('Missing query params')
      return getDepartmentUsers({
        ...queryParams,
        page: 1,
        page_size: DEPARTMENT_USERS_INITIAL_PAGE_SIZE,
        sort_by: DEPARTMENT_USERS_INITIAL_SORT_BY,
        sort_order: DEPARTMENT_USERS_INITIAL_SORT_ORDER,
        include_unregistered: true,
      })
    },
    enabled: !!queryParams,
    staleTime: 60 * 1000,
  })

  const rankingsQuery = useQuery({
    queryKey: ['department', 'user-rankings', queryParams],
    queryFn: () => {
      if (!queryParams) throw new Error('Missing query params')
      return getDepartmentUserRankings(queryParams)
    },
    enabled: !!queryParams,
    staleTime: 60 * 1000,
  })

  const loadingState = getOverviewLoadingState({
    statsFetching: statsQuery.isFetching,
    hasStatsData: Boolean(statsQuery.data),
    subStatsFetching: subStatsQuery.isFetching,
    hasSubStatsData: Boolean(subStatsQuery.data),
    usageFetching: usageQuery.isFetching,
    hasUsageData: Boolean(usageQuery.data),
    usersFetching: usersQuery.isFetching,
    hasUsersData: Boolean(usersQuery.data),
    rankingsFetching: rankingsQuery.isFetching,
    hasRankingsData: Boolean(rankingsQuery.data),
  })

  const treeData = treeQuery.data?.data
  const baseTreeData = treeData?.tree_data ?? EMPTY_DEPARTMENT_TREE

  // Merge lazily-loaded company subtrees into the base tree so that companies
  // whose departments were fetched on demand render their children.
  const displayTreeData = useMemo(() => {
    if (Object.keys(lazyCompanySubtrees).length === 0) return baseTreeData
    return baseTreeData.map(
      (companyNode) => lazyCompanySubtrees[companyNode.value] ?? companyNode
    )
  }, [baseTreeData, lazyCompanySubtrees])

  const handleLoadCompanyChildren = useCallback(
    async (companyNode: DeptTreeNode) => {
      const companyId = companyNode.company_id
      if (!companyId) return
      // Skip if already loaded or a request is already in-flight.
      if (
        lazyCompanySubtrees[companyNode.value] ||
        loadingCompanyValues.has(companyNode.value)
      ) {
        return
      }
      setLoadingCompanyValues((prev) => {
        const next = new Set(prev)
        next.add(companyNode.value)
        return next
      })
      try {
        const result = await getCompanySubtree(companyId)
        setLazyCompanySubtrees((prev) => ({
          ...prev,
          [companyNode.value]: result.data.node,
        }))
      } finally {
        setLoadingCompanyValues((prev) => {
          const next = new Set(prev)
          next.delete(companyNode.value)
          return next
        })
      }
    },
    [lazyCompanySubtrees, loadingCompanyValues]
  )

  useEffect(() => {
    if (!treeData || selectedNode) return

    let initialNode: DeptTreeNode | null = null
    const firstLeaderId = treeData.leader_dept_ids[0]
    if (firstLeaderId) {
      const leaderNode = findDepartmentNodeByValue(
        displayTreeData,
        firstLeaderId
      )
      if (leaderNode && !isDepartmentNodeDisabled(leaderNode)) {
        initialNode = leaderNode
      }
    }
    if (!initialNode) {
      initialNode = findFirstSelectableNode(displayTreeData)
    }
    if (!initialNode) return

    setSelectedNode(initialNode)
    setQueryParams(
      createDepartmentQueryParams(
        initialNode,
        dateRange.start ? Math.floor(dateRange.start.getTime() / 1000) : 0,
        dateRange.end ? Math.floor(dateRange.end.getTime() / 1000) : 0
      )
    )
  }, [displayTreeData, treeData, selectedNode, dateRange.start, dateRange.end])

  const handleDeptChange = (_deptId: string, node: DeptTreeNode) => {
    setSelectedNode(node)
    setQueryParams(null)
  }

  const handleSearch = () => {
    if (!selectedNode) return
    setQueryParams(
      createDepartmentQueryParams(
        selectedNode,
        dateRange.start ? Math.floor(dateRange.start.getTime() / 1000) : 0,
        dateRange.end ? Math.floor(dateRange.end.getTime() / 1000) : 0
      )
    )
  }

  let departmentSelector: ReactNode = null
  if (treeQuery.isLoading) {
    departmentSelector = <Skeleton className='h-8 w-[200px]' />
  } else if (treeData) {
    departmentSelector = (
      <DepartmentTreeSelect
        treeData={displayTreeData}
        value={selectedNode?.value}
        onValueChange={handleDeptChange}
        onLoadNodeChildren={handleLoadCompanyChildren}
        loadingNodeValues={loadingCompanyValues}
        disabled={treeQuery.isFetching}
      />
    )
  }

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>
        <div className='flex flex-wrap items-center gap-x-3 gap-y-2'>
          <span>{t('Data Overview')}</span>
          {departmentSelector}
          <CompactDateTimeRangePicker
            start={dateRange.start}
            end={dateRange.end}
            onChange={setDateRange}
            className='max-w-[302px]'
          />
          {selectedNode && (
            <div className='ml-auto flex items-center gap-2'>
              <Button
                className='gap-1.5'
                onClick={handleSearch}
                disabled={loadingState.isSearching}
              >
                {loadingState.isSearching ? (
                  <Loader2 className='size-3.5 animate-spin' />
                ) : (
                  <Search className='size-3.5' />
                )}
                {t('Search')}
              </Button>
              <ExportDialog
                queryParams={queryParams}
                treeData={displayTreeData}
                stats={statsQuery.data?.data}
                subStats={subStatsQuery.data?.data ?? []}
              />
              <NotifySettingsDialog />
            </div>
          )}
        </div>
      </SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <FadeIn>
          {treeQuery.isError && (
            <Alert variant='destructive'>
              <AlertCircle className='size-4' />
              <AlertTitle>{t('Failed to load department tree')}</AlertTitle>
              <AlertDescription>
                {treeQuery.error instanceof Error
                  ? treeQuery.error.message
                  : t('An unexpected error occurred')}
              </AlertDescription>
            </Alert>
          )}

          {treeQuery.isLoading && <DepartmentOverviewSkeleton />}

          {treeData && displayTreeData.length === 0 && (
            <div className='flex flex-col items-center justify-center py-16'>
              <Building2 className='text-muted-foreground mb-4 size-12' />
              <p className='text-muted-foreground text-sm'>
                {t('No departments available')}
              </p>
            </div>
          )}

          {treeData &&
            displayTreeData.length > 0 &&
            selectedNode &&
            !queryParams && <DepartmentSearchPrompt />}

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

          {loadingState.showStatsSkeleton && <StatsCardsSkeleton />}

          {statsQuery.data?.data && (
            <DepartmentStatsCards stat={statsQuery.data.data} />
          )}

          {subStatsQuery.isError && (
            <Alert variant='destructive' className='mt-4'>
              <AlertCircle className='size-4' />
              <AlertTitle>{t('Failed to load statistics')}</AlertTitle>
              <AlertDescription>
                {subStatsQuery.error instanceof Error
                  ? subStatsQuery.error.message
                  : t('An unexpected error occurred')}
              </AlertDescription>
            </Alert>
          )}

          {loadingState.showSubStatsSkeleton && <SubDepartmentStatsSkeleton />}

          {subStatsQuery.data?.data &&
            subStatsQuery.data.data.length > 0 &&
            queryParams && (
              <SubDepartmentStats
                data={subStatsQuery.data.data}
                companyId={queryParams.company_id}
                activityFormula={statsQuery.data?.data.active_user_formula}
                startTimestamp={queryParams.start_timestamp}
                endTimestamp={queryParams.end_timestamp}
              />
            )}

          {usersQuery.isError && (
            <Alert variant='destructive' className='mt-4'>
              <AlertCircle className='size-4' />
              <AlertTitle>{t('Failed to load statistics')}</AlertTitle>
              <AlertDescription>
                {usersQuery.error instanceof Error
                  ? usersQuery.error.message
                  : t('An unexpected error occurred')}
              </AlertDescription>
            </Alert>
          )}

          {rankingsQuery.isError && (
            <Alert variant='destructive' className='mt-4'>
              <AlertCircle className='size-4' />
              <AlertTitle>{t('Failed to load statistics')}</AlertTitle>
              <AlertDescription>
                {rankingsQuery.error instanceof Error
                  ? rankingsQuery.error.message
                  : t('An unexpected error occurred')}
              </AlertDescription>
            </Alert>
          )}

          {queryParams && (
            <DepartmentUsersTable
              companyId={queryParams.company_id}
              departmentId={queryParams.department_id}
              startTimestamp={queryParams.start_timestamp}
              endTimestamp={queryParams.end_timestamp}
              initialUsers={usersQuery.data?.data}
              initialRankings={rankingsQuery.data?.data}
              initialUsersLoading={loadingState.showUsersSkeleton}
              initialRankingsLoading={loadingState.showRankingsSkeleton}
            />
          )}

          {usageQuery.isError && (
            <Alert variant='destructive' className='mt-4'>
              <AlertCircle className='size-4' />
              <AlertTitle>{t('Failed to load statistics')}</AlertTitle>
              <AlertDescription>
                {usageQuery.error instanceof Error
                  ? usageQuery.error.message
                  : t('An unexpected error occurred')}
              </AlertDescription>
            </Alert>
          )}

          {loadingState.showUsageSkeleton && <UsageAnalysisSkeleton />}

          {usageQuery.data?.data && (
            <UsageAnalysisSection data={usageQuery.data.data} />
          )}
        </FadeIn>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
