import type { Row } from '@tanstack/react-table'
import {
  Pencil,
  Power,
  PowerOff,
  ArrowUp,
  ArrowDown,
  KeyRound,
  ShieldAlert,
  Link2,
  CreditCard,
  BarChart3,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { DataTableRowActionMenu } from '@/components/data-table/core/row-action-menu'
import { Button } from '@/components/ui/button'
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { UserStatsDialog } from '@/features/data-overview/components/user-stats-dialog'
import { UserSubscriptionsDialog } from '@/features/subscriptions/components/dialogs/user-subscriptions-dialog'
import { handleServerError } from '@/lib/handle-server-error'

import { manageUser, resetUserPasskey, resetUserTwoFA } from '../api'
import {
  USER_STATUS,
  USER_ROLE,
  ERROR_MESSAGES,
  isUserDeleted,
} from '../constants'
import { getUserActionMessage } from '../lib'
import type { User, ManageUserAction } from '../types'
import { UserBindingDialog } from './dialogs/user-binding-dialog'
import { useUsers } from './users-provider'

interface DataTableRowActionsProps {
  row: Row<User>
}

export function DataTableRowActions({ row }: DataTableRowActionsProps) {
  const { t } = useTranslation()
  const user = row.original
  const { setOpen, setCurrentRow, triggerRefresh } = useUsers()
  const [resetPasskeyOpen, setResetPasskeyOpen] = useState(false)
  const [resetTwoFAOpen, setResetTwoFAOpen] = useState(false)
  const [bindingDialogOpen, setBindingDialogOpen] = useState(false)
  const [subscriptionsDialogOpen, setSubscriptionsDialogOpen] = useState(false)
  const [statsDialogOpen, setStatsDialogOpen] = useState(false)

  const handleEdit = () => {
    setCurrentRow(user)
    setOpen('update')
  }

  const handleManage = async (
    action: Exclude<ManageUserAction, 'add_quota'>
  ) => {
    try {
      const result = await manageUser(user.id, action)
      if (result.success) {
        toast.success(t(getUserActionMessage(action)))
        triggerRefresh()
      } else {
        handleServerError(result, t('Failed to {{action}} user', { action }))
      }
    } catch (error) {
      handleServerError(error, t(ERROR_MESSAGES.UNEXPECTED))
    }
  }

  const handleResetPasskey = async () => {
    try {
      const result = await resetUserPasskey(user.id)
      if (result.success) {
        toast.success(t('Passkey reset successfully'))
        triggerRefresh()
      } else {
        handleServerError(result, t('Failed to reset Passkey'))
      }
    } catch (error) {
      handleServerError(error, t(ERROR_MESSAGES.UNEXPECTED))
    } finally {
      setResetPasskeyOpen(false)
    }
  }

  const handleResetTwoFA = async () => {
    try {
      const result = await resetUserTwoFA(user.id)
      if (result.success) {
        toast.success(t('Two-factor authentication reset'))
        triggerRefresh()
      } else {
        handleServerError(result, t('Failed to reset 2FA'))
      }
    } catch (error) {
      handleServerError(error, t(ERROR_MESSAGES.UNEXPECTED))
    } finally {
      setResetTwoFAOpen(false)
    }
  }

  const isDisabled = user.status === USER_STATUS.DISABLED
  const isAdmin = user.role >= USER_ROLE.ADMIN
  const isRoot = user.role === USER_ROLE.ROOT

  if (isUserDeleted(user)) {
    return null
  }

  return (
    <div className='-ml-1.5 flex items-center gap-1'>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant='ghost'
              size='icon-sm'
              onClick={() => setStatsDialogOpen(true)}
              aria-label={t('Statistics')}
            />
          }
        >
          <BarChart3 />
        </TooltipTrigger>
        <TooltipContent>{t('Statistics')}</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant='ghost'
              size='icon-sm'
              onClick={handleEdit}
              aria-label={t('Edit')}
            />
          }
        >
          <Pencil />
        </TooltipTrigger>
        <TooltipContent>{t('Edit')}</TooltipContent>
      </Tooltip>

      <DataTableRowActionMenu
        ariaLabel={t('Open menu')}
        contentClassName='w-48'
      >
        {isDisabled ? (
          <DropdownMenuItem onClick={() => handleManage('enable')}>
            {t('Enable')}
            <DropdownMenuShortcut>
              <Power size={16} />
            </DropdownMenuShortcut>
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            onClick={() => handleManage('disable')}
            disabled={isRoot}
          >
            {t('Disable')}
            <DropdownMenuShortcut>
              <PowerOff size={16} />
            </DropdownMenuShortcut>
          </DropdownMenuItem>
        )}

        {isAdmin && !isRoot && (
          <DropdownMenuItem onClick={() => handleManage('demote')}>
            {t('Demote')}
            <DropdownMenuShortcut>
              <ArrowDown size={16} />
            </DropdownMenuShortcut>
          </DropdownMenuItem>
        )}

        {!isAdmin && (
          <DropdownMenuItem onClick={() => handleManage('promote')}>
            {t('Promote')}
            <DropdownMenuShortcut>
              <ArrowUp size={16} />
            </DropdownMenuShortcut>
          </DropdownMenuItem>
        )}

        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault()
            setBindingDialogOpen(true)
          }}
        >
          {t('Manage Bindings')}
          <DropdownMenuShortcut>
            <Link2 size={16} />
          </DropdownMenuShortcut>
        </DropdownMenuItem>

        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault()
            setSubscriptionsDialogOpen(true)
          }}
        >
          {t('Manage Subscriptions')}
          <DropdownMenuShortcut>
            <CreditCard size={16} />
          </DropdownMenuShortcut>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault()
            setResetPasskeyOpen(true)
          }}
          disabled={isRoot}
        >
          {t('Reset Passkey')}
          <DropdownMenuShortcut>
            <KeyRound size={16} />
          </DropdownMenuShortcut>
        </DropdownMenuItem>

        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault()
            setResetTwoFAOpen(true)
          }}
          disabled={isRoot}
        >
          {t('Reset 2FA')}
          <DropdownMenuShortcut>
            <ShieldAlert size={16} />
          </DropdownMenuShortcut>
        </DropdownMenuItem>
      </DataTableRowActionMenu>

      <ConfirmDialog
        open={resetPasskeyOpen}
        onOpenChange={setResetPasskeyOpen}
        title={t('Reset Passkey')}
        desc={t(
          'Reset Passkey for {{username}}? The user will need to register a new Passkey before using passwordless login.',
          { username: user.username }
        )}
        confirmText={t('Reset Passkey')}
        handleConfirm={handleResetPasskey}
      />

      <ConfirmDialog
        open={resetTwoFAOpen}
        onOpenChange={setResetTwoFAOpen}
        title={t('Reset Two-Factor Authentication')}
        desc={t(
          'Reset 2FA for {{username}}? The user must set up 2FA again to continue using it.',
          { username: user.username }
        )}
        confirmText={t('Reset 2FA')}
        handleConfirm={handleResetTwoFA}
      />

      <UserBindingDialog
        open={bindingDialogOpen}
        onOpenChange={setBindingDialogOpen}
        userId={user.id}
        onUnbindSuccess={triggerRefresh}
      />

      <UserSubscriptionsDialog
        open={subscriptionsDialogOpen}
        onOpenChange={setSubscriptionsDialogOpen}
        user={{ id: user.id, username: user.username }}
        onSuccess={triggerRefresh}
      />

      <UserStatsDialog
        open={statsDialogOpen}
        onOpenChange={setStatsDialogOpen}
        user={
          statsDialogOpen
            ? {
                id: user.id,
                username: user.username,
                display_name: user.display_name,
                quota: user.quota,
                used_quota: user.used_quota,
                sub_quota_used: user.sub_quota_used ?? 0,
                sub_quota_total: user.sub_quota_total ?? 0,
                total_amount_cny: 0,
                total_tokens: 0,
                total_requests: 0,
                request_count: user.request_count,
                group: user.group,
                status: user.status,
                role: user.role,
              }
            : null
        }
        initialStartTimestamp={0}
        initialEndTimestamp={0}
      />
    </div>
  )
}
