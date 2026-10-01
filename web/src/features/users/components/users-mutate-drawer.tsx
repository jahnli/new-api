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
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { Pencil, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  SideDrawerSection,
  sideDrawerFooterClassName,
  sideDrawerFormClassName,
  sideDrawerHeaderClassName,
} from '@/components/drawer-layout'
import { PermissionMatrix } from '@/components/permission-matrix'
import { Button } from '@/components/ui/button'
import { Combobox } from '@/components/ui/combobox'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { DepartmentTreeSelect } from '@/features/data-overview/components/department-tree-select'
import { useExternalMode } from '@/hooks/use-external-mode'
import {
  ADMIN_PERMISSION_ACTIONS,
  ADMIN_PERMISSION_RESOURCES,
  EMPTY_PERMISSION_CATALOG,
  hasPermission,
  normalizeAdminPermissions,
  type AdminPermissionMatrix,
} from '@/lib/admin-permissions'
import { getCurrencyDisplay, getCurrencyLabel } from '@/lib/currency'
import { formatQuota, parseQuotaFromDollars } from '@/lib/format'
import { handleServerError } from '@/lib/handle-server-error'
import { accountPasswordSchema } from '@/lib/password-policy'
import { ROLE } from '@/lib/roles'
import { AuthOperationError } from '@/lib/secure-verification'
import { requireServerSuccess } from '@/lib/server-error-message'
import { useAuthStore } from '@/stores/auth-store'

import {
  createUser,
  updateUser,
  getUser,
  getGroupsWithRatios,
  getPermissionCatalog,
  getAdminFullDepartmentTree,
  getSalesUsers,
} from '../api'
import { BINDING_FIELDS, ERROR_MESSAGES, SUCCESS_MESSAGES } from '../constants'
import {
  userFormSchema,
  type UserFormValues,
  type CostCenterSelection,
  getCostCenterDepartmentPath,
  USER_FORM_DEFAULT_VALUES,
  transformFormDataToPayload,
  transformUserToFormDefaults,
} from '../lib'
import type { User } from '../types'
import { DeptMultiSelect } from './dept-multi-select'
import { UserQuotaDialog } from './user-quota-dialog'
import { useUsers } from './users-provider'

type UsersMutateDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentRow?: User
}

