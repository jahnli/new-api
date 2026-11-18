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
import { useFormContext } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { Combobox } from '@/components/ui/combobox'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'

import { getGroupsWithRatios } from '../api'
import type { UserFormValues } from '../lib'

export function UserGroupField() {
  const { t } = useTranslation()
  const { control } = useFormContext<UserFormValues>()
  const { data: groupsData } = useQuery({
    queryKey: ['groups-with-ratios'],
    queryFn: getGroupsWithRatios,
    staleTime: 5 * 60 * 1000,
  })

  const groups = groupsData?.data || {}
  return (
    <FormField
      control={control}
      name='group'
      render={({ field }) => (
        <FormItem>
          <FormLabel>{t('Group')}</FormLabel>
          <FormControl>
            <Combobox
              options={Object.entries(groups).map(([group, ratio]) => ({
                value: group,
                label: group,
                suffix: `${ratio}x ${t('Ratio')}`,
              }))}
              onValueChange={field.onChange}
              value={field.value}
              className='w-full'
              placeholder={t('Select a group')}
              showSelectedContent
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
