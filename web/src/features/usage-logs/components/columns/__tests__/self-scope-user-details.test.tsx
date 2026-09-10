import { render, screen } from '@testing-library/react'
import { createInstance } from 'i18next'
import type { ComponentType } from 'react'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import { describe, expect, test, vi } from 'vitest'

import type { UsageLog } from '../../../data/schema'
import { UsageLogsProvider } from '../../usage-logs-provider'
import { useCommonLogsColumns } from '../common-logs-columns'

vi.mock('@/lib/lobe-icon', () => ({
  getLobeIcon: () => null,
}))

const i18n = createInstance()
await i18n.use(initReactI18next).init({
  lng: 'en',
  resources: { en: { translation: {} } },
})

const selfLog: UsageLog = {
  id: 1,
  user_id: 42,
  created_at: 100,
  type: 2,
  content: '',
  username: 'alice',
  display_name: 'Alice Example',
  avatar_url: 'https://example.com/alice.png',
  token_name: '',
  model_name: '',
  quota: 0,
  prompt_tokens: 0,
  completion_tokens: 0,
  use_time: 0,
  is_stream: false,
  channel: 0,
  channel_name: '',
  token_id: 0,
  group: '',
  ip: '',
  other: '',
  request_id: '',
  upstream_request_id: '',
  open_id: '',
}

function SelfScopeUserCell() {
  const columns = useCommonLogsColumns(false, {
    canFetchUserDetails: true,
    showUserColumn: true,
  })
  const column = columns.find((item) => item.id === 'user')
  if (!column || typeof column.cell !== 'function') {
    throw new TypeError('Expected the self-scope user column to provide a cell')
  }

  const UserCell = column.cell as ComponentType<{
    row: { original: UsageLog }
  }>
  return <UserCell row={{ original: selfLog }} />
}

function UsageIdentityColumns() {
  const columns = useCommonLogsColumns(false, {
    canFetchUserDetails: true,
    showUserColumn: true,
  })
  const timeColumn = columns.find(
    (item) => 'accessorKey' in item && item.accessorKey === 'created_at'
  )
  const userColumn = columns.find((item) => item.id === 'user')
  if (
    !timeColumn ||
    typeof timeColumn.cell !== 'function' ||
    !userColumn ||
    typeof userColumn.cell !== 'function'
  ) {
    throw new TypeError('Expected the usage log identity columns')
  }

  const TimeCell = timeColumn.cell as ComponentType<{
    row: { original: UsageLog; getValue: (id: string) => unknown }
  }>
  const UserCell = userColumn.cell as ComponentType<{
    row: { original: UsageLog }
  }>

  return (
    <>
      <div data-testid='time-header-class'>
        {timeColumn.meta?.headerClassName}
      </div>
      <div data-testid='user-header-class'>
        {userColumn.meta?.headerClassName}
      </div>
      <div data-testid='time-cell'>
        <TimeCell
          row={{
            original: selfLog,
            getValue: () => selfLog.created_at,
          }}
        />
      </div>
      <div data-testid='user-cell'>
        <UserCell row={{ original: selfLog }} />
      </div>
    </>
  )
}

describe('self-scope usage log user details', () => {
  test('bolds only the time and user headers', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <UsageLogsProvider>
          <UsageIdentityColumns />
        </UsageLogsProvider>
      </I18nextProvider>
    )

    expect(screen.getByTestId('time-header-class')).toHaveTextContent(
      'font-semibold'
    )
    expect(screen.getByTestId('user-header-class')).toHaveTextContent(
      'font-semibold'
    )

    const timestamp = screen
      .getByTestId('time-cell')
      .querySelector('.tabular-nums')
    expect(timestamp).toHaveClass('font-normal')
    expect(timestamp).not.toHaveClass('font-medium')
    const typeBadge = screen
      .getByTestId('time-cell')
      .querySelector('[data-slot="status-badge"]')
    expect(typeBadge).toHaveClass('font-normal')
    expect(typeBadge).not.toHaveClass('font-medium')

    const displayName = screen.getByText('Alice Example')
    expect(displayName).toHaveClass('font-normal')
    expect(displayName).not.toHaveClass('font-medium')
  })

  test('keeps the avatar, identity text, and profile detail affordance visible', () => {
    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <UsageLogsProvider>
          <SelfScopeUserCell />
        </UsageLogsProvider>
      </I18nextProvider>
    )

    expect(container).toHaveTextContent('Alice Example')
    expect(container).toHaveTextContent('alice')
    expect(container.querySelector('[data-slot="avatar"]')).not.toBeNull()
    expect(
      container.querySelector('[data-slot="hover-card-trigger"]')
    ).not.toBeNull()
  })
})
