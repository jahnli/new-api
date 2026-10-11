import type { Table } from '@tanstack/react-table'
import { useTranslation } from 'react-i18next'

import { DataTableBulkActions as BulkActionsToolbar } from '@/components/data-table'

import type { User } from '../types'

interface DataTableBulkActionsProps {
  table: Table<User>
}

export function DataTableBulkActions({ table }: DataTableBulkActionsProps) {
  const { t } = useTranslation()

  return (
    <BulkActionsToolbar table={table} entityName={t('User')}>
      {null}
    </BulkActionsToolbar>
  )
}
