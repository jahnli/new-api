import type { AdminUserManageAction } from '@/features/auth/secure-verification'

import type { ManageUserAction } from '../types'

// ============================================================================
// User Action Messages
// ============================================================================

export const MANAGE_ACTION_TITLES: Record<AdminUserManageAction, string> = {
  disable: 'Verify to disable user',
  schedule_disable: 'Schedule disable',
  cancel_disable: 'Cancel scheduled disable',
  enable: 'Verify to enable user',
  promote: 'Verify to promote user',
  demote: 'Verify to demote user',
}

const ACTION_MESSAGES: Record<ManageUserAction, string> = {
  enable: 'User enabled successfully',
  disable: 'Disable scheduled',
  schedule_disable: 'Disable scheduled',
  cancel_disable: 'Scheduled disable canceled',
  promote: 'User promoted to admin successfully',
  demote: 'User demoted to regular user successfully',
  add_quota: 'Quota adjusted successfully',
}

/**
 * Get success message for user management action
 */
export function getUserActionMessage(action: ManageUserAction): string {
  return ACTION_MESSAGES[action]
}
