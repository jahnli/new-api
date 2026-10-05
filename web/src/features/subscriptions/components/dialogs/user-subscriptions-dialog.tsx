import { useQueryClient } from '@tanstack/react-query'
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
import { Ban, Minus, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import {
  DataTableRowActionMenu,
  StaticDataTable,
} from '@/components/data-table'
import { Dialog } from '@/components/dialog'
import { StatusBadge } from '@/components/status-badge'
import { TableId } from '@/components/table-id'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Combobox } from '@/components/ui/combobox'
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
} from '@/components/ui/dropdown-menu'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { LogUserIdentity } from '@/features/usage-logs/components/log-user-identity'
import { toIntlLocale } from '@/i18n/languages'
import { formatNumber, formatQuota } from '@/lib/format'
import { handleServerError } from '@/lib/handle-server-error'

import {
  getAdminPlans,
  getUserSubscriptions,
  createUserSubscription,
  decreaseUserSubscriptionQuota,
  increaseUserSubscriptionQuota,
  invalidateUserSubscription,
  deleteUserSubscription,
  resetUserSubscriptionsByPlan,
} from '../../api'
import { formatTimestamp } from '../../lib'
import type {
  PlanRecord,
  SubscriptionQuotaType,
  UserSubscriptionRecord,
} from '../../types'
import { SubscriptionQuotaAdjustmentPreview } from '../subscription-quota-adjustment-preview'
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
import { UserPremiumPolicy } from '../user-premium-policy'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: {
    id: number
    username?: string
    display_name?: string
    avatar_url?: string
    open_id?: string
    gender?: number
  } | null
  onSuccess?: () => void
}

function SubscriptionStatusBadge(props: {
  sub: UserSubscriptionRecord['subscription']
  t: (key: string) => string
}) {
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now() / 1000
  const isExpired = (props.sub.end_time || 0) > 0 && props.sub.end_time < now
  const isActive = props.sub.status === 'active' && !isExpired
  if (isActive) {
    return (
      <StatusBadge
        label={props.t('Active')}
        variant='success'
        copyable={false}
      />
    )
  }
  if (props.sub.status === 'cancelled') {
    return (
      <StatusBadge
        label={props.t('Invalidated')}
        variant='neutral'
        copyable={false}
      />
    )
  }
  return (
    <StatusBadge
      label={props.t('Expired')}
      variant='neutral'
      copyable={false}
    />
  )
}

