import { useQuery } from '@tanstack/react-query'
import type { Table } from '@tanstack/react-table'
import { Power, PowerOff, Tags, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { DataTableBulkActions as BulkActionsToolbar } from '@/components/data-table'
import { TextTooltip } from '@/components/text-tooltip'
import { Button } from '@/components/ui/button'
import { Combobox } from '@/components/ui/combobox'
import { Label } from '@/components/ui/label'
import { toIntlLocale } from '@/i18n/languages'
import { formatNumber } from '@/lib/format'
import {
  getServerErrorMessage,
  requireServerSuccess,
} from '@/lib/server-error-message'
import { useAuthStore } from '@/stores/auth-store'

import { getGroups } from '../api'
import { isUserDeleted, USER_STATUS } from '../constants'
import {
  useBulkUserActions,
  type BulkUserAction,
  type BulkUserOperation,
} from '../hooks/use-bulk-user-actions'
import type { User } from '../types'
import { useUsers } from './users-provider'

interface DataTableBulkActionsProps {
  table: Table<User>
}

export function DataTableBulkActions(props: DataTableBulkActionsProps) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const currentUser = useAuthStore((state) => state.auth.user)
  const { verificationActive } = useUsers()
  const [operation, setOperation] = useState<BulkUserOperation | null>(null)
  const mutation = useBulkUserActions(props.table)
  const selectedRows = props.table.getFilteredSelectedRowModel().rows
  const groupsQuery = useQuery({
    queryKey: ['groups'],
    queryFn: async () => requireServerSuccess(await getGroups()),
    enabled: operation?.action === 'group',
    staleTime: 5 * 60 * 1000,
  })
  const groups = groupsQuery.data?.data ?? []
  const actions = [
    {
      action: 'enable',
      label: t('Enable selected users'),
      text: t('Enable'),
      icon: Power,
    },
    {
      action: 'disable',
      label: t('Disable selected users'),
      text: t('Disable'),
      icon: PowerOff,
    },
    {
      action: 'group',
      label: t('Change group'),
      text: t('Change group'),
      icon: Tags,
    },
    {
      action: 'delete',
      label: t('Delete selected users'),
      text: t('Delete'),
      icon: Trash2,
    },
  ] as const

  const handleOpen = (action: BulkUserAction) => {
    if (mutation.isPending) return
    const users = selectedRows
      .map((row) => row.original)
      .filter((user) => {
        if (
          !currentUser ||
          user.id === currentUser.id ||
          user.role >= currentUser.role ||
          isUserDeleted(user)
        ) {
          return false
        }
        if (action === 'enable') return user.status !== USER_STATUS.ENABLED
        if (action === 'disable') return user.status !== USER_STATUS.DISABLED
        return true
      })
    setOperation({
      action,
      users,
      skipped: selectedRows.length - users.length,
      group: '',
    })
  }

  return (
    <>
      <BulkActionsToolbar table={props.table} entityName={t('User')}>
        {actions.map(({ action, label, text, icon: Icon }) => (
          <TextTooltip key={action} content={label}>
            <Button
              variant='outline'
              className={action === 'delete' ? 'text-destructive' : undefined}
              aria-label={label}
              disabled={mutation.isPending}
              onClick={() => handleOpen(action)}
            >
              <Icon
                className='size-4'
                data-icon='inline-start'
                aria-hidden='true'
              />
              {text}
            </Button>
          </TextTooltip>
        ))}
      </BulkActionsToolbar>
      <ConfirmDialog
        open={operation !== null && !verificationActive}
        onOpenChange={(open) => {
          if (!open && !mutation.isPending) setOperation(null)
        }}
        title={
          actions.find(({ action }) => action === operation?.action)?.label
        }
        desc={
          <div className='space-y-2'>
            <p>
              {t('Apply this action to {{count}} selected users?', {
                count: operation?.users.length ?? 0,
              })}
            </p>
            {operation?.action === 'delete' && (
              <p>{t('This action cannot be undone.')}</p>
            )}
            {operation && operation.action !== 'group' && (
              <p>
                {t(
                  'Security verification may be required for each user. Canceling verification stops the remaining operations.'
                )}
              </p>
            )}
            {!!operation?.skipped && (
              <p>
                {t(
                  '{{count}} users will be skipped because they cannot be managed or already have the requested status.',
                  { count: operation.skipped }
                )}
              </p>
            )}
          </div>
        }
        confirmText={mutation.isPending ? t('Processing...') : t('Confirm')}
        destructive={
          operation?.action === 'delete' || operation?.action === 'disable'
        }
        isLoading={mutation.isPending}
        disabled={
          !operation?.users.length ||
          (operation.action === 'group' &&
            (groupsQuery.isError || !groups.includes(operation.group)))
        }
        handleConfirm={() => {
          if (!operation || mutation.isPending) return
          mutation.execute(operation, () => setOperation(null))
        }}
      >
        {operation?.action === 'group' && (
          <div className='space-y-2'>
            <Label htmlFor='bulk-user-group'>{t('Group')}</Label>
            <Combobox
              id='bulk-user-group'
              options={groups.map((group) => ({ label: group, value: group }))}
              value={operation.group}
              onValueChange={(group) =>
                setOperation((previous) =>
                  previous ? { ...previous, group: group ?? '' } : null
                )
              }
              placeholder={
                groupsQuery.isPending ? t('Loading...') : t('Select a group')
              }
              className='w-full'
              disabled={
                mutation.isPending ||
                groupsQuery.isPending ||
                groupsQuery.isError
              }
            />
            {groupsQuery.isError && (
              <p className='text-destructive text-sm' role='alert'>
                {getServerErrorMessage(groupsQuery.error, t('Failed to load'))}
              </p>
            )}
          </div>
        )}
        {mutation.isPending && operation && (
          <p className='text-muted-foreground text-sm' role='status'>
            {t('Processed {{processed}} of {{total}} users', {
              processed: formatNumber(mutation.processed, locale),
              total: formatNumber(operation.users.length, locale),
            })}
          </p>
        )}
      </ConfirmDialog>
    </>
  )
}
