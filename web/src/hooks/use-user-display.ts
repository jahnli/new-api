import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { getRoleIcon, getRoleLabel } from '@/lib/roles'
import type { AuthUser } from '@/stores/auth-store'

import { useExternalMode } from './use-external-mode'

/**
 * Custom hook to format user display information
 * Centralizes user display logic used across ProfileDropdown and MobileDrawer
 */
export function useUserDisplay(user: AuthUser | null | undefined) {
  const { t } = useTranslation()
  const externalMode = useExternalMode()
  return useMemo(() => {
    if (!user) {
      return {
        displayName: t('User'),
        secondaryText: '',
        initials: 'U',
        roleLabel: '',
      }
    }

    // Display name: priority order
    const displayName = user.display_name || user.username || t('User')

    // Secondary text: first available identifier
    const secondaryText = (() => {
      if (user.email) return user.email
      if (user.oidc_id) return `OIDC ID: ${user.oidc_id}`
      if (user.wechat_id) return `WeChat ID: ${user.wechat_id}`
      if (user.username) return user.username
      if (user.display_name) return user.display_name
      return ''
    })()

    // Generate initials from display name
    const initials = displayName
      .split(' ')
      .map((n: string) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)

    // Get role label and icon
    const roleLabel = getRoleLabel(user.role, externalMode)
    const roleIcon = getRoleIcon(user.role)

    return {
      displayName,
      secondaryText,
      initials,
      roleLabel,
      roleIcon,
    }
  }, [user, t, externalMode])
}
