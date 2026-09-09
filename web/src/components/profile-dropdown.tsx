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
import { useNavigate } from '@tanstack/react-router'
import { LogOut, Settings, ShieldCheck, User, Wallet } from 'lucide-react'
import { useCallback, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SignOutDialog } from '@/components/sign-out-dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import useDialogState from '@/hooks/use-dialog'
import { useIsSidebarModuleVisible } from '@/hooks/use-sidebar-config'
import { useUserDisplay } from '@/hooks/use-user-display'
import { getUserAvatarFallback, getUserAvatarStyle } from '@/lib/avatar'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

const avatarFallbackClassName = 'font-semibold text-white'

export function ProfileDropdown() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [signOutOpen, setSignOutOpen] = useDialogState()
  const [menuOpen, setMenuOpen] = useState(false)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout>>(null)

  const handleMouseEnter = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
    setMenuOpen(true)
  }, [])

  const handleMouseLeave = useCallback(() => {
    closeTimerRef.current = setTimeout(() => setMenuOpen(false), 150)
  }, [])
  const user = useAuthStore((state) => state.auth.user)
  const { displayName, roleLabel, roleIcon } = useUserDisplay(user)
  const isSuperAdmin = user?.role === ROLE.SUPER_ADMIN
  const isWalletVisible = useIsSidebarModuleVisible('/wallet')
  const isSecurityVisible = useIsSidebarModuleVisible('/security')
  const avatarName = user?.username || displayName
  const avatarFallback = getUserAvatarFallback(avatarName)
  const avatarFallbackStyle = useMemo(
    () => getUserAvatarStyle(avatarName),
    [avatarName]
  )

  const avatarUrl = user?.avatar_url

  return (
    <>
      <div onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
        <DropdownMenu modal={false} open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger
            render={
              <Button
                variant='ghost'
                className='relative flex items-center gap-1.5 p-0 sm:pe-1'
              />
            }
          >
            <Avatar className='size-6'>
              {avatarUrl && <AvatarImage src={avatarUrl} alt={avatarName} />}
              <AvatarFallback
                className={`${avatarFallbackClassName} text-[11px]`}
                style={avatarFallbackStyle}
              >
                {avatarFallback}
              </AvatarFallback>
            </Avatar>
            <span className='text-foreground hidden max-w-[100px] truncate text-sm font-medium sm:inline'>
              {displayName}
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end' sideOffset={8} className='w-56'>
            <div
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              <div className='flex items-center gap-2 px-1.5 py-1.5'>
                <Avatar className='size-8'>
                  {avatarUrl && (
                    <AvatarImage src={avatarUrl} alt={avatarName} />
                  )}
                  <AvatarFallback
                    className={`${avatarFallbackClassName} text-xs`}
                    style={avatarFallbackStyle}
                  >
                    {avatarFallback}
                  </AvatarFallback>
                </Avatar>
                <div className='flex flex-1 flex-col gap-0.5 overflow-hidden'>
                  <p className='text-foreground truncate text-sm font-medium'>
                    {displayName}
                  </p>
                  <span className='text-muted-foreground text-xs'>
                    <span className='relative -top-px text-[13px]'>
                      {roleIcon}
                    </span>{' '}
                    {roleLabel}
                  </span>
                </div>
              </div>

              <DropdownMenuSeparator />

              <DropdownMenuItem onClick={() => navigate({ to: '/profile' })}>
                <User className='size-4' />
                {t('Profile')}
              </DropdownMenuItem>

              {isSecurityVisible && (
                <DropdownMenuItem onClick={() => navigate({ to: '/security' })}>
                  <ShieldCheck className='size-4' />
                  {t('Security & Access')}
                </DropdownMenuItem>
              )}

              {isWalletVisible && (
                <DropdownMenuItem onClick={() => navigate({ to: '/wallet' })}>
                  <Wallet className='size-4' />
                  {t('Wallet')}
                </DropdownMenuItem>
              )}

              {isSuperAdmin && (
                <DropdownMenuItem
                  onClick={() =>
                    navigate({
                      to: '/system-settings/site/$section',
                      params: { section: 'system-info' },
                    })
                  }
                >
                  <Settings className='size-4' />
                  {t('System Settings')}
                </DropdownMenuItem>
              )}

              <DropdownMenuSeparator />

              <DropdownMenuItem
                variant='destructive'
                onClick={() => setSignOutOpen(true)}
              >
                <LogOut className='size-4' />
                {t('Sign out')}
              </DropdownMenuItem>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <SignOutDialog open={!!signOutOpen} onOpenChange={setSignOutOpen} />
    </>
  )
}
