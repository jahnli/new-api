import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'

import { userSchema } from '../../types'
import { UsersMutateDrawer } from '../users-mutate-drawer'
import { UsersProvider } from '../users-provider'

const target = userSchema.parse({
  id: 2,
  username: 'group-user',
  display_name: 'Group user',
  role: 1,
  status: 1,
  quota: 0,
  used_quota: 0,
  request_count: 0,
  group: 'default',
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  useAuthStore.getState().auth.reset()
})

it('shows each base ratio while an admin sets the user group', async () => {
  useAuthStore.getState().auth.setUser({ id: 1, username: 'admin', role: 10 })
  vi.spyOn(api, 'get').mockImplementation(async (url) => {
    if (url === '/api/group/') {
      return {
        data: { success: true, data: { default: 1, vip: 2.5 } },
      }
    }
    if (url === '/api/authz/catalog') {
      return { data: { success: true, data: { resources: [], roles: [] } } }
    }
    if (url === '/api/department/full-tree') {
      return { data: { success: true, data: { tree_data: [] } } }
    }
    return { data: { success: true, data: target } }
  })

  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <UsersProvider>
        <UsersMutateDrawer
          open
          onOpenChange={() => undefined}
          currentRow={target}
        />
      </UsersProvider>
    </QueryClientProvider>
  )

  const groupCombobox = await screen.findByRole('combobox', {
    name: 'Group',
  })
  expect(await screen.findByText('1x Ratio')).toBeVisible()

  await userEvent.click(groupCombobox)
  expect(await screen.findByText('2.5x Ratio')).toBeVisible()
})
