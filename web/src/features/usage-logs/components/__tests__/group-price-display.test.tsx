import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { createInstance } from 'i18next'
import type { ComponentType } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, test, vi } from 'vitest'

import { DynamicPricingBreakdown } from '@/features/pricing/components/dynamic-pricing-breakdown'

import type { UsageLog } from '../../data/schema'
import type { LogOtherData } from '../../types'
import { useCommonLogsColumns } from '../columns/common-logs-columns'
import { BillingBreakdown } from '../dialogs/details-dialog'
import { UsageLogsProvider } from '../usage-logs-provider'

vi.mock('@/lib/lobe-icon', () => ({
  getLobeIcon: () => null,
}))

const i18n = createInstance()
await i18n.init({
  lng: 'en',
  fallbackLng: 'en',
  resources: { en: { translation: {} } },
})

const groupedOther: LogOtherData = {
  model_ratio: 2,
  completion_ratio: 2,
  group_ratio: 3,
}

const groupedLog: UsageLog = {
  id: 1,
  user_id: 1,
  created_at: 100,
  type: 2,
  content: '',
  username: 'alice',
  display_name: 'Alice',
  avatar_url: '',
  token_name: 'group-token',
  model_name: 'group-priced-model',
  quota: 36,
  prompt_tokens: 1_000_000,
  completion_tokens: 1_000_000,
  use_time: 1,
  is_stream: false,
  channel: 1,
  channel_name: 'Group Channel',
  token_id: 1,
  group: 'vip',
  ip: '',
  other: JSON.stringify(groupedOther),
  request_id: '',
  upstream_request_id: '',
  open_id: '',
}

function DetailsColumnCell(props: { log: UsageLog }) {
  const columns = useCommonLogsColumns(false, {
    showUserColumn: false,
    showChannelColumn: false,
  })
  const detailsColumn = columns.find(
    (column) => 'accessorKey' in column && column.accessorKey === 'content'
  )
  if (!detailsColumn || typeof detailsColumn.cell !== 'function') {
    throw new TypeError(
      'Expected the usage log details column to provide a cell'
    )
  }

  const Cell = detailsColumn.cell as ComponentType<{
    row: { original: UsageLog }
  }>
  return <Cell row={{ original: props.log }} />
}

function TokenColumnCell(props: { log: UsageLog }) {
  const columns = useCommonLogsColumns(false, {
    showUserColumn: false,
    showChannelColumn: false,
  })
  const tokenColumn = columns.find(
    (column) => 'accessorKey' in column && column.accessorKey === 'token_name'
  )
  if (!tokenColumn || typeof tokenColumn.cell !== 'function') {
    throw new TypeError('Expected the usage log token column to provide a cell')
  }

  const Cell = tokenColumn.cell as ComponentType<{
    row: { original: UsageLog }
  }>
  return <Cell row={{ original: props.log }} />
}

function renderDetailsColumn(log: UsageLog): string {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return renderToStaticMarkup(
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <DetailsColumnCell log={log} />
      </I18nextProvider>
    </QueryClientProvider>
  )
}

describe('usage log group price display', () => {
  test('shows the token badge with normal font weight', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <UsageLogsProvider>
          <TokenColumnCell log={groupedLog} />
        </UsageLogsProvider>
      </I18nextProvider>
    )

    const tokenBadge = screen
      .getByText('group-token')
      .closest('[data-slot="status-badge"]')
    expect(tokenBadge).toHaveClass('font-normal')
    expect(tokenBadge).not.toHaveClass('font-medium')
  })

  test('shows prices for the actual log group in the details column', () => {
    const html = renderDetailsColumn(groupedLog)

    expect(html).toContain('$12 / $24/M')
    expect(html).not.toContain('$4 / $8/M')
  })

  test('uses the user-exclusive ratio instead of the regular group ratio', () => {
    const other: LogOtherData = {
      ...groupedOther,
      user_group_ratio: 0.5,
    }
    const html = renderDetailsColumn({
      ...groupedLog,
      other: JSON.stringify(other),
    })

    expect(html).toContain('$2 / $4/M')
    expect(html).not.toContain('$12 / $24/M')
  })

  test('applies the actual group ratio to per-call prices', () => {
    const other: LogOtherData = {
      model_price: 2,
      group_ratio: 3,
    }
    const html = renderDetailsColumn({
      ...groupedLog,
      other: JSON.stringify(other),
    })

    expect(html).toContain('Per-call · $6')
    expect(html).not.toContain('Per-call · $2')
  })

  test('applies the actual group ratio to matched dynamic prices', () => {
    const billingExpr = 'tier("base", p * 2 + c * 8)'
    const other: LogOtherData = {
      billing_mode: 'tiered_expr',
      expr_b64: Buffer.from(billingExpr).toString('base64'),
      matched_tier: 'base',
      group_ratio: 3,
    }
    const html = renderDetailsColumn({
      ...groupedLog,
      other: JSON.stringify(other),
    })

    expect(html).toContain('base · $6 / $24/M')
    expect(html).not.toContain('base · $2 / $8/M')
  })

  test('shows prices for the actual log group in the details dialog', () => {
    const html = renderToStaticMarkup(
      <I18nextProvider i18n={i18n}>
        <BillingBreakdown
          log={groupedLog}
          other={groupedOther}
          isAdmin={false}
        />
      </I18nextProvider>
    )

    expect(html).toContain('$12/M')
    expect(html).toContain('$24/M')
    expect(html).not.toContain('$4/M')
    expect(html).not.toContain('$8/M')
  })

  test('shows group-adjusted prices in the dialog dynamic tier table', () => {
    const html = renderToStaticMarkup(
      <I18nextProvider i18n={i18n}>
        <DynamicPricingBreakdown
          compact
          billingExpr='tier("base", p * 2 + c * 8)'
          matchedTierLabel='base'
          priceMultiplier={3}
        />
      </I18nextProvider>
    )

    expect(html).toContain('$6.0000')
    expect(html).toContain('$24.0000')
    expect(html).not.toContain('$2.0000')
    expect(html).not.toContain('$8.0000')
  })
})