export function UsersMutateDrawer({
  open,
  onOpenChange,
  currentRow,
}: UsersMutateDrawerProps) {
  const { t } = useTranslation()
  const isUpdate = !!currentRow
  const externalMode = useExternalMode()
  const { triggerRefresh, requestVerification } = useUsers()
  const currentUser = useAuthStore((s) => s.auth.user)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [quotaDialogOpen, setQuotaDialogOpen] = useState(false)
  // Matrix as loaded from the server; an unchanged matrix is not resubmitted so
  // routine edits of an administrator do not require step-up verification.
  const loadedPermissions = useRef<AdminPermissionMatrix | undefined>(undefined)

  // Fetch groups
  const { data: groupsData } = useQuery({
    queryKey: ['groups-with-ratios'],
    queryFn: getGroupsWithRatios,
    staleTime: 5 * 60 * 1000,
  })

  const groups = groupsData?.data || {}

  // Permission catalog is owned by the backend; fetched once and reused.
  const { data: permissionCatalog = EMPTY_PERMISSION_CATALOG } = useQuery({
    queryKey: ['admin-permission-catalog'],
    queryFn: async () => requireServerSuccess(await getPermissionCatalog()),
    staleTime: 5 * 60 * 1000,
  })

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: USER_FORM_DEFAULT_VALUES,
  })

  const salesQuery = useQuery({
    queryKey: ['user-sales-options'],
    queryFn: getSalesUsers,
    enabled: open && isUpdate && externalMode,
  })
  const selectedSalesID = form.watch('sales_user_id')
  const salesOptions: { value: string; label: string; disabled?: boolean }[] = [
    { value: '0', label: t('Unassigned') },
    ...(salesQuery.data ?? []).map((sales) => ({
      value: String(sales.id),
      label: sales.display_name
        ? `${sales.display_name} (${sales.username})`
        : sales.username,
    })),
  ]
  if (
    selectedSalesID &&
    !salesOptions.some((option) => option.value === String(selectedSalesID))
  ) {
    salesOptions.push({
      value: String(selectedSalesID),
      label: `${t('Sales contact unavailable')} (#${selectedSalesID})`,
      disabled: true,
    })
  }

  // Load existing data when updating
  useEffect(() => {
    if (open && isUpdate && currentRow) {
      // For update, fetch fresh data
      getUser(currentRow.id)
        .then((result) => {
          if (result.success && result.data) {
            loadedPermissions.current = result.data.admin_permissions
            form.reset(transformUserToFormDefaults(result.data))
          } else {
            handleServerError(result, t('Failed to load'))
          }
        })
        .catch((error) => handleServerError(error, t('Failed to load')))
    } else if (open && !isUpdate) {
      // For create, reset to defaults
      form.reset(USER_FORM_DEFAULT_VALUES)
    }
  }, [open, isUpdate, currentRow, form, t])

  const { meta: currencyMeta } = getCurrencyDisplay()
  const currencyLabel = getCurrencyLabel()
  const tokensOnly = currencyMeta.kind === 'tokens'

  const currentQuotaRaw = form.watch('quota_dollars') || 0
  const selectedRole = form.watch('role')
  const canEditAdminPermissions = currentUser?.role === ROLE.SUPER_ADMIN
  const targetIsAdmin = (selectedRole ?? currentRow?.role ?? 0) >= ROLE.ADMIN
  const targetRole = selectedRole ?? currentRow?.role ?? 0
  const targetIsBP = targetRole === ROLE.BU_BP

  const { data: fullDeptTreeResponse, isLoading: fullDeptTreeLoading } =
    useQuery({
      queryKey: ['admin-full-department-tree'],
      queryFn: getAdminFullDepartmentTree,
      enabled: open,
      staleTime: 5 * 60 * 1000,
    })

  const fullDeptTreeData = fullDeptTreeResponse?.data?.tree_data ?? []

  const onSubmit = async (data: UserFormValues) => {
    if (!isUpdate || data.password) {
      if (!accountPasswordSchema.safeParse(data.password ?? '').success) {
        form.setError('password', {
          type: 'manual',
          message: t('Password must contain between 8 and 128 characters.'),
        })
        return
      }
    }

    setIsSubmitting(true)
    try {
      const payload = transformFormDataToPayload(
        data,
        currentRow?.id,
        permissionCatalog
      )
      if (
        isUpdate &&
        externalMode &&
        form.getFieldState('sales_user_id').isDirty
      ) {
        payload.sales_user_id = data.sales_user_id ?? 0
      }
      if (
        isUpdate &&
        payload.admin_permissions &&
        JSON.stringify(payload.admin_permissions) ===
          JSON.stringify(
            normalizeAdminPermissions(
              loadedPermissions.current,
              permissionCatalog
            )
          )
      ) {
        delete payload.admin_permissions
      }
      // Role changes through the local edit flow also require verification.
      let proofToken: string | undefined
      if (isUpdate && currentRow) {
        const roleChanged =
          payload.role !== undefined && payload.role !== currentRow.role
        if (payload.password || payload.admin_permissions || roleChanged) {
          const proof = await requestVerification({
            scope: 'admin.user.update',
            context: { user_id: currentRow.id },
            title: t('Verify to update user credentials'),
            description: t(
              'Confirm your identity before changing the account {{username}}.',
              { username: currentRow.username }
            ),
          })
          if (!proof) return
          proofToken = proof.proof_token
        }
      } else if ((payload.role ?? 0) >= ROLE.ADMIN) {
        const proof = await requestVerification({
          scope: 'admin.user.create',
          context: { role: payload.role ?? ROLE.ADMIN },
          title: t('Verify to create administrator'),
          description: t(
            'Confirm your identity before creating an administrator account.'
          ),
        })
        if (!proof) return
        proofToken = proof.proof_token
      }
      const result = isUpdate
        ? await updateUser(
            payload as typeof payload & { id: number },
            proofToken
          )
        : await createUser(payload, proofToken)

      if (result.success) {
        toast.success(
          isUpdate
            ? t(SUCCESS_MESSAGES.USER_UPDATED)
            : t(SUCCESS_MESSAGES.USER_CREATED)
        )
        onOpenChange(false)
        triggerRefresh()
      } else {
        handleServerError(result, t(ERROR_MESSAGES.CREATE_FAILED))
      }
    } catch (error) {
      handleServerError(
        AuthOperationError.from(error),
        t(ERROR_MESSAGES.UNEXPECTED)
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const refreshUserData = async () => {
    if (!currentRow) return
    try {
      const result = requireServerSuccess(await getUser(currentRow.id))
      if (result.success && result.data) {
        loadedPermissions.current = result.data.admin_permissions
        form.reset(transformUserToFormDefaults(result.data))
      }
      triggerRefresh()
    } catch (error) {
      handleServerError(error, t('Failed to load'))
    }
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          onOpenChange(v)
          if (!v) {
            form.reset()
          }
        }}
      >
        <DialogContent className='flex h-[85vh] max-h-[85vh] w-[50vw] max-w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[50vw]'>
          <DialogHeader className={sideDrawerHeaderClassName()}>
            <DialogTitle>
              {isUpdate ? t('Update') : t('Create')} {t('User')}
            </DialogTitle>
            <DialogDescription>
              {isUpdate
                ? t('Update the user by providing necessary info.')
                : t('Add a new user by providing necessary info.')}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form
              id='user-form'
              onSubmit={form.handleSubmit(onSubmit)}
              className={sideDrawerFormClassName()}
            >
              {/* Basic Information */}
              <SideDrawerSection>
                <h3 className='text-sm font-medium'>
                  {t('Basic Information')}
                </h3>

                <FormField
                  control={form.control}
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
                  control={form.control}
                  name='role'
                  render={({ field }) => (
                    <FormItem className='min-w-0'>
                      <FormLabel>{t('Role')}</FormLabel>
                      <Select
                        items={[
                          { value: '1', label: t('Common User') },
                          { value: '2', label: t('BP') },
                          { value: '10', label: t('Admin') },
                        ]}
                        onValueChange={(value) =>
                          value !== null &&
                          field.onChange(Number.parseInt(value))
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
                            <SelectItem value='1'>
                              {t('Common User')}
                            </SelectItem>
                            <SelectItem value='2'>{t('BP')}</SelectItem>
                            <SelectItem value='10'>{t('Admin')}</SelectItem>
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        {t("Set the user's role (cannot be Root)")}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
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
                      <FormDescription>
                        {t(
                          "Select the department used as this user's cost center."
                        )}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {targetIsBP && (
                  <FormField
                    control={form.control}
                    name='overview_dept_ids'
                    render={({ field }) => (
                      <FormItem className='min-w-0'>
                        <FormLabel>
                          {t('Overview Visible Departments')}
                        </FormLabel>
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
                            'Select which departments this BP user can access in Data Overview. Selecting a department grants access to all its sub-departments.'
                          )}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name='display_name'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Display Name')}</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder={t('Enter display name')}
                        />
                      </FormControl>
                      <FormDescription>
                        {t('Leave empty to use username')}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='password'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Password')}</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type='password'
                          placeholder={
                            isUpdate
                              ? t('Leave empty to keep unchanged')
                              : t('Enter password (8–128 characters)')
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </SideDrawerSection>

              {/* Group & Quota Settings (Update only) */}
              {isUpdate && externalMode && (
                <SideDrawerSection>
                  <FormField
                    control={form.control}
                    name='sales_user_id'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('Assign sales contact')}</FormLabel>
                        <FormControl>
                          <Combobox
                            options={salesOptions}
                            value={String(field.value ?? 0)}
                            onValueChange={(value) =>
                              field.onChange(Number(value ?? 0))
                            }
                            onBlur={field.onBlur}
                            disabled={
                              salesQuery.isPending ||
                              salesQuery.isError ||
                              field.value === undefined
                            }
                            placeholder={t('Select a sales contact')}
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
                </SideDrawerSection>
              )}
              {isUpdate && (
                <SideDrawerSection>
                  <h3 className='text-sm font-medium'>{t('Group & Quota')}</h3>

                  <FormField
                    control={form.control}
                    name='group'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('Group')}</FormLabel>
                        <FormControl>
                          <Combobox
                            options={Object.entries(groups).map(
                              ([group, ratio]) => ({
                                value: group,
                                label: group,
                                suffix: `${ratio}x ${t('Ratio')}`,
                              })
                            )}
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

                  <FormField
                    control={form.control}
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
                            onClick={() => setQuotaDialogOpen(true)}
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
                    control={form.control}
                    name='remark'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('Remark')}</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            placeholder={t(
                              'Admin notes (only visible to admins)'
                            )}
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
                permissionCatalog.resources.length > 0 && (
                  <SideDrawerSection>
                    <h3 className='text-sm font-medium'>
                      {t('Admin Permissions')}
                    </h3>
                    <p className='text-muted-foreground text-xs'>
                      {t(
                        'Default administrator permissions can be overridden for this user.'
                      )}
                    </p>
                    <FormField
                      control={form.control}
                      name='admin_permissions'
                      render={({ field }) => {
                        const selected = normalizeAdminPermissions(
                          field.value,
                          permissionCatalog
                        )
                        return (
                          <FormItem className='min-w-0'>
                            <PermissionMatrix
                              resources={permissionCatalog.resources}
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
                          ? t(
                              'Your account can edit sensitive channel settings.'
                            )
                          : t(
                              'Your account cannot edit sensitive channel settings.'
                            )}
                      </p>
                    )}
                  </SideDrawerSection>
                )}

              {/* Binding Information (Read-only) */}
              {isUpdate && (
                <SideDrawerSection>
                  <h3 className='text-sm font-medium'>
                    {t('Binding Information')}
                  </h3>
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
                            (currentRow?.[key as keyof User] as string) || '-'
                          }
                          disabled
                          className='mt-1'
                        />
                      </div>
                    ))}
                  </div>
                </SideDrawerSection>
              )}
            </form>
          </Form>
          <DialogFooter className={sideDrawerFooterClassName()}>
            <DialogClose render={<Button variant='outline' />}>
              {t('Close')}
            </DialogClose>
            <Button form='user-form' type='submit' disabled={isSubmitting}>
              {isSubmitting ? t('Saving...') : t('Save changes')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Adjust Quota Dialog */}
      {currentRow && (
        <UserQuotaDialog
          open={quotaDialogOpen}
          onOpenChange={setQuotaDialogOpen}
          userId={currentRow.id}
          currentQuota={parseQuotaFromDollars(currentQuotaRaw || 0)}
          onSuccess={refreshUserData}
        />
      )}
    </>
  )
}
