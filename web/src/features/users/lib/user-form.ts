import type { z } from 'zod'

import type { PermissionCatalog } from '@/lib/admin-permissions'

import type { User, UserFormData } from '../types'
import * as accountForm from './user-account-form'
import {
  getUserFormExtensionPayload,
  getUserFormExtensionValues,
  userFormExtensionDefaults,
  userFormExtensionSchema,
} from './user-form-extensions'

export {
  getCostCenterDepartmentPath,
  type CostCenterSelection,
} from './user-form-extensions'

export const userFormSchema = accountForm.userFormSchema.extend(
  userFormExtensionSchema.shape
)
export type UserFormValues = z.infer<typeof userFormSchema>

export const USER_FORM_DEFAULT_VALUES: UserFormValues = {
  ...accountForm.USER_FORM_DEFAULT_VALUES,
  ...userFormExtensionDefaults,
}

export function transformUserToFormDefaults(user: User): UserFormValues {
  return {
    ...accountForm.transformUserToFormDefaults(user),
    ...getUserFormExtensionValues(user),
  }
}

export function transformFormDataToPayload(
  data: UserFormValues,
  userId?: number,
  catalog?: PermissionCatalog,
  externalMode = false,
  salesChanged = false
): UserFormData & { id?: number } {
  return {
    ...accountForm.transformFormDataToPayload(data, userId, catalog),
    ...getUserFormExtensionPayload(data, userId, externalMode, salesChanged),
  }
}

export function requiresUserUpdateVerification(
  payload: UserFormData,
  user: User
): boolean {
  return Boolean(
    payload.password ||
    payload.admin_permissions ||
    (payload.role !== undefined && payload.role !== user.role)
  )
}
