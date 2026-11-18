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
import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Dialog } from '@/components/dialog'
import {
  sideDrawerFooterClassName,
  sideDrawerHeaderClassName,
} from '@/components/drawer-layout'
import { Button } from '@/components/ui/button'
import { DialogClose } from '@/components/ui/dialog'
import { Form } from '@/components/ui/form'
import { useExternalMode } from '@/hooks/use-external-mode'
import {
  EMPTY_PERMISSION_CATALOG,
  normalizeAdminPermissions,
  type AdminPermissionMatrix,
} from '@/lib/admin-permissions'
import { parseQuotaFromDollars } from '@/lib/format'
import { handleServerError } from '@/lib/handle-server-error'
import { accountPasswordSchema } from '@/lib/password-policy'
import { ROLE } from '@/lib/roles'
import { AuthOperationError } from '@/lib/secure-verification'
import { requireServerSuccess } from '@/lib/server-error-message'

import { createUser, updateUser, getUser, getPermissionCatalog } from '../api'
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from '../constants'
import {
  userFormSchema,
  type UserFormValues,
  USER_FORM_DEFAULT_VALUES,
  requiresUserUpdateVerification,
  transformFormDataToPayload,
  transformUserToFormDefaults,
} from '../lib'
import type { User } from '../types'
import { UserAccountFields } from './user-account-fields'
import { UserExtensionFields } from './user-extension-fields'
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
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [quotaDialogOpen, setQuotaDialogOpen] = useState(false)
  // Matrix as loaded from the server; an unchanged matrix is not resubmitted so
  // routine edits of an administrator do not require step-up verification.
  const loadedPermissions = useRef<AdminPermissionMatrix | undefined>(undefined)

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

  const currentQuotaRaw = form.watch('quota_dollars') || 0

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
        permissionCatalog,
        externalMode,
        form.getFieldState('sales_user_ids').isDirty
      )
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
      let proofToken: string | undefined
      if (isUpdate && currentRow) {
        if (requiresUserUpdateVerification(payload, currentRow)) {
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
        title={`${isUpdate ? t('Update') : t('Create')} ${t('User')}`}
        description={
          isUpdate
            ? t('Update the user by providing necessary info.')
            : t('Add a new user by providing necessary info.')
        }
        contentClassName='max-h-[min(85dvh,var(--dialog-available-height,85dvh))] w-[calc(100%-2rem)] gap-0 overflow-hidden p-0 sm:max-w-6xl sm:p-0'
        headerClassName={sideDrawerHeaderClassName()}
        bodyContainerClassName='mx-0'
        bodyClassName='px-4 py-4 sm:px-6 sm:py-5'
        footerClassName={sideDrawerFooterClassName(
          'sm:mx-0 sm:mb-0 sm:px-6 sm:py-4'
        )}
        footer={
          <>
            <DialogClose render={<Button variant='outline' />}>
              {t('Close')}
            </DialogClose>
            <Button form='user-form' type='submit' disabled={isSubmitting}>
              {isSubmitting ? t('Saving...') : t('Save changes')}
            </Button>
          </>
        }
      >
        <Form {...form}>
          <form
            id='user-form'
            onSubmit={form.handleSubmit(onSubmit)}
            className='grid gap-6 md:grid-cols-2'
          >
            <UserAccountFields
              currentRow={currentRow}
              permissionCatalog={permissionCatalog}
              onAdjustQuota={() => setQuotaDialogOpen(true)}
            />
            <UserExtensionFields
              open={open}
              externalMode={externalMode}
              isUpdate={isUpdate}
            />
          </form>
        </Form>
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
