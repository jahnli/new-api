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
import { render, screen } from '@testing-library/react'
import i18next from 'i18next'
import type React from 'react'
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from 'vitest'

import { formatLogQuota } from '@/lib/format'
import { useAuthStore } from '@/stores/auth-store'
import { useSystemConfigStore } from '@/stores/system-config-store'

import { LogCostDisplay } from '../log-cost-display'

function renderCost(
  props: React.ComponentProps<typeof LogCostDisplay>
): ReturnType<typeof render> {
  return render(<LogCostDisplay {...props} />)
}

describe('log cost display', () => {
  beforeAll(() => {
    i18next.addResourceBundle('en', 'translation', {
      Subscription: 'Subscription',
      Wallet: 'Wallet',
      'Includes tool-call surcharge': 'Includes tool-call surcharge',
    })
  })

  beforeEach(() => {
    useSystemConfigStore.setState(useSystemConfigStore.getInitialState(), true)
  })

  afterEach(() => {
    useAuthStore.getState().auth.reset()
    useSystemConfigStore.setState(useSystemConfigStore.getInitialState(), true)
    localStorage.clear()
  })

  test.each([
    { consumed: 12500, expected: '$0.025' },
    { consumed: 0, expected: '$0' },
    { consumed: 1, expected: '$0.000002' },
    { consumed: undefined, expected: '$0.01' },
  ])(
    'shows subscription deduction $consumed without hover, falling back only when absent',
    ({ consumed, expected }) => {
      const rendered = renderCost({
        quota: 5000,
        other: {
          billing_source: 'subscription',
          subscription_consumed: consumed,
        },
      })

      expect(
        rendered.container.querySelector('.tabular-nums')
      ).toHaveTextContent(expected)
      expect(screen.getByText('Subscription')).toBeVisible()
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    }
  )

  test('shows wallet cost and source without using subscription metadata', () => {
    const rendered = renderCost({
      quota: 5000,
      other: { billing_source: 'wallet', subscription_consumed: 12500 },
      showWalletSource: true,
    })

    expect(rendered.container.querySelector('.tabular-nums')).toHaveTextContent(
      '$0.01'
    )
    expect(screen.getByText('Wallet')).toBeVisible()
    expect(screen.queryByText('Subscription')).not.toBeInTheDocument()
  })

  test('hides the wallet label when subscriptions are unavailable', () => {
    const rendered = renderCost({
      quota: 5000,
      other: { billing_source: 'wallet' },
      showWalletSource: false,
    })

    expect(rendered.container.querySelector('.tabular-nums')).toHaveTextContent(
      '$0.01'
    )
    expect(screen.queryByText('Wallet')).not.toBeInTheDocument()
  })

  test('keeps legacy cost visible without inventing a funding source', () => {
    const rendered = renderCost({ quota: 5000, other: null })

    expect(rendered.container.querySelector('.tabular-nums')).toHaveTextContent(
      '$0.01'
    )
    expect(screen.queryByText('Wallet')).not.toBeInTheDocument()
    expect(screen.queryByText('Subscription')).not.toBeInTheDocument()
  })

  test('keeps a large amount unabridged above the funding source', () => {
    const rendered = renderCost({
      quota: 2147483647,
      other: { billing_source: 'subscription' },
    })

    const amount = rendered.container.querySelector('.tabular-nums')
    expect(amount).toBeVisible()
    expect(amount).toHaveTextContent('$4,294.9673')
    expect(rendered.container.firstElementChild).toHaveClass('flex-col')
    if (!amount) throw new Error('Expected a visible cost amount')
    expect(
      amount.compareDocumentPosition(screen.getByText('Subscription')) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).not.toBe(0)
  })

  test('keeps the regular cost visible and adds an accessible surcharge marker', () => {
    const rendered = renderCost({
      quota: 12500,
      other: {
        tool_surcharges: [{ name: 'lookup_customer', count: 1, price: 5 }],
      },
    })

    expect(rendered.container.querySelector('.tabular-nums')).toHaveTextContent(
      '$0.025'
    )
    const marker = screen.getByRole('img', {
      name: 'Includes tool-call surcharge',
    })
    expect(marker).toHaveAttribute('data-tool-surcharge-indicator', 'true')
    expect(marker).toHaveAttribute('tabindex', '0')
  })

  test('shows subscription cost and source alongside the legacy surcharge marker', () => {
    const rendered = renderCost({
      quota: 5000,
      other: {
        billing_source: 'subscription',
        web_search: true,
        web_search_call_count: 1,
        web_search_price: 10,
      },
    })

    expect(rendered.container.querySelector('.tabular-nums')).toHaveTextContent(
      '$0.01'
    )
    expect(screen.getByText('Subscription')).toBeVisible()
    expect(
      screen.getByRole('img', { name: 'Includes tool-call surcharge' })
    ).toHaveAttribute('data-tool-surcharge-indicator', 'true')
  })

  test('masks the amount when demo mode is enabled', () => {
    useAuthStore.getState().auth.setUser({
      id: 1,
      username: 'demo-user',
      role: 1,
      setting: { demo_mode: true },
    })

    const rendered = renderCost({
      quota: 12500,
      other: null,
    })

    const currencyPrefix = formatLogQuota(12500).match(/^([^0-9+\-.,\s]+)/)?.[1]
    expect(rendered.container.textContent).toContain('*')
    expect(currencyPrefix).toBeTruthy()
    expect(rendered.container.textContent).toContain(currencyPrefix)
    expect(rendered.container.textContent).not.toContain(formatLogQuota(12500))
  })

  test('masks subscription amounts when demo mode is enabled', () => {
    useAuthStore.getState().auth.setUser({
      id: 1,
      username: 'demo-user',
      role: 1,
      setting: { demo_mode: true },
    })

    const rendered = renderCost({
      quota: 5000,
      other: { billing_source: 'subscription' },
    })

    expect(rendered.container.textContent).toContain('*')
    expect(rendered.container.textContent).not.toContain(formatLogQuota(5000))
  })
})
