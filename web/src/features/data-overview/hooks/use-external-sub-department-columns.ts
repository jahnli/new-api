import type { ColumnDef } from '@tanstack/react-table'
import { useMemo } from 'react'

import {
  useSharedSubDepartmentColumns,
  type SubDepartmentColumnsOptions,
} from '../components/shared-sub-department-columns'
import type { SubDepartmentStat } from '../types'

export function useExternalSubDepartmentColumns(
  options: SubDepartmentColumnsOptions
): ColumnDef<SubDepartmentStat>[] {
  const columns = useSharedSubDepartmentColumns(options)

  return useMemo(
    () => [
      columns.department,
      columns.users,
      columns.tokens,
      columns.cost,
      columns.unitPrice,
      columns.requests,
      columns.activeUsers,
      columns.tokensPerActiveUser,
      columns.actions,
    ],
    [columns]
  )
}
