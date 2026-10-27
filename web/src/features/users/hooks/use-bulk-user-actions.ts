import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Table } from '@tanstack/react-table'
import { isAxiosError } from 'axios'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { toIntlLocale } from '@/i18n/languages'
import { formatNumber } from '@/lib/format'
import { handleServerError } from '@/lib/handle-server-error'
import {
  getServerErrorMessage,
  requireServerSuccess,
} from '@/lib/server-error-message'

import { deleteUser, getUser, manageUser, updateUser } from '../api'
import { useUsers } from '../components/users-provider'
import type { User } from '../types'

export type BulkUserAction = 'enable' | 'disable' | 'delete' | 'group'

export interface BulkUserOperation {
  action: BulkUserAction
  users: User[]
  skipped: number
  group: string
}

export function useBulkUserActions(table: Table<User>) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const { requestVerification, triggerRefresh } = useUsers()
  const queryClient = useQueryClient()
  const mounted = useRef(true)
  const running = useRef(false)
  const [processed, setProcessed] = useState(0)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const mutation = useMutation({
    retry: false,
    mutationFn: async (operation: BulkUserOperation) => {
      setProcessed(0)
      const succeeded: number[] = []
      const failures: { user: User; error: unknown }[] = []
      let skipped = operation.skipped
      let completed = 0
      try {
        for (const user of operation.users) {
          if (!mounted.current) break
          try {
            if (operation.action === 'group') {
              const response = requireServerSuccess(await getUser(user.id))
              if (!mounted.current) break
              if (!response.data) throw new Error(t('Failed to load'))
              const current = response.data
              if (current.group === operation.group) {
                skipped++
              } else {
                // UpdateUser replaces these profile fields. Read them freshly,
                // and omit role, password, permissions and quota from this edit.
                requireServerSuccess(
                  await updateUser({
                    id: current.id,
                    username: current.username,
                    display_name: current.display_name,
                    group: operation.group,
                    remark: current.remark,
                    overview_dept_ids: current.overview_dept_ids ?? [],
                    cost_center: current.cost_center ?? '',
                  })
                )
                succeeded.push(user.id)
              }
            } else {
              // Proofs are bound to one user/action and must never be reused.
              const proof = await requestVerification(
                operation.action === 'delete'
                  ? {
                      scope: 'admin.user.delete',
                      context: { user_id: user.id },
                      title: t('Verify to delete user'),
                      description: t(
                        'Confirm your identity before permanently deleting the account {{username}}.',
                        { username: user.username }
                      ),
                    }
                  : {
                      scope: 'admin.user.manage',
                      context: { user_id: user.id, action: operation.action },
                      title:
                        operation.action === 'enable'
                          ? t('Verify to enable user')
                          : t('Verify to disable user'),
                      description: t(
                        'Confirm your identity before changing the account {{username}}.',
                        { username: user.username }
                      ),
                    }
              )
              if (!proof || !mounted.current) break
              requireServerSuccess(
                operation.action === 'delete'
                  ? await deleteUser(user.id, proof.proof_token)
                  : await manageUser(
                      user.id,
                      operation.action,
                      proof.proof_token
                    )
              )
              succeeded.push(user.id)
            }
          } catch (error) {
            failures.push({ user, error })
            // Stop on session, authorization or rate-limit failures.
            if (
              isAxiosError(error) &&
              [401, 403, 429].includes(error.response?.status ?? 0)
            ) {
              completed++
              break
            }
          }
          completed++
          if (mounted.current) setProcessed(completed)
        }
        return {
          succeeded,
          failures,
          skipped,
          remaining: operation.users.length - completed,
        }
      } finally {
        running.current = false
      }
    },
    onSuccess: (result) => {
      if (!mounted.current) {
        void queryClient.invalidateQueries({ queryKey: ['users'] })
        return
      }
      table.setRowSelection((previous) => {
        const next = { ...previous }
        for (const id of result.succeeded) delete next[String(id)]
        return next
      })
      triggerRefresh()
      const message = t(
        'Bulk operation finished: {{succeeded}} succeeded, {{failed}} failed, {{skipped}} skipped, {{remaining}} not processed.',
        {
          succeeded: formatNumber(result.succeeded.length, locale),
          failed: formatNumber(result.failures.length, locale),
          skipped: formatNumber(result.skipped, locale),
          remaining: formatNumber(result.remaining, locale),
        }
      )
      if (result.failures.length > 0) {
        toast.warning(message)
        const first = result.failures[0]
        handleServerError(first.error, t('Failed to update user'), {
          title: t('Operation failed for {{username}}', {
            username: first.user.username,
          }),
          description: getServerErrorMessage(
            first.error,
            t('Failed to update user')
          ),
        })
      } else if (result.remaining > 0 || result.skipped > 0) {
        toast.info(message)
      } else {
        toast.success(message)
      }
    },
    onError: (error) => handleServerError(error),
  })

  const execute = (operation: BulkUserOperation, onSuccess: () => void) => {
    // Lock synchronously, before React renders the pending state.
    if (running.current) return
    running.current = true
    mutation.mutate(operation, { onSuccess })
  }

  return { isPending: mutation.isPending, execute, processed }
}
