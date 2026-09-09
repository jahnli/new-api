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
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

import { CommandMenu } from '../command-menu'

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  setTheme: vi.fn(),
}))

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mocks.navigate,
}))

vi.mock('@/context/theme-provider', () => ({
  useTheme: () => ({ setTheme: mocks.setTheme }),
}))

vi.mock('@/hooks/use-sidebar-view', () => ({
  useSidebarView: () => ({
    key: '__root',
    view: null,
    navGroups: [
      {
        id: 'general',
        title: 'General',
        items: [{ title: 'Dashboard', url: '/dashboard' }],
      },
    ],
  }),
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

it('renders only the navigation entries allowed by the shared sidebar view', () => {
  render(<CommandMenu open setOpen={vi.fn()} />)

  expect(screen.getByText('Dashboard')).toBeVisible()
  expect(screen.queryByText('Channels')).not.toBeInTheDocument()
  expect(screen.queryByText('Models')).not.toBeInTheDocument()
  expect(screen.queryByText('System Settings')).not.toBeInTheDocument()
})
