/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'

import { GroupRatioVisualEditor } from '../group-ratio-visual-editor'

vi.mock('@/features/models/api', () => ({
  getVendors: vi.fn().mockResolvedValue({
    data: { items: [{ id: 1, name: 'DeepSeek' }] },
  }),
}))

describe('GroupRatioVisualEditor vendor ratio layout', () => {
  test('shows base and current ratios directly in the expanded vendor table', async () => {
    const user = userEvent.setup()
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <GroupRatioVisualEditor
          section='overrides'
          onSectionChange={vi.fn()}
          defaultUseAutoGroupField={null}
          groupRatio='{"default":1}'
          topupGroupRatio='{}'
          userUsableGroups='{}'
          groupGroupRatio='{}'
          groupVendorRatio='{"default":{"1":1.2}}'
          autoGroups='[]'
          maxTokenAutoGroupsField={null}
          groupSpecialUsableGroup='{}'
          onChange={vi.fn()}
        />
      </QueryClientProvider>
    )

    const trigger = screen
      .getAllByRole('button')
      .find((button) => button.getAttribute('aria-expanded') === 'false')
    if (!trigger) throw new Error('Vendor group trigger was not rendered')

    await user.click(trigger)

    const vendorTable = screen
      .getAllByRole('table')
      .find((table) =>
        within(table).queryByRole('columnheader', { name: 'Vendor' })
      )
    expect(vendorTable).toBeDefined()
    const vendorTableWrapper = vendorTable?.closest('.mx-4')
    expect(vendorTableWrapper).toHaveClass('mx-4', 'px-5')

    const ratioChange = vendorTable?.querySelector('[aria-label="1 → 1.2"]')
    expect(ratioChange).not.toBeNull()
    expect(
      ratioChange?.querySelector('svg.lucide-chevron-right')
    ).not.toBeNull()
    expect(ratioChange?.querySelector('svg.lucide-chevron-right')).toHaveClass(
      'text-amber-600'
    )
    expect(ratioChange?.querySelector('span.font-semibold')).toHaveClass(
      'text-amber-600'
    )
    expect(ratioChange).toHaveTextContent('11.2')
  })
})
