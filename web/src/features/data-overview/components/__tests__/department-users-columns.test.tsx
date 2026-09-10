import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { createInstance } from 'i18next'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import { describe, expect, test, vi } from 'vitest'

import { CUSTOM_FIELD_KEYS } from '@/features/users/types'

import type { DepartmentUsersResponse } from '../../types'
import { DepartmentUsersTable } from '../department-users-table'

vi.mock('@/lib/lobe-icon', () => ({
  getLobeIcon: () => null,
}))

vi.mock('../department-logs-dialog', () => ({
  DepartmentLogsDialog: () => null,
}))

vi.mock('../user-consumption-charts', () => ({
  UserConsumptionCharts: () => null,
}))

vi.mock('../user-stats-dialog', () => ({
  UserStatsDialog: () => null,
}))

const i18n = createInstance()
await i18n.use(initReactI18next).init({
  lng: 'en',
  resources: { en: { translation: {} } },
})

const initialUsers: DepartmentUsersResponse = {
  items: [
    {
      id: 42,
      username: 'alice',
      display_name: 'Alice Example',
      quota: 0,
      used_quota: 0,
      sub_quota_used: 0,
      sub_quota_total: 0,
      total_amount_cny: 0,
      total_tokens: 0,
      total_requests: 0,
      is_registered: true,
      request_count: 0,
      group: 'default',
      status: 1,
      role: 1,
      department_name: 'Product/AI Platform',
      custom_field_values: JSON.stringify({
        [CUSTOM_FIELD_KEYS.JOB_LEVEL]: 'P6',
      }),
      join_date: '2024-03-18',
      last_login_at: 1_788_600_600,
      created_at: 1_700_000_000,
    },
  ],
  total: 1,
  page: 1,
  page_size: 10,
  total_users: 1,
  registered_users: 1,
  unregistered_users: 0,
}

describe('department users table columns', () => {
  test('combines employment details and activity times like the users table', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    render(
      <I18nextProvider i18n={i18n}>
        <QueryClientProvider client={queryClient}>
          <DepartmentUsersTable
            companyId={1}
            departmentId='dept-1'
            startTimestamp={1_788_566_400}
            endTimestamp={1_788_652_799}
            initialUsers={initialUsers}
            initialUsersLoading={false}
            initialRankingsLoading={false}
          />
        </QueryClientProvider>
      </I18nextProvider>
    )

    expect(
      await screen.findByRole('columnheader', { name: 'Employment Overview' })
    ).toBeVisible()
    expect(screen.getByRole('columnheader', { name: 'Time' })).toBeVisible()
    expect(
      screen.queryByRole('columnheader', { name: 'Department' })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('columnheader', { name: 'Job Level' })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('columnheader', { name: 'Join Date' })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('columnheader', { name: 'Last Login' })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('columnheader', { name: 'Created At' })
    ).not.toBeInTheDocument()

    const employmentCell = screen.getByText('Product/AI Platform').closest('td')
    expect(employmentCell).not.toBeNull()
    expect(within(employmentCell as HTMLElement).getByText('P6')).toBeVisible()
    expect(
      within(employmentCell as HTMLElement).getByText('2024-03-18')
    ).toBeVisible()

    const timeCell = screen.getByText('Last Login').closest('td')
    expect(timeCell).not.toBeNull()
    expect(within(timeCell as HTMLElement).getByText('Created')).toBeVisible()
  })
})
