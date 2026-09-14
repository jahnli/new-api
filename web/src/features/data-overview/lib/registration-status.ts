import type { DepartmentRegistrationStatus, DepartmentUser } from '../types'

export const DEPARTMENT_REGISTRATION_STATUS = {
  REGISTERED: 'registered',
  UNREGISTERED: 'unregistered',
  DEPARTED: 'departed',
} as const

export function getDepartmentUserRegistrationStatus(
  user: DepartmentUser
): DepartmentRegistrationStatus {
  if (
    user.registration_status === DEPARTMENT_REGISTRATION_STATUS.REGISTERED ||
    user.registration_status === DEPARTMENT_REGISTRATION_STATUS.UNREGISTERED ||
    user.registration_status === DEPARTMENT_REGISTRATION_STATUS.DEPARTED
  ) {
    return user.registration_status
  }
  if (user.is_registered === false) {
    return DEPARTMENT_REGISTRATION_STATUS.UNREGISTERED
  }
  if (user.status === 2) {
    return DEPARTMENT_REGISTRATION_STATUS.DEPARTED
  }
  return DEPARTMENT_REGISTRATION_STATUS.REGISTERED
}

export function isDepartmentUserRegistered(user: DepartmentUser): boolean {
  return (
    getDepartmentUserRegistrationStatus(user) !==
    DEPARTMENT_REGISTRATION_STATUS.UNREGISTERED
  )
}

// The `departed` constant mirrors the backend's registration_status value; the UI
// labels it "Disabled" because a disabled account is all the system can prove.
export function getDepartmentRegistrationStatusLabel(
  status: DepartmentRegistrationStatus
): 'Enabled' | 'Disabled' | 'Unregistered' {
  if (status === DEPARTMENT_REGISTRATION_STATUS.UNREGISTERED) {
    return 'Unregistered'
  }
  if (status === DEPARTMENT_REGISTRATION_STATUS.DEPARTED) {
    return 'Disabled'
  }
  return 'Enabled'
}
