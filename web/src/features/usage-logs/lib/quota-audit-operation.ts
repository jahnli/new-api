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
import { formatQuota } from '@/lib/format'

type Translate = (key: string, opts?: Record<string, unknown>) => string

/** Tone of the adjustment marker rendered next to the changed numbers. */
export type QuotaOutcomeTone = 'success' | 'danger' | 'neutral'

const QUOTA_OPERATIONS: Record<
  string,
  { label: string; named: string; verb: string; tone: QuotaOutcomeTone }
> = {
  'user.quota_add': {
    label: 'Increase user quota',
    named: 'Increase quota for user “{{name}}”',
    verb: 'Increase quota',
    tone: 'success',
  },
  'user.quota_subtract': {
    label: 'Decrease user quota',
    named: 'Decrease quota for user “{{name}}”',
    verb: 'Decrease quota',
    tone: 'danger',
  },
  'user.quota_override': {
    label: 'Override user quota',
    named: 'Override quota for user “{{name}}”',
    verb: 'Override quota',
    tone: 'neutral',
  },
  'subscription.quota_increase': {
    label: 'Increase subscription quota',
    named: 'Increase subscription quota for user “{{name}}”',
    verb: 'Increase quota',
    tone: 'success',
  },
  'subscription.quota_decrease': {
    label: 'Decrease subscription quota',
    named: 'Decrease subscription quota for user “{{name}}”',
    verb: 'Decrease quota',
    tone: 'danger',
  },
}

function quotaText(value: unknown, t: Translate): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return formatQuota(value)
  }
  if (typeof value === 'string' && value.trim()) return value
  return t('Not recorded')
}

export function buildQuotaAuditOperation(
  action: string,
  params: Record<string, unknown>,
  success: boolean,
  t: Translate
) {
  const unknownMode = action === 'generic' && params.action === 'add_quota'
  const operation = unknownMode
    ? {
        label: 'Adjust user quota',
        named: 'Adjust quota for user “{{name}}”',
        verb: 'Adjust user quota',
        tone: 'neutral' as QuotaOutcomeTone,
      }
    : QUOTA_OPERATIONS[action]
  if (!operation) return null
  const name =
    typeof params.target_username === 'string'
      ? params.target_username.trim()
      : ''
  let id = ''
  if (
    typeof params.target_user_id === 'number' &&
    Number.isFinite(params.target_user_id)
  ) {
    id = String(params.target_user_id)
  } else if (typeof params.target_user_id === 'string') {
    id = params.target_user_id.trim()
  }
  let headline = name ? t(operation.named, { name }) : t(operation.label)
  if (!name && !id) headline = `${headline} · ${t('Target not recorded')}`
  const identifier = id ? t('(ID: {{id}})', { id }) : ''
  const summary = id
    ? t('{{operation}} (ID: {{id}})', { operation: headline, id })
    : headline
  let requested = params.requested_quota ?? params.quota
  if (requested === undefined && success && action === 'user.quota_override') {
    requested = params.to
  }
  const amount = quotaText(requested, t)
  const fields: { label: string; value: string; copyable?: boolean }[] = [
    { label: t('Target username'), value: name || t('Not recorded') },
    { label: t('User ID'), value: id || t('Not recorded'), copyable: !!id },
    {
      label: t('Adjustment mode'),
      value: unknownMode
        ? String(params.mode || t('Not recorded'))
        : t(operation.label),
    },
    { label: t('Requested quota'), value: amount },
  ]
  // Subscription quota adjustments carry the subscription context, which the
  // quota fields above do not cover.
  if (params.subscription_id !== undefined) {
    fields.push({
      label: t('Subscription ID'),
      value: String(params.subscription_id),
      copyable: true,
    })
  }
  if (params.plan_id !== undefined) {
    fields.push({ label: t('Plan ID'), value: String(params.plan_id) })
  }
  if (params.amount !== undefined) {
    fields.push({ label: t('Amount (CNY)'), value: String(params.amount) })
  }
  let suffix = ''
  let balances: { before: string; after: string } | null = null
  if (success) {
    const before = quotaText(params.from, t)
    const after = quotaText(params.to, t)
    balances = { before, after }
    const unchanged =
      params.from !== undefined &&
      params.from !== null &&
      params.from !== '' &&
      params.from === params.to &&
      (typeof params.from === 'string' || typeof params.from === 'number')
    let change = `${before} → ${after}`
    if (unchanged) change = `${t('Quota unchanged')} · ${change}`
    suffix = change
    fields.push(
      { label: t('Quota before adjustment'), value: before },
      { label: t('Quota after adjustment'), value: after }
    )
  } else {
    const reasons: Record<string, string> = {
      invalid_parameters: t('Invalid adjustment parameters'),
      permission_denied: t('Insufficient permission to adjust this user'),
      target_not_found: t('Target user not found'),
      quota_limit_exceeded: t('Wallet quota limit exceeded'),
      database_error: t('Quota update failed'),
    }
    const reason =
      typeof params.failure_reason === 'string'
        ? reasons[params.failure_reason]
        : undefined
    suffix = reason ?? ''
    fields.push({
      label: t('Failure reason'),
      value: reason || t('Not recorded'),
    })
  }
  // Only add a direction to valid successful adjustments. Overrides are target
  // balances, and failed requests must not appear to be committed changes.
  let signedAmount = amount
  if (
    success &&
    typeof requested === 'number' &&
    requested > 0 &&
    Number.isFinite(requested)
  ) {
    if (operation.tone === 'success') signedAmount = `+${amount}`
    if (operation.tone === 'danger') signedAmount = `−${amount}`
  }
  const detail = suffix ? `${amount} · ${suffix}` : amount
  return {
    headline,
    summary,
    identifier,
    outcome: { label: t(operation.verb), variant: operation.tone },
    signedAmount,
    balances,
    suffix,
    detail,
    description: t('{{action}}: {{quota}}', {
      action: t(operation.verb),
      quota: detail,
    }),
    fields,
  }
}
