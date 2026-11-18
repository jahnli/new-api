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
import { useQuery } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { useFormContext, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { MultiSelect } from '@/components/multi-select'
import { Button } from '@/components/ui/button'
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DepartmentTreeSelect } from '@/features/data-overview/components/department-tree-select'
import { ROLE, getRoleLabelKey } from '@/lib/roles'

import { getAdminFullDepartmentTree, getSalesUsers } from '../api'
import {
  USER_CUSTOMER_TYPE,
  getUserCustomerTypeOptions,
  getUserSettlementModeOptions,
} from '../constants'
import {
  getCostCenterDepartmentPath,
  type CostCenterSelection,
  type UserFormValues,
} from '../lib'
import { DeptMultiSelect } from './dept-multi-select'

interface UserExtensionFieldsProps {
  open: boolean
  externalMode: boolean
  isUpdate: boolean
}

export function UserExtensionFields(props: UserExtensionFieldsProps) {
  const { t } = useTranslation()
  const { control } = useFormContext<UserFormValues>()
  const bpRoleLabel = t(getRoleLabelKey(ROLE.BU_BP, props.externalMode))
  const targetIsBP = useWatch({ control, name: 'role' }) === ROLE.BU_BP
  const selectedCustomerType = useWatch({ control, name: 'customer_type' })
  const salesQuery = useQuery({
    queryKey: ['user-sales-options'],
    queryFn: getSalesUsers,
    enabled: props.open && props.isUpdate && props.externalMode,
  })
  const selectedSalesIDs = useWatch({ control, name: 'sales_user_ids' }) ?? []
  const salesOptions = (salesQuery.data ?? []).map((sales) => ({
    value: String(sales.id),
    label: sales.display_name
      ? `${sales.display_name} (${sales.username})`
      : sales.username,
  }))
  const availableSalesIDs = new Set(salesOptions.map((option) => option.value))
  for (const id of selectedSalesIDs) {
    if (!availableSalesIDs.has(String(id))) {
      salesOptions.push({
        value: String(id),
        label: `${t('Sales contact unavailable')} (#${id})`,
      })
    }
  }

  const { data: fullDeptTreeResponse, isLoading: fullDeptTreeLoading } =
    useQuery({
      queryKey: ['admin-full-department-tree'],
      queryFn: getAdminFullDepartmentTree,
      enabled: props.open,
      staleTime: 5 * 60 * 1000,
    })

  const fullDeptTreeData = fullDeptTreeResponse?.data?.tree_data ?? []

  return (
    <section className='border-border/60 flex min-w-0 flex-col gap-4 border-t pt-6 md:border-s md:border-t-0 md:ps-6 md:pt-0'>
      <h3 className='text-sm font-medium'>{t('Additional Information')}</h3>
      <FormField
        control={control}
        name='role'
        render={({ field }) => (
          <FormItem className='min-w-0'>
            <FormLabel>{t('Role')}</FormLabel>
            <Select
              items={[
                { value: '1', label: t('Common User') },
                { value: '2', label: bpRoleLabel },
                { value: '10', label: t('Admin') },
              ]}
              onValueChange={(value) =>
                value !== null && field.onChange(Number.parseInt(value))
              }
              value={String(field.value)}
            >
              <FormControl>
                <SelectTrigger className='w-full max-w-full min-w-0'>
                  <SelectValue
                    className='min-w-0 overflow-hidden text-ellipsis'
                    placeholder={t('Select a role')}
                  />
                </SelectTrigger>
              </FormControl>
              <SelectContent alignItemWithTrigger={false}>
                <SelectGroup>
                  <SelectItem value='1'>{t('Common User')}</SelectItem>
                  <SelectItem value='2'>{bpRoleLabel}</SelectItem>
                  <SelectItem value='10'>{t('Admin')}</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name='cost_center'
        render={({ field }) => (
          <FormItem className='min-w-0'>
            <FormLabel>{t('Cost Center')}</FormLabel>
            <div className='flex items-center gap-2'>
              <FormControl>
                <DepartmentTreeSelect
                  treeData={fullDeptTreeData}
                  value={field.value?.value}
                  onValueChange={(_, node) => {
                    if (
                      node.node_type !== 'department' ||
                      !node.department_id ||
                      !node.company_id
                    ) {
                      return
                    }
                    const departmentPath =
                      getCostCenterDepartmentPath(
                        fullDeptTreeData,
                        node.value
                      ) || node.label
                    const selection: CostCenterSelection = {
                      value: node.value,
                      label: departmentPath,
                      department_id: node.department_id,
                      company_id: node.company_id,
                    }
                    field.onChange(selection)
                  }}
                  placeholder={t('Select a cost center')}
                  disabled={fullDeptTreeLoading}
                />
              </FormControl>
              {field.value && (
                <Button
                  type='button'
                  variant='ghost'
                  size='icon'
                  aria-label={t('Clear cost center')}
                  onClick={() => field.onChange(null)}
                >
                  <X aria-hidden='true' className='size-4' />
                </Button>
              )}
            </div>
            <FormMessage />
          </FormItem>
        )}
      />

      {targetIsBP && (
        <FormField
          control={control}
          name='overview_dept_ids'
          render={({ field }) => (
            <FormItem className='min-w-0'>
              <FormLabel>{t('Overview Visible Departments')}</FormLabel>
              <FormControl>
                <DeptMultiSelect
                  treeData={fullDeptTreeData}
                  value={field.value ?? []}
                  onValueChange={field.onChange}
                  placeholder={t('Select visible departments')}
                  isLoading={fullDeptTreeLoading}
                  disabled={fullDeptTreeLoading}
                />
              </FormControl>
              <FormDescription>
                {t(
                  'Select which departments this {{role}} user can access in Data Overview. Selecting a department grants access to all its sub-departments.',
                  { role: bpRoleLabel }
                )}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      )}
      {props.externalMode && (
        <>
          <FormField
            control={control}
            name='customer_type'
            render={({ field }) => (
              <FormItem className='min-w-0'>
                <FormLabel>{t('Customer Type')}</FormLabel>
                <Select
                  items={getUserCustomerTypeOptions(t)}
                  onValueChange={(value) =>
                    value !== null && field.onChange(value)
                  }
                  value={field.value}
                >
                  <FormControl>
                    <SelectTrigger className='w-full max-w-full min-w-0'>
                      <SelectValue
                        className='min-w-0 overflow-hidden text-ellipsis'
                        placeholder={t('Select a customer type')}
                      />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent alignItemWithTrigger={false}>
                    <SelectGroup>
                      {getUserCustomerTypeOptions(t).map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {selectedCustomerType === USER_CUSTOMER_TYPE.PAID && (
            <FormField
              control={control}
              name='settlement_mode'
              render={({ field }) => (
                <FormItem className='min-w-0'>
                  <FormLabel>{t('Settlement Mode')}</FormLabel>
                  <Select
                    items={getUserSettlementModeOptions(t)}
                    onValueChange={(value) =>
                      value !== null && field.onChange(value)
                    }
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className='w-full max-w-full min-w-0'>
                        <SelectValue
                          className='min-w-0 overflow-hidden text-ellipsis'
                          placeholder={t('Select a settlement mode')}
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent alignItemWithTrigger={false}>
                      <SelectGroup>
                        {getUserSettlementModeOptions(t).map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {props.isUpdate && (
            <FormField
              control={control}
              name='sales_user_ids'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Assign sales contacts')}</FormLabel>
                  <FormControl>
                    <MultiSelect
                      options={salesOptions}
                      selected={(field.value ?? []).map(String)}
                      onChange={(values) => field.onChange(values.map(Number))}
                      disabled={
                        salesQuery.isPending ||
                        salesQuery.isError ||
                        field.value === undefined
                      }
                      placeholder={t('Select sales contacts')}
                      className='w-full'
                    />
                  </FormControl>
                  {salesQuery.isError && (
                    <Button
                      type='button'
                      variant='outline'
                      onClick={() => void salesQuery.refetch()}
                    >
                      {t('Retry')}
                    </Button>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </>
      )}
    </section>
  )
}
