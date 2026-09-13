/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import type { Column, Table as TanstackTable } from '@tanstack/react-table'
import {
  ArrowDown as ArrowDownIcon,
  ArrowUp as ArrowUpIcon,
  ChevronsUpDown as CaretSortIcon,
  EyeOff as EyeNoneIcon,
  Info,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

import type { DataTableSortField } from './types'

type DataTableColumnHeaderProps<TData, TValue> = Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'title'
> & {
  column: Column<TData, TValue>
  title: React.ReactNode
  descriptionPosition?: 'after-header' | 'after-title'
  /**
   * Table instance used to read and update sorting for `meta.sortFields`.
   * Optional so existing call sites keep working unchanged.
   */
  table?: TanstackTable<TData>
}

type SortDirection = false | 'asc' | 'desc'

function resolveSortDirection<TData, TValue>(
  column: Column<TData, TValue>,
  table: TanstackTable<TData> | undefined,
  sortFieldId: string | undefined
): SortDirection {
  // Merged columns summarize several metrics, so the active sort target lives in
  // the table sorting state instead of on this column itself.
  if (!table || !sortFieldId) {
    return column.getIsSorted()
  }
  const entry = table
    .getState()
    .sorting.find((sortState) => sortState.id === sortFieldId)
  if (!entry) {
    return false
  }
  return entry.desc ? 'desc' : 'asc'
}

function SortDirectionIcon({ direction }: { direction: SortDirection }) {
  if (direction === 'desc') {
    return <ArrowDownIcon className='ms-2 h-4 w-4' />
  }
  if (direction === 'asc') {
    return <ArrowUpIcon className='ms-2 h-4 w-4' />
  }
  return <CaretSortIcon className='ms-2 h-4 w-4' />
}

export function DataTableColumnHeader<TData, TValue>({
  column,
  title,
  descriptionPosition = 'after-header',
  className,
  table,
}: DataTableColumnHeaderProps<TData, TValue>) {
  const { t } = useTranslation()
  const description = column.columnDef.meta?.description
  const sortFields: DataTableSortField[] =
    column.columnDef.meta?.sortFields ?? []
  // Without the table instance we cannot read or update sorting, so the field
  // selector is only offered when the caller provides one.
  const sortableTable = sortFields.length > 0 ? table : undefined
  const activeSortField = sortableTable
    ? (sortFields.find((field) =>
        sortableTable.getState().sorting.some((entry) => entry.id === field.id)
      ) ?? sortFields[0])
    : undefined
  const titleContent = (
    <span className={column.columnDef.meta?.headerClassName}>{title}</span>
  )

  if (!column.getCanSort() && !activeSortField) {
    return (
      <div className={cn('flex items-center gap-1.5', className)}>
        {titleContent}
        {description && <DescriptionTooltip description={description} />}
      </div>
    )
  }

  const selectSortField = (fieldId: string) => {
    if (!sortableTable) {
      return
    }
    const existing = sortableTable
      .getState()
      .sorting.find((entry) => entry.id === fieldId)
    // Consumption-style metrics read better largest-first on first selection.
    const desc = existing ? existing.desc : true
    sortableTable.setSorting([{ id: fieldId, desc }])
  }

  const applySortDirection = (desc: boolean) => {
    if (sortableTable && activeSortField) {
      sortableTable.setSorting([{ id: activeSortField.id, desc }])
      return
    }
    column.toggleSorting(desc)
  }

  return (
    <div className={cn('flex items-center space-x-2', className)}>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant='ghost'
              size='sm'
              className='data-popup-open:bg-accent -ms-3 h-8'
            />
          }
        >
          {titleContent}
          {description && descriptionPosition === 'after-title' ? (
            <DescriptionTooltip description={description} />
          ) : null}
          <SortDirectionIcon
            direction={resolveSortDirection(
              column,
              sortableTable,
              activeSortField?.id
            )}
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent align='start'>
          {activeSortField ? (
            <>
              <DropdownMenuLabel>{t('Sort by')}</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={activeSortField.id}
                onValueChange={selectSortField}
              >
                {sortFields.map((field) => (
                  <DropdownMenuRadioItem key={field.id} value={field.id}>
                    {field.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
            </>
          ) : null}
          <DropdownMenuItem onClick={() => applySortDirection(false)}>
            <ArrowUpIcon className='text-muted-foreground/70 size-3.5' />
            {t('Asc')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => applySortDirection(true)}>
            <ArrowDownIcon className='text-muted-foreground/70 size-3.5' />
            {t('Desc')}
          </DropdownMenuItem>
          {column.getCanHide() && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => column.toggleVisibility(false)}>
                <EyeNoneIcon className='text-muted-foreground/70 size-3.5' />
                {t('Hide')}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {description && descriptionPosition === 'after-header' ? (
        <DescriptionTooltip description={description} />
      ) : null}
    </div>
  )
}

function DescriptionTooltip({ description }: { description: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Info
            className='text-muted-foreground size-3.5 shrink-0 cursor-help'
            aria-label={description}
          />
        }
      />
      <TooltipContent className='max-w-64'>
        <p className='text-xs leading-relaxed whitespace-pre-line'>
          {description}
        </p>
      </TooltipContent>
    </Tooltip>
  )
}
