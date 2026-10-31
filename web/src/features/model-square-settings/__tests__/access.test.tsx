import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router'
import { cleanup, render, renderHook, screen } from '@testing-library/react'
import { createInstance } from 'i18next'
import { afterEach, expect, test } from 'vitest'

import { SYSTEM_SETTINGS_VIEW } from '@/components/layout/config/system-settings.config'
import { useSidebarData } from '@/hooks/use-sidebar-data'
import { api } from '@/lib/api'
import { ROLE } from '@/lib/roles'
import { Route as LegacyRoute } from '@/routes/_authenticated/model-square-settings'
import { Route } from '@/routes/_authenticated/system-settings/model-square'
import { Route as SystemSettingsRoute } from '@/routes/_authenticated/system-settings/route'
import { useAuthStore } from '@/stores/auth-store'

const originalAdapter = api.defaults.adapter
const clients: QueryClient[] = []
afterEach(() => {
  cleanup()
  clients.splice(0).forEach((client) => client.clear())
  api.defaults.adapter = originalAdapter
  useAuthStore.getState().auth.reset()
})

test.each([ROLE.USER, ROLE.ADMIN, null])(
  'rejects role %s before making a configuration request',
  async (role) => {
    useAuthStore
      .getState()
      .auth.setUser(role === null ? null : { id: 1, username: 'viewer', role })
    let requests = 0
    api.defaults.adapter = async (config) => {
      requests += 1
      return {
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
        data: {
          success: true,
          data: { enabled: false, recommendations: [] },
          models: [],
        },
      }
    }
    const root = createRootRoute({ component: Outlet })
    const settings = createRoute({
      getParentRoute: () => root,
      path: '/settings',
      beforeLoad: SystemSettingsRoute.options.beforeLoad as () => void,
      component: Route.options.component,
    })
    const forbidden = createRoute({
      getParentRoute: () => root,
      path: '/403',
      component: () => <p>Forbidden</p>,
    })
    const router = createRouter({
      routeTree: root.addChildren([settings, forbidden]),
      history: createMemoryHistory({ initialEntries: ['/settings'] }),
    })
    const client = new QueryClient()
    clients.push(client)
    render(
      <QueryClientProvider client={client}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    )
    expect(await screen.findByText('Forbidden')).toBeVisible()
    expect(requests).toBe(0)
  }
)

test.each(['/system-settings/model-square', '/model-square-settings'])(
  'allows root to open %s under Models & Routing',
  async (initialPath) => {
    useAuthStore
      .getState()
      .auth.setUser({ id: 1, username: 'root', role: ROLE.SUPER_ADMIN })
    api.defaults.adapter = async (config) => ({
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
      data: {
        success: true,
        data: { enabled: false, recommendations: [] },
        models: [],
      },
    })
    const root = createRootRoute({ component: Outlet })
    const settings = createRoute({
      getParentRoute: () => root,
      path: '/system-settings/model-square',
      beforeLoad: SystemSettingsRoute.options.beforeLoad as () => void,
      component: Route.options.component,
    })
    const legacy = createRoute({
      getParentRoute: () => root,
      path: '/model-square-settings',
      beforeLoad: LegacyRoute.options.beforeLoad as () => void,
    })
    const router = createRouter({
      routeTree: root.addChildren([settings, legacy]),
      history: createMemoryHistory({ initialEntries: [initialPath] }),
    })
    const client = new QueryClient()
    clients.push(client)
    render(
      <QueryClientProvider client={client}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    )
    expect(
      await screen.findByRole('form', { name: 'Model Square Settings' })
    ).toBeVisible()
    const sidebar = renderHook(() => useSidebarData())
    const item = sidebar.result.current.navGroups
      .flatMap((group) => group.items)
      .find((entry) => entry.title === 'Model Square Settings')
    expect(item).toBeUndefined()
    expect(router.state.location.pathname).toBe('/system-settings/model-square')
    expect(
      SYSTEM_SETTINGS_VIEW.pathPattern.test(router.state.location.pathname)
    ).toBe(true)
    const i18n = createInstance()
    await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
    const modelsGroup = SYSTEM_SETTINGS_VIEW.getNavGroups(i18n.t, {})
      .flatMap((group) => group.items)
      .find((entry) => entry.title === 'Models & Routing')
    expect(
      modelsGroup && 'items' in modelsGroup && modelsGroup.items
    ).toContainEqual({
      title: 'Model Square Settings',
      url: '/system-settings/model-square',
    })
  }
)
