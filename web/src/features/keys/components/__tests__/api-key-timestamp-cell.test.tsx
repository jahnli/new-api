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
import { describe, expect, test } from 'vitest'

import type { ApiKey } from '../../types'

const { createInstance } = await import('i18next')
const { I18nextProvider, initReactI18next } = await import('react-i18next')
const { TooltipProvider } = await import('@/components/ui/tooltip')
const { ApiKeyActivityCell } = await import('../api-key-timestamp-cell')

const i18n = createInstance()
await i18n.use(initReactI18next).init({
  lng: 'en',
  resources: {
    en: {
      translation: {
        Created: 'Created',
        'Just now': 'Just now',
        'Last Used': 'Last Used',
      },
    },
  },
})

const now = Date.UTC(2026, 8, 9, 12, 0, 0)
const apiKey: ApiKey = {
  id: 1,
  name: 'Test key',
  key: 'sk-test',
  status: 1,
  remain_quota: 100,
  used_quota: 0,
  unlimited_quota: false,
  expired_time: -1,
  created_time: now / 1000 - 86_400,
  accessed_time: now / 1000 - 120,
  group: 'default',
  auto_groups: null,
  cross_group_retry: false,
  model_limits_enabled: false,
  model_limits: '',
  allow_ips: '',
}

function ActivityCellHarness(props: { apiKey: ApiKey }) {
  return (
    <I18nextProvider i18n={i18n}>
      <TooltipProvider>
        <ApiKeyActivityCell apiKey={props.apiKey} now={now} layout='columns' />
      </TooltipProvider>
    </I18nextProvider>
  )
}

describe('API key activity time cell', () => {
  test('shows created and last-used values together in the upstream column layout', () => {
    const { container } = render(<ActivityCellHarness apiKey={apiKey} />)

    expect(screen.getByText('Created')).toBeInTheDocument()
    expect(screen.getByText('Last Used')).toBeInTheDocument()

    const activityCell = container.querySelector(
      '[data-table-text="secondary"]'
    )
    expect(activityCell).toHaveClass(
      'grid-flow-col',
      'grid-cols-2',
      'text-xs',
      'font-normal'
    )
    expect(screen.getByText('Created')).toHaveClass('text-muted-foreground')
    expect(screen.getByText('Last Used')).toHaveClass('text-muted-foreground')
    expect(container.querySelectorAll('time')).toHaveLength(2)
  })

  test('keeps stale last-used values highlighted', () => {
    const staleApiKey = {
      ...apiKey,
      accessed_time: now / 1000 - 100 * 86_400,
    }

    const { container } = render(<ActivityCellHarness apiKey={staleApiKey} />)

    const times = container.querySelectorAll('time')
    expect(times[1]).toHaveClass('text-warning')
  })
})
