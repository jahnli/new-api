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
import type { Column } from '@tanstack/react-table'
import { Funnel } from 'lucide-react'
import type { ComponentType, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

/** Radio value backing the "All" entry, which clears the column filter. */
const COLUMN_FILTER_ALL = '__all__'

export type DataTableColumnHeaderFilterOption = {
  /** Already-translated display text. */
  label: string
  value: string
  icon?: ComponentType<{ className?: string }>
  iconNode?: ReactNode
}

type DataTableColumnHeaderFilterProps<TData, TValue> = {
  column: Column<TData, TValue>
  /** Already-translated column label; also the trigger's accessible name. */
  label: string
  options: DataTableColumnHeaderFilterOption[]
}

/**
 * Column header label paired with a compact funnel menu for exclusive
 * filtering. Options render as a radio group, so exactly one value — or none —
 * is active at a time; selections are stored as a one-element array to match
 * the `string[]` filter convention used by {@link DataTableFacetedFilter}.
 *
 * Use this for enum columns inside a table that has no toolbar (or alongside
 * one); for the toolbar filter chips keep using `DataTableFacetedFilter`.
 */
export function DataTableColumnHeaderFilter<TData, TValue>(
  props: DataTableColumnHeaderFilterProps<TData, TValue>
) {
  const { t } = useTranslation()
  const filterValue = props.column.getFilterValue()
  const selectedValue = Array.isArray(filterValue)
    ? String(filterValue[0] ?? '')
    : ''

  const selectValue = (value: string) => {
    props.column.setFilterValue(
      value === COLUMN_FILTER_ALL ? undefined : [value]
    )
  }

  return (
    <div className='flex items-center gap-1.5'>
      <span>{props.label}</span>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type='button'
              variant='ghost'
              size='icon-xs'
              className={
                selectedValue
                  ? 'text-primary hover:text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }
              aria-label={props.label}
            />
          }
        >
          <Funnel className='size-3.5' />
        </DropdownMenuTrigger>
        <DropdownMenuContent align='start' className='w-36'>
          <DropdownMenuRadioGroup
            value={selectedValue || COLUMN_FILTER_ALL}
            onValueChange={selectValue}
          >
            <DropdownMenuRadioItem value={COLUMN_FILTER_ALL}>
              {t('All')}
            </DropdownMenuRadioItem>
            {props.options.map((option) => (
              <DropdownMenuRadioItem key={option.value} value={option.value}>
                {renderOptionIcon(option)}
                {option.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

function renderOptionIcon(option: DataTableColumnHeaderFilterOption) {
  if (option.iconNode) {
    return option.iconNode
  }
  if (!option.icon) {
    return null
  }
  const OptionIcon = option.icon
  return <OptionIcon className='size-3.5' />
}
