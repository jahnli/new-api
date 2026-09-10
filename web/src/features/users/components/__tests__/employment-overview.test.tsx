import { render, renderHook, screen } from '@testing-library/react'
import { createInstance } from 'i18next'
import type { ReactElement, ReactNode } from 'react'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import { assert, describe, expect, test, vi } from 'vitest'

import { TooltipProvider } from '@/components/ui/tooltip'

import { CUSTOM_FIELD_KEYS, type UserColumnRow } from '../../types'
import {
  userEmploymentOverviewColumn,
  userModelColumn,
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

const i18n = createInstance()
await i18n.use(initReactI18next).init({
  lng: 'en',
  resources: {
    en: {
      translation: {
        Department: 'Department',
        'Employment Overview': 'Employment Overview',
        'Job Level': 'Job Level',
        'Join Date': 'Join Date',
      },
    },
  },
})

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
  department_name: 'Headquarters/Engineering/AI Platform',
  custom_field_values: JSON.stringify({
    [CUSTOM_FIELD_KEYS.JOB_LEVEL]: 'P6',
  }),
  join_date: '2024-03-18',
}

function TestWrapper(props: { children: ReactNode }) {
  return (
    <I18nextProvider i18n={i18n}>
      <TooltipProvider>{props.children}</TooltipProvider>
    </I18nextProvider>
  )
}

describe('user employment overview column', () => {
  test('shows the common model badge with normal font weight', () => {
    const column = userModelColumn<UserColumnRow>((key) => key, {
      accessor: 'monthly_common_model',
      variant: 'badge',
    })
    const cell = column.cell
    assert.equal(typeof cell, 'function')
    if (typeof cell !== 'function') {
      throw new TypeError('Expected the model column to provide a cell')
    }

    const element = cell({
      row: {
        original: { ...user, monthly_common_model: 'deepseek-v4-pro' },
      },
    } as never)
    const { container } = render(element as ReactElement, {
      wrapper: TestWrapper,
    })

    expect(container.querySelector('[data-slot="status-badge"]')).toHaveClass(
      'font-normal'
    )
    expect(
      container.querySelector('[data-slot="status-badge"]')
    ).not.toHaveClass('font-medium')
  })

  test('shows plain department and job level above the join date', () => {
    const column = userEmploymentOverviewColumn<UserColumnRow>((key) => key)
    expect(column).toMatchObject({
      id: 'employment_overview',
      header: 'Employment Overview',
      size: 200,
      minSize: 180,
    })

    const cell = column.cell
    assert.equal(typeof cell, 'function')
    if (typeof cell !== 'function') {
      throw new TypeError('Expected the employment column to provide a cell')
    }

    const element = cell({ row: { original: user } } as never)
    const { container } = render(element as ReactElement, {
      wrapper: TestWrapper,
    })

    expect(screen.getByText(/^Department/)).toHaveClass('sr-only')
    expect(
      screen.getByText('Headquarters/Engineering/AI Platform')
    ).toHaveClass('text-foreground', 'font-normal')
    expect(
      screen.getByText('Headquarters/Engineering/AI Platform')
    ).not.toHaveClass('font-medium')
    expect(screen.getByText(/^Job Level/)).toHaveClass('sr-only')
    expect(screen.getByText('P6')).toHaveClass(
      'text-foreground',
      'w-[88px]',
      'max-w-[88px]',
      'shrink-0',
      'truncate'
    )
    expect(screen.queryByText('·')).not.toBeInTheDocument()
    expect(screen.getByText(/^Join Date/)).toHaveClass('sr-only')
    expect(screen.getByText('2024-03-18')).toHaveClass('tabular-nums')
    expect(
      container.querySelector('[data-slot="badge"]')
    ).not.toBeInTheDocument()
    expect(
      container.querySelector('[data-table-text="secondary"]')
    ).toHaveClass(
      'w-[280px]',
      'max-w-[280px]',
      'space-y-1.5',
      'overflow-hidden'
    )
    expect(container.querySelectorAll('svg[aria-hidden="true"]')).toHaveLength(
      1
    )
  })

  test('replaces the three standalone employment columns when enabled', () => {
    const { result } = renderHook(
      () =>
        useSharedUserColumns<UserColumnRow>({
          costAccessor: 'monthly_total_amount_cny',
          tokensAccessor: 'monthly_total_tokens',
          requestsAccessor: 'monthly_total_requests',
          modelAccessor: 'monthly_common_model',
          requestCountAccessor: 'monthly_total_requests',
          combineActivityTimes: true,
          combineEmploymentOverview: true,
        }),
      { wrapper: TestWrapper }
    )
    const columnIds = result.current.map(
      (column) => column.id ?? (column as { accessorKey?: string }).accessorKey
    )

    expect(columnIds).toContain('employment_overview')
    expect(columnIds).not.toContain('department_name')
    expect(columnIds).not.toContain('job_level')
    expect(columnIds).not.toContain('join_date')
  })
})
