import { Download, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

import {
  getDepartmentStats,
  getDepartmentUsers,
  getDepartmentUserRankings,
  getSubDepartmentStats,
  getUsageAnalysis,
} from '../api'
import {
  exportDataOverview,
  findNodeByValue,
  type SubDepartmentDetail,
} from '../lib/export-excel'
import type {
  DepartmentStat,
  DepartmentUser,
  DepartmentQueryParams,
  DeptTreeNode,
  SubDepartmentStat,
  UserRankingItem,
} from '../types'

interface ExportDialogProps {
  queryParams: DepartmentQueryParams | null
  treeData: DeptTreeNode[]
  stats: DepartmentStat | undefined
  subStats: SubDepartmentStat[]
}

async function fetchAllUsers(
  companyId: number,
  departmentId: string,
  startTimestamp: number,
  endTimestamp: number
): Promise<DepartmentUser[]> {
  const all: DepartmentUser[] = []
  let page = 1
  const pageSize = 200

  for (;;) {
    const res = await getDepartmentUsers({
      company_id: companyId,
      department_id: departmentId,
      start_timestamp: startTimestamp,
      end_timestamp: endTimestamp,
      page,
      page_size: pageSize,
      include_unregistered: true,
    })
    all.push(...res.data.items)
    if (all.length >= res.data.total || res.data.items.length === 0) break
    page++
  }

  return all
}

export function ExportDialog(props: ExportDialogProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [includeSubDepts, setIncludeSubDepts] = useState(false)
  const [includeUserList, setIncludeUserList] = useState(false)
  const [exporting, setExporting] = useState(false)

  const hasSubDepts = props.subStats.length > 0

  const handleExport = async () => {
    if (!props.queryParams || !props.stats) {
      toast.error(t('No data available for export'))
      return
    }

    setExporting(true)
    try {
      const { company_id, department_id, start_timestamp, end_timestamp } =
        props.queryParams

      const node = findNodeByValue(props.treeData, department_id)
      const departmentName =
        node?.node_type === 'overview'
          ? t('Overall')
          : (node?.label ?? department_id)

      const subDepartmentDetails: SubDepartmentDetail[] = []
      if (includeSubDepts && props.subStats.length > 0) {
        for (const sub of props.subStats) {
          const subCompanyId = sub.company_id ?? company_id
          const [statsRes, subStatsRes, usageRes] = await Promise.all([
            getDepartmentStats({
              company_id: subCompanyId,
              department_id: sub.department_id,
              start_timestamp,
              end_timestamp,
            }),
            getSubDepartmentStats({
              company_id: subCompanyId,
              department_id: sub.department_id,
              start_timestamp,
              end_timestamp,
            }),
            getUsageAnalysis({
              company_id: subCompanyId,
              department_id: sub.department_id,
              start_timestamp,
              end_timestamp,
            }),
          ])
          if (!statsRes.data) {
            throw new Error('Failed to fetch department stats')
          }
          subDepartmentDetails.push({
            departmentId: sub.department_id,
            departmentName: sub.department_name,
            stats: statsRes.data,
            subStats: subStatsRes.data ?? [],
            usage: usageRes.data ?? {
              model_stats: [],
              daily_stats: [],
              model_daily_stats: [],
              quota_to_cny: 0,
            },
          })
        }
      }

      let users: DepartmentUser[] = []
      let userRankings: UserRankingItem[] = []
      const rankingsRes = await getDepartmentUserRankings({
        company_id,
        department_id,
        start_timestamp,
        end_timestamp,
      })
      userRankings = rankingsRes.data

      if (includeUserList) {
        users = await fetchAllUsers(
          company_id,
          department_id,
          start_timestamp,
          end_timestamp
        )
      }

      const usageRes = await getUsageAnalysis({
        company_id,
        department_id,
        start_timestamp,
        end_timestamp,
      })

      await exportDataOverview({
        departmentName,
        startTimestamp: start_timestamp,
        endTimestamp: end_timestamp,
        stats: props.stats,
        subStats: props.subStats,
        usage: usageRes.data,
        userRankings,
        includeSubDepartments: includeSubDepts,
        subDepartmentDetails,
        includeUserList,
        users,
      })

      toast.success(t('Export successful'))
      setOpen(false)
    } catch (error) {
      console.error('Export failed:', error)
      toast.error(t('Export failed'))
    } finally {
      setExporting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button className='gap-1.5'>
            <Download className='size-3.5' />
            {t('Export')}
          </Button>
        }
      />
      <DialogContent className='sm:max-w-lg md:max-w-xl'>
        <DialogHeader>
          <DialogTitle>{t('Export Data')}</DialogTitle>
          <DialogDescription>
            {t('Export current filtered data to Excel file')}
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-3 py-2'>
          {hasSubDepts && (
            <label className='hover:bg-accent/50 flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors'>
              <Checkbox
                checked={includeSubDepts}
                onCheckedChange={(checked) =>
                  setIncludeSubDepts(checked === true)
                }
                className='mt-0.5'
              />
              <div className='space-y-1'>
                <div className='text-sm font-medium'>
                  {t('Include sub-department detail sheets')}
                </div>
                <div className='text-muted-foreground text-xs leading-relaxed'>
                  {t(
                    'When checked, a separate Sheet will be generated for each sub-department, containing detailed statistics and charts'
                  )}
                </div>
              </div>
            </label>
          )}

          <label className='hover:bg-accent/50 flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors'>
            <Checkbox
              checked={includeUserList}
              onCheckedChange={(checked) =>
                setIncludeUserList(checked === true)
              }
              className='mt-0.5'
            />
            <div className='space-y-1'>
              <div className='text-sm font-medium'>
                {t('Include user list sheet')}
              </div>
              <div className='text-muted-foreground text-xs leading-relaxed'>
                {t(
                  'When checked, a user list Sheet will be generated, containing user data, Consumption Ranking Top 10, and Consumption Share Top 10'
                )}
              </div>
            </div>
          </label>
        </div>

        <DialogFooter>
          <Button
            onClick={handleExport}
            disabled={exporting || !props.queryParams || !props.stats}
            className='gap-1.5'
          >
            {exporting ? (
              <Loader2 className='size-3.5 animate-spin' />
            ) : (
              <Download className='size-3.5' />
            )}
            {exporting ? t('Exporting...') : t('Export')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
