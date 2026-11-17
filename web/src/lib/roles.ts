import { t } from 'i18next'

export const ROLE = {
  GUEST: 0,
  USER: 1,
  BU_BP: 2,
  ADMIN: 10,
  SUPER_ADMIN: 100,
} as const

export type RoleValue = (typeof ROLE)[keyof typeof ROLE]

const DEFAULT_ROLE = ROLE.GUEST

const ROLE_LABEL_KEYS: Record<RoleValue, string> = {
  [ROLE.SUPER_ADMIN]: 'Super Admin',
  [ROLE.ADMIN]: 'Admin',
  [ROLE.BU_BP]: 'BP',
  [ROLE.USER]: 'User',
  [ROLE.GUEST]: 'Guest',
}

const ROLE_ICONS: Record<RoleValue, string> = {
  [ROLE.SUPER_ADMIN]: '👑',
  [ROLE.ADMIN]: '🏅',
  [ROLE.BU_BP]: '📈',
  [ROLE.USER]: '🧑‍💼',
  [ROLE.GUEST]: '👁️',
}

export function getRoleLabelKey(role?: number, externalMode = false): string {
  if (externalMode && role === ROLE.BU_BP) return 'Sales'
  return ROLE_LABEL_KEYS[role as RoleValue] ?? ROLE_LABEL_KEYS[DEFAULT_ROLE]
}

export function getRoleLabel(role?: number, externalMode = false): string {
  return t(getRoleLabelKey(role, externalMode))
}

export function getRoleIcon(role?: number): string {
  return ROLE_ICONS[role as RoleValue] ?? ROLE_ICONS[DEFAULT_ROLE]
}

export interface DataOverviewAccessUser {
  role: number
  overview_dept_ids?: string[]
  is_dept_leader?: boolean
}

/**
 * Decides whether a user may enter the data overview. Admins and root always
 * can; the BP role additionally needs at least one configured overview
 * department; other users can enter only when they lead at least one department.
 */
export function canAccessDataOverview(
  user: DataOverviewAccessUser | null | undefined
): boolean {
  if (!user) return false
  if (user.role >= ROLE.ADMIN) return true
  if (user.role === ROLE.BU_BP) return (user.overview_dept_ids?.length ?? 0) > 0
  return user.is_dept_leader === true
}
