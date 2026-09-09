import { render, renderHook } from '@testing-library/react'
import { createInstance } from 'i18next'
import type { ReactElement, ReactNode } from 'react'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import { assert, describe, expect, test, vi } from 'vitest'

import type { UserColumnRow } from '../../types'
import {
  userActivityTimeColumn,
  useSharedUserColumns,
} from '../shared-user-columns'

vi.mock('@/hooks/use-demo-mode', () => ({
  useDemoMode: () => false,
}))

vi.mock('@/hooks/use-external-mode', () => ({
  useExternalMode: () => false,
}))

vi.mock('@/lib/lobe-icon', () => ({
  getLobeIcon: () => null,
}))

const user: UserColumnRow = {
  id: 42,
  username: 'alice',
  display_name: 'Alice',
  quota: 0,
  used_quota: 0,
  sub_quota_used: 0,
  sub_quota_total: 0,
  request_count: 0,
  group: 'default',
  status: 1,
  role: 1,
  created_at: 1_700_000_000,
  last_login_at: 1_700_003_600,
}

const i18n = createInstance()
await i18n.use(initReactI18next).init({
  lng: 'en',
  resources: {
    en: {
      translation: {
        Created: 'Created',
        'Just now': 'Just now',
      },
    },
  },
})

function I18nWrapper(props: { children: ReactNode }) {
  return <I18nextProvider i18n={i18n}>{props.children}</I18nextProvider>
}

describe('user activity time column', () => {
  test('shows created and last-login timestamps together like upstream', () => {
    const column = userActivityTimeColumn<UserColumnRow>((key) => key)
    expect(column).toMatchObject({
      accessorKey: 'created_at',
      header: 'Time',
      size: 260,
      minSize: 240,
    })

    const cell = column.cell
    assert.equal(typeof cell, 'function')
    if (typeof cell !== 'function') {
      throw new TypeError('Expected the activity time column to provide a cell')
    }

    const element = cell({ row: { original: user } } as never)
    const { container, getByText } = render(
      <I18nextProvider i18n={i18n}>{element as ReactElement}</I18nextProvider>
    )

    expect(getByText('Created')).toBeInTheDocument()
    expect(getByText('Last Login')).toBeInTheDocument()
    const timestamps = container.querySelectorAll('time')
    expect(timestamps).toHaveLength(2)
    expect(timestamps[0]).toHaveAttribute(
      'datetime',
      '2023-11-14T22:13:20.000Z'
    )
    expect(timestamps[1]).toHaveAttribute(
      'datetime',
      '2023-11-14T23:13:20.000Z'
    )
  })

  test('places the combined time column before the common model column', () => {
    const { result } = renderHook(
      () =>
        useSharedUserColumns<UserColumnRow>({
          costAccessor: 'monthly_total_amount_cny',
          tokensAccessor: 'monthly_total_tokens',
          requestsAccessor: 'monthly_total_requests',
          modelAccessor: 'monthly_common_model',
          requestCountAccessor: 'monthly_total_requests',
          combineActivityTimes: true,
        }),
      { wrapper: I18nWrapper }
    )
    const columnIds = result.current.map(
      (column) => column.id ?? (column as { accessorKey?: string }).accessorKey
    )

    expect(columnIds.indexOf('created_at')).toBeLessThan(
      columnIds.indexOf('monthly_common_model')
    )
  })
})