export function UserSubscriptionsDialog(props: Props) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const queryClient = useQueryClient()
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [plans, setPlans] = useState<PlanRecord[]>([])
  const [subs, setSubs] = useState<UserSubscriptionRecord[]>([])
  const [selectedPlanId, setSelectedPlanId] = useState<string>('')
  const [quotaAdjustmentAmount, setQuotaAdjustmentAmount] = useState('')
  const [quotaType, setQuotaType] = useState<SubscriptionQuotaType>('total')
  const [confirming, setConfirming] = useState(false)
  const confirmInFlightRef = useRef(false)
  const [resetting, setResetting] = useState(false)
  const [advanceResetTime, setAdvanceResetTime] = useState(true)
  const [resetAction, setResetAction] = useState<{
    planId: number
    planTitle: string
  } | null>(null)
  const [confirmAction, setConfirmAction] = useState<{
    type: 'increase' | 'decrease' | 'invalidate' | 'delete'
    subId: number
  } | null>(null)

  const quotaTypeItems = [
    { value: 'total' as const, label: t('Total Quota') },
    { value: 'basic' as const, label: t('Standard model quota') },
    { value: 'premium' as const, label: t('Premium model quota') },
  ]
  const selectedSubscription = subs.find(
    (record) => record.subscription.id === confirmAction?.subId
  )
  const targetedQuotaEnabled =
    selectedSubscription?.premium_quota?.enabled &&
    selectedSubscription.subscription.amount_total > 0

  const planTitleMap = useMemo(() => {
    const map = new Map<number, string>()
    plans.forEach((p) => {
      if (p.plan.id) map.set(p.plan.id, p.plan.title || `#${p.plan.id}`)
    })
    return map
  }, [plans])

  const formatPlanQuota = useCallback(
    (plan: PlanRecord['plan']) => {
      const quota = Number(plan.total_amount || 0)
      return quota > 0 ? formatQuota(quota) : t('Unlimited')
    },
    [t]
  )

  const loadData = useCallback(async () => {
    if (!props.user?.id) return
    setLoading(true)
    try {
      const [plansRes, subsRes] = await Promise.all([
        getAdminPlans(),
        getUserSubscriptions(props.user.id),
      ])
      if (plansRes.success) {
        setPlans(plansRes.data || [])
      } else {
        handleServerError(plansRes)
      }
      if (subsRes.success) {
        setSubs(subsRes.data || [])
      } else {
        handleServerError(subsRes)
      }
    } catch (error) {
      handleServerError(error, t('Loading failed'))
    } finally {
      setLoading(false)
    }
  }, [props.user?.id, t])

  useEffect(() => {
    if (props.open && props.user?.id) {
      setSelectedPlanId('')
      loadData()
    }
  }, [props.open, props.user?.id, loadData])

  const handleCreate = async () => {
    if (!props.user?.id || !selectedPlanId) {
      toast.error(t('Please select a subscription plan'))
      return
    }
    setCreating(true)
    try {
      const res = await createUserSubscription(props.user.id, {
        plan_id: Number(selectedPlanId),
      })
      if (res.success) {
        toast.success(res.data?.message || t('Added successfully'))
        setSelectedPlanId('')
        await loadData()
        props.onSuccess?.()
      } else {
        handleServerError(res)
      }
    } catch (error) {
      handleServerError(error, t('Request failed'))
    } finally {
      setCreating(false)
    }
  }

  const handleConfirmAction = async () => {
    if (!confirmAction || confirmInFlightRef.current) return
    const isQuotaAdjustment =
      confirmAction.type === 'increase' || confirmAction.type === 'decrease'
    const adjustmentAmount = Number(quotaAdjustmentAmount)
    if (
      isQuotaAdjustment &&
      (!Number.isFinite(adjustmentAmount) || adjustmentAmount <= 0)
    ) {
      toast.error(t('Please enter a valid amount'))
      return
    }

    confirmInFlightRef.current = true
    setConfirming(true)
    try {
      if (isQuotaAdjustment) {
        let res
        if (confirmAction.type === 'increase') {
          res = await increaseUserSubscriptionQuota(
            confirmAction.subId,
            adjustmentAmount,
            quotaType
          )
        } else {
          res = await decreaseUserSubscriptionQuota(
            confirmAction.subId,
            adjustmentAmount,
            quotaType
          )
        }
        if (res.success) {
          let successMessage = t('Quota increased successfully')
          if (confirmAction.type === 'decrease') {
            successMessage = t('Quota decreased successfully')
          }
          toast.success(successMessage)
          await Promise.all([
            loadData(),
            queryClient.invalidateQueries({
              queryKey: ['subscription-premium', 'user', props.user?.id],
            }),
          ])
          props.onSuccess?.()
        }
      } else if (confirmAction.type === 'invalidate') {
        const res = await invalidateUserSubscription(confirmAction.subId)
        if (res.success) {
          toast.success(res.data?.message || t('Has been invalidated'))
          await loadData()
          props.onSuccess?.()
        } else {
          handleServerError(res)
        }
      } else {
        const res = await deleteUserSubscription(confirmAction.subId)
        if (res.success) {
          toast.success(t('Deleted'))
          await loadData()
          props.onSuccess?.()
        } else {
          handleServerError(res)
        }
      }
    } catch (error) {
      handleServerError(error, t('Operation failed'))
    } finally {
      confirmInFlightRef.current = false
      setConfirming(false)
      setConfirmAction(null)
    }
  }

  let confirmTitle = ''
  let confirmDesc = ''
  let confirmText = t('Confirm')
  if (confirmAction?.type === 'increase') {
    confirmTitle = t('Increase quota')
    confirmDesc = t('Enter the CNY amount to add to this subscription.')
    confirmText = t('Increase')
  } else if (confirmAction?.type === 'decrease') {
    confirmTitle = t('Decrease quota')
    confirmDesc = t(
      'Enter the CNY amount to deduct. The total quota cannot be lower than the used quota.'
    )
    confirmText = t('Decrease')
  } else if (confirmAction?.type === 'invalidate') {
    confirmTitle = t('Confirm invalidate')
    confirmDesc = t(
      'After invalidating, this subscription will be immediately deactivated. Historical records are not affected. Continue?'
    )
  } else if (confirmAction?.type === 'delete') {
    confirmTitle = t('Confirm delete')
    confirmDesc = t(
      'Deleting will permanently remove this subscription record (including benefit details). Continue?'
    )
  }

  const handleResetConfirm = async () => {
    if (!props.user?.id || !resetAction) return
    setResetting(true)
    try {
      const res = await resetUserSubscriptionsByPlan(props.user.id, {
        plan_id: resetAction.planId,
        advance_reset_time: advanceResetTime,
      })
      if (res.success) {
        toast.success(
          t('Reset {{count}} active subscriptions', {
            count: res.data?.reset_count || 0,
          })
        )
        await loadData()
        props.onSuccess?.()
      } else {
        handleServerError(res)
      }
    } catch (error) {
      handleServerError(error, t('Operation failed'))
    } finally {
      setResetting(false)
      setResetAction(null)
    }
  }

  return (
    <>
      <Dialog
        open={props.open}
        onOpenChange={props.onOpenChange}
        title={t('User Subscription Management')}
        headerLeading={
          props.user ? (
            <LogUserIdentity
              className='flex-none'
              nameClassName='min-w-0'
              userId={props.user.id}
              username={props.user.username}
              displayName={props.user.display_name}
              avatarUrl={props.user.avatar_url}
              openId={props.user.open_id}
              gender={props.user.gender}
            />
          ) : null
        }
        contentClassName='gap-0 overflow-hidden p-0 sm:h-[84dvh] sm:max-w-5xl sm:p-0'
        headerClassName='flex-row flex-wrap items-center gap-3 border-b px-5 py-5 pe-12 sm:px-6 sm:pe-12'
        titleClassName='text-lg'
        bodyContainerClassName='mx-0 flex-1'
        bodyClassName='bg-muted/30 flex min-h-full flex-col gap-5 p-4 sm:h-full sm:px-6 [&>form]:shrink-0'
      >
        {props.open && props.user ? (
          <UserPremiumPolicy
            userId={props.user.id}
            subscriptions={subs}
            planTitleMap={planTitleMap}
            onSaved={() => {
              void loadData()
              props.onSuccess?.()
            }}
          />
        ) : null}
        <section className='bg-background flex flex-1 flex-col overflow-hidden rounded-xl border sm:min-h-64'>
          <div className='shrink-0 space-y-4 border-b p-5'>
            <h3 className='text-sm font-semibold'>{t('Subscriptions')}</h3>
            <div className='flex flex-col gap-3 sm:flex-row sm:items-center'>
              <Combobox
                options={plans.map((planRecord) => ({
                  value: String(planRecord.plan.id),
                  label: planRecord.plan.title,
                  suffix: (
                    <Badge variant='secondary'>
                      {formatPlanQuota(planRecord.plan)}
                    </Badge>
                  ),
                }))}
                value={selectedPlanId}
                onValueChange={(value) =>
                  value !== null && setSelectedPlanId(value)
                }
                className='w-full min-w-0 sm:flex-1'
                itemClassName='pl-8'
                showSelectedContent
                placeholder={t('Select subscription plan')}
                aria-label={t('Select subscription plan')}
                openOnFocus={false}
              />
              <Button
                className='shrink-0'
                onClick={handleCreate}
                disabled={creating || !selectedPlanId}
              >
                <Plus className='size-4' aria-hidden='true' />
                {t('Add subscription')}
              </Button>
            </div>
          </div>

          <StaticDataTable
            className='min-h-0 flex-1 overflow-auto rounded-none border-0'
            tableProps={{ withContainer: false }}
            tableClassName='[&_td]:px-5 [&_td]:py-4 [&_th]:px-5 [&_th]:py-3'
            headerRowClassName='bg-muted/40 hover:bg-muted/40'
            data={loading ? [] : subs}
            getRowKey={(record) => record.subscription.id}
            emptyClassName={loading ? 'py-8' : 'text-muted-foreground py-8'}
            emptyContent={
              loading ? t('Loading...') : t('No subscription records')
            }
            columns={[
              {
                id: 'id',
                header: t('ID'),
                cell: (record) => <TableId value={record.subscription.id} />,
              },
              {
                id: 'plan',
                header: t('Plan'),
                cell: (record) => {
                  const sub = record.subscription

                  return (
                    <div className='space-y-1'>
                      <div className='font-medium'>
                        {planTitleMap.get(sub.plan_id) || `#${sub.plan_id}`}
                      </div>
                      <div className='text-muted-foreground text-xs'>
                        {t('Source')}: {sub.source || '-'}
                      </div>
                    </div>
                  )
                },
              },
              {
                id: 'status',
                header: t('Status'),
                cell: (record) => (
                  <SubscriptionStatusBadge sub={record.subscription} t={t} />
                ),
              },
              {
                id: 'validity',
                header: t('Validity'),
                cell: (record) => {
                  const sub = record.subscription

                  return (
                    <div className='space-y-1.5 text-xs tabular-nums'>
                      <div className='flex items-baseline gap-3'>
                        <span className='text-muted-foreground'>
                          {t('Start')}
                        </span>
                        <span>{formatTimestamp(sub.start_time)}</span>
                      </div>
                      <div className='flex items-baseline gap-3'>
                        <span className='text-muted-foreground'>
                          {t('End')}
                        </span>
                        <span>{formatTimestamp(sub.end_time)}</span>
                      </div>
                    </div>
                  )
                },
              },
              {
                id: 'quota',
                header: t('Total Quota'),
                cell: (record) => {
                  const sub = record.subscription
                  const total = Number(sub.amount_total || 0)
                  const used = Number(sub.amount_used || 0)
                  if (total <= 0) return t('Unlimited')
                  return (
                    <div className='min-w-28 space-y-2'>
                      <div className='flex items-baseline gap-1 text-xs tabular-nums'>
                        <span className='font-semibold'>
                          {formatQuota(used)}
                        </span>
                        <span className='text-muted-foreground'>
                          / {formatQuota(total)}
                        </span>
                      </div>
                      <Progress
                        value={Math.min(100, Math.max(0, (used / total) * 100))}
                        aria-label={t('Total Quota')}
                      />
                    </div>
                  )
                },
              },
              {
                id: 'actions',
                header: t('Actions'),
                className: 'text-right',
                cellClassName: 'text-right',
                cell: (record) => {
                  const sub = record.subscription
                  const now = Date.now() / 1000
                  const isExpired =
                    (sub.end_time || 0) > 0 && sub.end_time < now
                  const isActive = sub.status === 'active' && !isExpired

                  return (
                    <div className='flex items-center justify-end gap-2'>
                      <Button
                        variant='outline'
                        size='sm'
                        disabled={!isActive}
                        onClick={() => {
                          setQuotaAdjustmentAmount('')
                          setQuotaType('total')
                          setConfirmAction({
                            type: 'increase',
                            subId: sub.id,
                          })
                        }}
                      >
                        <Plus className='size-4' aria-hidden='true' />
                        {t('Increase')}
                      </Button>
                      <Button
                        variant='ghost'
                        size='sm'
                        disabled={!isActive || sub.amount_total <= 0}
                        onClick={() => {
                          setQuotaAdjustmentAmount('')
                          setQuotaType('total')
                          setConfirmAction({
                            type: 'decrease',
                            subId: sub.id,
                          })
                        }}
                      >
                        <Minus className='size-4' aria-hidden='true' />
                        {t('Decrease')}
                      </Button>
                      <DataTableRowActionMenu ariaLabel={t('Actions')}>
                        <DropdownMenuItem
                          disabled={!isActive}
                          onClick={() => {
                            setAdvanceResetTime(true)
                            setResetAction({
                              planId: sub.plan_id,
                              planTitle:
                                planTitleMap.get(sub.plan_id) ||
                                `#${sub.plan_id}`,
                            })
                          }}
                        >
                          {t('Reset quota')}
                          <DropdownMenuShortcut>
                            <RotateCcw size={16} />
                          </DropdownMenuShortcut>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={!isActive}
                          onClick={() =>
                            setConfirmAction({
                              type: 'invalidate',
                              subId: sub.id,
                            })
                          }
                        >
                          {t('Invalidate')}
                          <DropdownMenuShortcut>
                            <Ban size={16} />
                          </DropdownMenuShortcut>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant='destructive'
                          onClick={() =>
                            setConfirmAction({
                              type: 'delete',
                              subId: sub.id,
                            })
                          }
                        >
                          {t('Delete')}
                          <DropdownMenuShortcut>
                            <Trash2 size={16} />
                          </DropdownMenuShortcut>
                        </DropdownMenuItem>
                      </DataTableRowActionMenu>
                    </div>
                  )
                },
              },
            ]}
          />
        </section>
      </Dialog>

      {confirmAction && (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open && !confirmInFlightRef.current) {
              setConfirmAction(null)
            }
          }}
          title={confirmTitle}
          closeOnOutsideClick={
            confirmAction.type === 'increase' ||
            confirmAction.type === 'decrease'
          }
          className={
            confirmAction.type === 'increase' ||
            confirmAction.type === 'decrease'
              ? 'min-h-[min(32rem,calc(100dvh-2rem))] grid-rows-[auto_1fr_auto] gap-6 data-[size=default]:max-w-[calc(100vw-2rem)] data-[size=default]:sm:max-w-2xl'
              : undefined
          }
          desc={confirmDesc}
          handleConfirm={handleConfirmAction}
          destructive={confirmAction.type === 'delete'}
          confirmText={confirmText}
          isLoading={confirming}
          disabled={
            (confirmAction.type === 'increase' ||
              confirmAction.type === 'decrease') &&
            (!Number.isFinite(Number(quotaAdjustmentAmount)) ||
              Number(quotaAdjustmentAmount) <= 0)
          }
        >
          {confirmAction.type === 'increase' ||
          confirmAction.type === 'decrease' ? (
            <FieldGroup className='gap-6 self-start'>
              <div className='bg-muted/50 space-y-2 rounded-lg border p-4'>
                <div className='font-medium'>
                  {selectedSubscription &&
                    (planTitleMap.get(
                      selectedSubscription.subscription.plan_id
                    ) ||
                      `#${selectedSubscription.subscription.plan_id}`)}
                </div>
                <div className='flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-sm'>
                  <div className='flex items-center gap-3'>
                    <span className='text-muted-foreground'>
                      {t('Current quota')}
                    </span>
                    <span className='font-semibold tabular-nums'>
                      {(selectedSubscription?.subscription.amount_total || 0) >
                      0
                        ? formatQuota(
                            selectedSubscription?.subscription.amount_total || 0
                          )
                        : t('Unlimited')}
                    </span>
                  </div>
                  {selectedSubscription?.premium_quota?.enabled && (
                    <div className='flex flex-wrap items-center gap-3'>
                      <span className='text-muted-foreground'>
                        {t('Premium percentage')}
                      </span>
                      <div className='flex items-center gap-2'>
                        <Badge variant='secondary'>
                          {selectedSubscription.premium_quota.percent_source ===
                          'user'
                            ? t('User override')
                            : t('System default')}
                        </Badge>
                        <span className='font-semibold tabular-nums'>
                          {formatNumber(
                            selectedSubscription.premium_quota
                              .effective_percent,
                            locale
                          )}
                          %
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div
                className={
                  targetedQuotaEnabled
                    ? 'grid gap-4 sm:grid-cols-2'
                    : 'grid gap-4'
                }
              >
                {targetedQuotaEnabled ? (
                  <Field>
                    <FieldLabel htmlFor='subscription-quota-type'>
                      {t('Quota type')}
                    </FieldLabel>
                    <Select
                      items={quotaTypeItems}
                      value={quotaType}
                      onValueChange={(value) =>
                        value !== null && setQuotaType(value)
                      }
                      disabled={confirming}
                    >
                      <SelectTrigger
                        id='subscription-quota-type'
                        className='w-full'
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent alignItemWithTrigger={false}>
                        {quotaTypeItems.map((item) => (
                          <SelectItem
                            key={item.value}
                            value={item.value}
                            disabled={
                              item.value !== 'total' && !targetedQuotaEnabled
                            }
                          >
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                ) : null}
                <Field>
                  <FieldLabel htmlFor='subscription-quota-adjustment-amount'>
                    {t('Amount (CNY)')}
                  </FieldLabel>
                  <Input
                    id='subscription-quota-adjustment-amount'
                    type='number'
                    autoFocus
                    min='0'
                    step='1'
                    value={quotaAdjustmentAmount}
                    disabled={confirming}
                    onChange={(event) =>
                      setQuotaAdjustmentAmount(event.target.value)
                    }
                  />
                </Field>
              </div>
              {selectedSubscription && (
                <SubscriptionQuotaAdjustmentPreview
                  record={selectedSubscription}
                  amount={quotaAdjustmentAmount}
                  quotaType={quotaType}
                  decrease={confirmAction.type === 'decrease'}
                />
              )}
            </FieldGroup>
          ) : null}
        </ConfirmDialog>
      )}

      {resetAction && (
        <ConfirmDialog
          open
          onOpenChange={(v) => !v && setResetAction(null)}
          title={t('Reset subscription quota')}
          desc={t('Reset active {{plan}} subscriptions for this user?', {
            plan: resetAction.planTitle,
          })}
          confirmText={t('Reset quota')}
          handleConfirm={handleResetConfirm}
          isLoading={resetting}
        >
          <label className='flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm'>
            <span>{t('Advance next reset time')}</span>
            <Switch
              checked={advanceResetTime}
              onCheckedChange={(checked) => setAdvanceResetTime(!!checked)}
              aria-label={t('Advance next reset time')}
            />
          </label>
        </ConfirmDialog>
      )}
    </>
  )
}
