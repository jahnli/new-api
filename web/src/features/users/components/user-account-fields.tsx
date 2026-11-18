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
import { Pencil } from 'lucide-react'
import { useFormContext, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { SideDrawerSection } from '@/components/drawer-layout'
import { PasswordInput } from '@/components/password-input'
import { PasswordStrength } from '@/components/password-strength'
import { PermissionMatrix } from '@/components/permission-matrix'
import { Button } from '@/components/ui/button'
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  ADMIN_PERMISSION_ACTIONS,
  ADMIN_PERMISSION_RESOURCES,
  hasPermission,
  normalizeAdminPermissions,
  type PermissionCatalog,
} from '@/lib/admin-permissions'
import { getCurrencyDisplay, getCurrencyLabel } from '@/lib/currency'
import { formatQuota, parseQuotaFromDollars } from '@/lib/format'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

import { BINDING_FIELDS } from '../constants'
import type { UserFormValues } from '../lib'
import type { User } from '../types'
import { UserGroupField } from './user-group-field'

interface UserAccountFieldsProps {
  currentRow?: User
  permissionCatalog: PermissionCatalog
  onAdjustQuota: () => void
}

export function UserAccountFields(props: UserAccountFieldsProps) {
  const { t } = useTranslation()
  const { control } = useFormContext<UserFormValues>()
  const selectedRole = useWatch({ control, name: 'role' })
  const currentUser = useAuthStore((s) => s.auth.user)
  const isUpdate = !!props.currentRow
  const canEditAdminPermissions = currentUser?.role === ROLE.SUPER_ADMIN
  const targetIsAdmin =
    (selectedRole ?? props.currentRow?.role ?? 0) >= ROLE.ADMIN
  const { meta: currencyMeta } = getCurrencyDisplay()
  const currencyLabel = getCurrencyLabel()
  const tokensOnly = currencyMeta.kind === 'tokens'

  return (
    <div className='flex min-w-0 flex-col gap-6'>
      <SideDrawerSection>
        <h3 className='text-sm font-medium'>{t('Basic Information')}</h3>

        <FormField
          control={control}
          name='username'
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('Username')}</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  placeholder={t('Enter username')}
                  disabled={isUpdate}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name='display_name'
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('Display Name')}</FormLabel>
              <FormControl>
                <Input {...field} placeholder={t('Enter display name')} />
              </FormControl>
              <FormDescription>
                {t('Leave empty to use username')}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name='password'
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('Password')}</FormLabel>
              <FormControl
                describedBy={
                  !isUpdate || field.value
                    ? 'user-password-strength'
                    : undefined
                }
              >
                <PasswordInput
                  {...field}
                  value={field.value ?? ''}
                  autoComplete='new-password'
                  placeholder={
                    isUpdate
                      ? t('Leave empty to keep unchanged')
                      : t('Enter password (8–128 characters)')
                  }
                />
              </FormControl>
              <PasswordStrength
                id='user-password-strength'
                value={field.value ?? ''}
                quietWhenEmpty={isUpdate}
              />
              <FormMessage />
            </FormItem>
          )}
        />
      </SideDrawerSection>
      {/* Group & Quota Settings (Update only) */}
      {isUpdate && (
        <SideDrawerSection>
          <h3 className='text-sm font-medium'>{t('Group & Quota')}</h3>

          <UserGroupField />

          <FormField
            control={control}
            name='quota_dollars'
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {t('Remaining Quota ({{currency}})', {
                    currency: currencyLabel,
                  })}
                </FormLabel>
                <div className='flex gap-2'>
                  <FormControl>
                    <Input
                      value={
                        tokensOnly
                          ? String(field.value || 0)
                          : (field.value || 0).toFixed(6)
                      }
                      readOnly
                      className='flex-1'
                    />
                  </FormControl>
                  <Button
                    type='button'
                    variant='outline'
                    onClick={props.onAdjustQuota}
                  >
                    <Pencil className='mr-1 h-4 w-4' />
                    {t('Adjust Quota')}
                  </Button>
                </div>
                <FormDescription>
                  {formatQuota(parseQuotaFromDollars(field.value || 0))}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name='remark'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Remark')}</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    placeholder={t('Admin notes (only visible to admins)')}
                    rows={3}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </SideDrawerSection>
      )}

      {canEditAdminPermissions &&
        targetIsAdmin &&
        props.permissionCatalog.resources.length > 0 && (
          <SideDrawerSection>
            <h3 className='text-sm font-medium'>{t('Admin Permissions')}</h3>
            <p className='text-muted-foreground text-xs'>
              {t(
                'Default administrator permissions can be overridden for this user.'
              )}
            </p>
            <FormField
              control={control}
              name='admin_permissions'
              render={({ field }) => {
                const selected = normalizeAdminPermissions(
                  field.value,
                  props.permissionCatalog
                )
                return (
                  <FormItem className='min-w-0'>
                    <PermissionMatrix
                      resources={props.permissionCatalog.resources}
                      value={selected}
                      onChange={field.onChange}
                    />
                    <FormMessage />
                  </FormItem>
                )
              }}
            />
            {currentUser && (
              <p className='text-muted-foreground text-xs'>
                {hasPermission(
                  currentUser,
                  ADMIN_PERMISSION_RESOURCES.CHANNEL,
                  ADMIN_PERMISSION_ACTIONS.SENSITIVE_WRITE
                )
                  ? t('Your account can edit sensitive channel settings.')
                  : t('Your account cannot edit sensitive channel settings.')}
              </p>
            )}
          </SideDrawerSection>
        )}

      {/* Binding Information (Read-only) */}
      {isUpdate && (
        <SideDrawerSection>
          <h3 className='text-sm font-medium'>{t('Binding Information')}</h3>
          <p className='text-muted-foreground text-xs'>
            {t(
              'Third-party account bindings (read-only, managed by user in Security & Access)'
            )}
          </p>

          <div className='flex flex-col gap-3'>
            {BINDING_FIELDS.map(({ key, label }) => (
              <div key={key}>
                <Label className='text-muted-foreground text-xs'>
                  {t(label)}
                </Label>
                <Input
                  value={
                    (props.currentRow?.[key as keyof User] as string) || '-'
                  }
                  disabled
                  className='mt-1'
                />
              </div>
            ))}
          </div>
        </SideDrawerSection>
      )}
    </div>
  )
}
