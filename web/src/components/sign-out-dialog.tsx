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
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { logout } from '@/features/auth/api'
import { suspendOIDCAutoLogin } from '@/features/auth/lib/oidc-auto-login'
import { clearAuthenticatedClientState } from '@/lib/auth-session'
import { handleServerError } from '@/lib/handle-server-error'
import { useAuthStore } from '@/stores/auth-store'

interface SignOutDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SignOutDialog({ open, onOpenChange }: SignOutDialogProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [isSigningOut, setIsSigningOut] = useState(false)
  const isOIDCSession = useAuthStore(
    (state) => state.auth.session?.login_method === 'oauth:oidc'
  )

  const handleSignOut = async () => {
    setIsSigningOut(true)
    try {
      const response = await logout(true)
      if (!response.success) {
        handleServerError(response, t('Failed to sign out session'))
        return
      }

      suspendOIDCAutoLogin()
      clearAuthenticatedClientState(queryClient)
      if (response.data?.logout_url && URL.canParse(response.data.logout_url)) {
        const logoutURL = new URL(response.data.logout_url)
        if (
          logoutURL.protocol === 'https:' &&
          !logoutURL.username &&
          !logoutURL.password &&
          !logoutURL.hash
        ) {
          window.location.assign(logoutURL.href)
          return
        }
      }
      if (response.data?.single_sign_out_unavailable || isOIDCSession) {
        toast.warning(
          t(
            'Signed out locally. Single sign-out is unavailable; you may still be signed in to your identity provider.'
          )
        )
      } else {
        toast.success(t('Signed out'))
      }
      void navigate({
        to: '/sign-in',
        search: { auto_login: false },
        replace: true,
      })
    } catch (error: unknown) {
      handleServerError(error, t('Failed to sign out session'))
    } finally {
      setIsSigningOut(false)
    }
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('Sign out')}
      desc={
        isOIDCSession
          ? t(
              'Signing out will also request sign-out from your identity provider and may sign you out of other connected applications.'
            )
          : t(
              'Are you sure you want to sign out? You will need to sign in again to access your account.'
            )
      }
      confirmText={t('Sign out')}
      handleConfirm={handleSignOut}
      isLoading={isSigningOut}
      className='sm:max-w-sm'
    />
  )
}
