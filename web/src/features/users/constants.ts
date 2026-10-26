import {
  BadgeCheck,
  Building2,
  CircleDashed,
  ReceiptText,
  Shield,
  Sparkles,
  User,
  Users,
  WalletCards,
  type LucideIcon,
} from 'lucide-react'

import type { StatusVariant } from '@/components/status-badge'

import type {
  User as UserType,
  UserCustomerType,
  UserSettlementMode,
} from './types'

// ============================================================================
// User Utilities
// ============================================================================

export const isUserDeleted = (user: UserType): boolean => {
  return user.DeletedAt != null
}

// ============================================================================
// User Status Configuration
// ============================================================================

export const USER_STATUS = {
  ENABLED: 1,
  DISABLED: 2,
  DELETED: -1,
} as const

export const USER_STATUSES = {
  [USER_STATUS.ENABLED]: {
    labelKey: 'Enabled',
    variant: 'success' as const,
    value: USER_STATUS.ENABLED,
  },
  [USER_STATUS.DISABLED]: {
    labelKey: 'Disabled',
    variant: 'neutral' as const,
    value: USER_STATUS.DISABLED,
  },
  [USER_STATUS.DELETED]: {
    labelKey: 'Deleted',
    variant: 'danger' as const,
    value: USER_STATUS.DELETED,
  },
} as const

export const getUserStatusOptions = (t: (key: string) => string) => [
  { label: t('Enabled'), value: String(USER_STATUS.ENABLED) },
  { label: t('Disabled'), value: String(USER_STATUS.DISABLED) },
  { label: t('Deleted'), value: String(USER_STATUS.DELETED) },
]

// ============================================================================
// User Role Configuration
// ============================================================================

export const USER_ROLE = {
  USER: 1,
  BU_BP: 2,
  ADMIN: 10,
  ROOT: 100,
} as const

export const USER_ROLES = {
  [USER_ROLE.USER]: {
    labelKey: 'User',
    value: USER_ROLE.USER,
    icon: User,
  },
  [USER_ROLE.BU_BP]: {
    labelKey: 'BP',
    value: USER_ROLE.BU_BP,
    icon: Building2,
  },
  [USER_ROLE.ADMIN]: {
    labelKey: 'Admin',
    value: USER_ROLE.ADMIN,
    icon: Users,
  },
  [USER_ROLE.ROOT]: {
    labelKey: 'Root',
    value: USER_ROLE.ROOT,
    icon: Shield,
  },
} as const

export const getUserRoleOptions = (t: (key: string) => string) => [
  { label: t('User'), value: String(USER_ROLE.USER), icon: User },
  { label: t('BP'), value: String(USER_ROLE.BU_BP), icon: Building2 },
  { label: t('Admin'), value: String(USER_ROLE.ADMIN), icon: Users },
  { label: t('Root'), value: String(USER_ROLE.ROOT), icon: Shield },
]

export const getRegistrationMethodOptions = (t: (key: string) => string) => [
  { label: t('LDAP'), value: 'ldap', icon: Building2 },
  { label: t('Manual'), value: 'manual', icon: User },
]

// ============================================================================
// Commercial Attributes
// ============================================================================

export const USER_CUSTOMER_TYPE = {
  UNSET: 'unset',
  TRIAL: 'trial',
  PAID: 'paid',
} as const satisfies Record<string, UserCustomerType>

interface UserCommercialAttributeConfig {
  labelKey: string
  variant: StatusVariant
  icon: LucideIcon
  className: string
}

export const USER_CUSTOMER_TYPES: Record<
  UserCustomerType,
  UserCommercialAttributeConfig
> = {
  unset: {
    labelKey: 'Not set',
    variant: 'neutral',
    icon: CircleDashed,
    className: 'border-border/70 bg-muted/50 text-muted-foreground',
  },
  trial: {
    labelKey: 'Trial',
    variant: 'info',
    icon: Sparkles,
    className:
      'border-sky-500/20 bg-sky-500/10 text-sky-700 dark:border-sky-400/20 dark:bg-sky-400/10 dark:text-sky-300',
  },
  paid: {
    labelKey: 'Paid',
    variant: 'success',
    icon: BadgeCheck,
    className:
      'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-300',
  },
}

export const getUserCustomerTypeOptions = (t: (key: string) => string) => [
  { label: t('Trial'), value: USER_CUSTOMER_TYPE.TRIAL },
  { label: t('Paid'), value: USER_CUSTOMER_TYPE.PAID },
  { label: t('Not set'), value: USER_CUSTOMER_TYPE.UNSET },
]

export const USER_SETTLEMENT_MODE = {
  PREPAID: 'prepaid',
  POSTPAID: 'postpaid',
} as const satisfies Record<string, UserSettlementMode>

export const USER_SETTLEMENT_MODES: Record<
  UserSettlementMode,
  UserCommercialAttributeConfig
> = {
  prepaid: {
    labelKey: 'Prepaid',
    variant: 'info',
    icon: WalletCards,
    className:
      'border-indigo-500/20 bg-indigo-500/10 text-indigo-700 dark:border-indigo-400/20 dark:bg-indigo-400/10 dark:text-indigo-300',
  },
  postpaid: {
    labelKey: 'Postpaid',
    variant: 'warning',
    icon: ReceiptText,
    className:
      'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-300',
  },
}

export const getUserSettlementModeOptions = (t: (key: string) => string) => [
  { label: t('Prepaid'), value: USER_SETTLEMENT_MODE.PREPAID },
  { label: t('Postpaid'), value: USER_SETTLEMENT_MODE.POSTPAID },
]

// ============================================================================
// Default Values
// ============================================================================

export const DEFAULT_GROUP = 'default' as const

// ============================================================================
// Third-party Binding Fields
// ============================================================================

export const BINDING_FIELDS = [
  { key: 'oidc_id', label: 'OIDC ID' },
  { key: 'wechat_id', label: 'WeChat ID' },
  { key: 'email', label: 'Email' },
] as const

// ============================================================================
// Error Messages (i18n keys: use t(ERROR_MESSAGES.xxx) when displaying)
// ============================================================================

export const ERROR_MESSAGES = {
  UNEXPECTED: 'An unexpected error occurred',
  NO_USER: 'No user selected',
  LOAD_FAILED: 'Failed to load users',
  SEARCH_FAILED: 'Failed to search users',
  CREATE_FAILED: 'Failed to create user',
  UPDATE_FAILED: 'Failed to update user',
  DELETE_FAILED: 'Failed to delete user',
} as const

// ============================================================================
// Success Messages (i18n keys: use t(SUCCESS_MESSAGES.xxx) when displaying)
// ============================================================================

export const SUCCESS_MESSAGES = {
  USER_CREATED: 'User created successfully',
  USER_UPDATED: 'User updated successfully',
} as const
