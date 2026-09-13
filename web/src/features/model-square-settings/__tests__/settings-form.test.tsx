import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import {
  act,
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AxiosAdapter } from 'axios'
import { afterEach, describe, expect, test } from 'vitest'

import { api } from '@/lib/api'

import { modelSquareConfigQueryKey } from '../api'
import { ModelSquareSettings } from '../index'
import type { ModelSquareConfig, ModelSquareConfigData } from '../types'

const originalAdapter = api.defaults.adapter
const clients: QueryClient[] = []
afterEach(() => {
  cleanup()
  clients.splice(0).forEach((client) => client.clear())
  api.defaults.adapter = originalAdapter
})

function renderSettings(
  adapter: AxiosAdapter,
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
) {
  api.defaults.adapter = adapter
  clients.push(client)
  const router = createRouter({
    routeTree: createRootRoute({ component: ModelSquareSettings }),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
  return userEvent.setup()
}

async function addScenario(
  user: ReturnType<typeof userEvent.setup>,
  label: string
) {
  await user.click(screen.getByRole('combobox', { name: 'Usage scenarios' }))
  await user.click(await screen.findByRole('option', { name: label }))
  // An open popup hides the rest of the page from the accessibility tree.
  await user.keyboard('{Escape}')
}

describe('model square settings interactions', () => {
  test('uses the full content width with a single reorderable column', async () => {
    renderSettings(async (config) => ({
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
      data: {
        success: true,
        data: {
          enabled: true,
          recommendations: [
            {
              model_name: 'coding-model',
              scenarios: ['Coding'],
              enabled: true,
            },
            {
              model_name: 'chat-model',
              scenarios: ['Daily chat'],
              enabled: true,
            },
          ],
        },
        models: ['coding-model', 'chat-model'],
      },
    }))

    const firstCard = await screen.findByRole('group', {
      name: 'Recommendation 1',
    })
    const secondCard = screen.getByRole('group', {
      name: 'Recommendation 2',
    })
    const form = screen.getByRole('form', { name: 'Model Square Settings' })
    const firstItem = firstCard.parentElement
    const list = firstItem?.parentElement

    expect(form).toHaveClass('w-full')
    expect(form).not.toHaveClass('max-w-5xl')
    expect(firstItem?.tagName).toBe('LI')
    expect(secondCard.parentElement?.parentElement).toBe(list)
    expect(list).toHaveClass('flex', 'w-full', 'flex-col')
    expect(list).not.toHaveClass('grid', 'md:grid-cols-2')
    expect(
      within(firstCard).getByRole('button', {
        name: 'Drag Recommendation 1 to reorder',
      })
    ).toBeVisible()
  })

  test.each([
    ['updates a clean cached form when fresh configuration arrives', false],
    ['preserves dirty edits when fresh configuration replaces the cache', true],
  ] as const)('%s', async (_name, editBeforeRefresh) => {
    const cached: ModelSquareConfig = {
      enabled: false,
      recommendations: [
        {
          model_name: 'cached-model',
          scenarios: ['Daily chat'],
          enabled: true,
        },
      ],
    }
    const fresh: ModelSquareConfig = {
      enabled: true,
      recommendations: [
        {
          model_name: 'fresh-model',
          scenarios: ['Coding'],
          enabled: true,
        },
      ],
    }
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    client.setQueryData<ModelSquareConfigData>(modelSquareConfigQueryKey, {
      data: cached,
      models: ['cached-model', 'fresh-model'],
    })
    let finishLoad: (config: ModelSquareConfig) => void = () => undefined
    const pendingLoad = new Promise<ModelSquareConfig>((resolve) => {
      finishLoad = resolve
    })
    const user = renderSettings(
      async (config) => ({
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
        data: {
          success: true,
          data: await pendingLoad,
          models: ['cached-model', 'fresh-model'],
        },
      }),
      client
    )

    expect(await screen.findByRole('combobox', { name: 'Model' })).toHaveValue(
      'cached-model'
    )
    if (editBeforeRefresh) {
      await addScenario(user, 'Writing')
    }
    await act(async () => {
      finishLoad(fresh)
      await pendingLoad
    })
    await waitFor(() =>
      expect(
        client.getQueryData<ModelSquareConfigData>(modelSquareConfigQueryKey)
          ?.data
      ).toEqual(fresh)
    )

    await waitFor(() =>
      expect(
        within(
          screen.getByRole('group', { name: 'Recommendation 1' })
        ).getByText(editBeforeRefresh ? 'Writing' : 'Coding')
      ).toBeVisible()
    )
    expect(screen.getByRole('combobox', { name: 'Model' })).toHaveValue(
      editBeforeRefresh ? 'cached-model' : 'fresh-model'
    )
    if (editBeforeRefresh) {
      expect(screen.getByText('Unsaved changes')).toBeVisible()
      expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled()
    } else {
      expect(
        screen.getByRole('switch', { name: 'Enable model recommendations' })
      ).toBeChecked()
      expect(
        screen.getByRole('button', { name: 'Save changes' })
      ).toBeDisabled()
      expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument()
    }
  })

  test('adds a searched model, edits scenario and switches, then saves without a reason and clears dirty state', async () => {
    let saved: ModelSquareConfig | undefined
    const user = renderSettings(async (config) => {
      if (config.method === 'put') {
        saved = JSON.parse(config.data as string) as ModelSquareConfig
      }
      return {
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
        data: {
          success: true,
          data: saved ?? { enabled: false, recommendations: [] },
          models: ['gpt-code', 'image-model'],
        },
      }
    })
    expect(
      await screen.findByText('No recommendations configured')
    ).toBeVisible()
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled()
    await user.click(
      screen.getByRole('switch', { name: 'Enable model recommendations' })
    )
    await user.click(screen.getByRole('button', { name: 'Add recommendation' }))
    await user.type(screen.getByRole('combobox', { name: 'Model' }), 'gpt')
    await user.click(await screen.findByRole('option', { name: 'gpt-code' }))
    await addScenario(user, 'Coding')
    expect(
      screen.queryByRole('textbox', { name: 'Recommendation reason' })
    ).not.toBeInTheDocument()
    await user.click(screen.getByRole('switch', { name: 'Enabled' }))
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() =>
      expect(saved).toEqual({
        enabled: true,
        recommendations: [
          {
            model_name: 'gpt-code',
            scenarios: ['Coding'],
            enabled: false,
          },
        ],
      })
    )
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Save changes' })
      ).toBeDisabled()
    )
    expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument()
  })

  test('retains unavailable saved models, supports reset and removal, and disables adding when no models exist', async () => {
    let saved: ModelSquareConfig | undefined
    const initial: ModelSquareConfig = {
      enabled: true,
      recommendations: [
        {
          model_name: 'retired-model',
          scenarios: ['Daily chat'],
          reason: 'Legacy chat',
          enabled: true,
        },
      ],
    }
    const user = renderSettings(async (config) => {
      if (config.method === 'put') {
        saved = JSON.parse(config.data as string) as ModelSquareConfig
      }
      return {
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
        data: { success: true, data: saved ?? initial, models: [] },
      }
    })
    expect(
      await screen.findByText(
        'This saved model is currently unavailable. It will be retained until you replace or remove it.'
      )
    ).toBeVisible()
    expect(screen.getByRole('combobox', { name: 'Model' })).toHaveValue(
      'retired-model'
    )
    expect(
      screen.getByRole('button', { name: 'Add recommendation' })
    ).toBeDisabled()
    await addScenario(user, 'Writing')
    await user.click(screen.getByRole('button', { name: 'Reset changes' }))
    const card = screen.getByRole('group', { name: 'Recommendation 1' })
    expect(within(card).getByText('Daily chat')).toBeVisible()
    expect(within(card).queryByText('Writing')).not.toBeInTheDocument()
    await user.click(
      screen.getByRole('switch', { name: 'Enable model recommendations' })
    )
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() =>
      expect(saved?.recommendations).toEqual([
        {
          model_name: 'retired-model',
          scenarios: ['Daily chat'],
          enabled: true,
        },
      ])
    )
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Save changes' })
      ).toBeDisabled()
    )
    await user.click(
      screen.getByRole('button', { name: 'Remove recommendation 1' })
    )
    expect(screen.getByText('No recommendations configured')).toBeVisible()
  })

  test('requires a model but saves a selected model without a reason', async () => {
    let writes = 0
    let saved: ModelSquareConfig | undefined
    const user = renderSettings(async (config) => {
      if (config.method === 'put') {
        writes += 1
        saved = JSON.parse(config.data as string) as ModelSquareConfig
      }
      return {
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
        data: {
          success: true,
          data: saved ?? { enabled: true, recommendations: [] },
          models: ['actual-model'],
        },
      }
    })
    await user.click(
      await screen.findByRole('button', { name: 'Add recommendation' })
    )
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByText('Select a model')).toBeVisible()
    expect(
      screen.queryByRole('textbox', { name: 'Recommendation reason' })
    ).not.toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Model' })).toHaveAttribute(
      'aria-invalid',
      'true'
    )
    expect(writes).toBe(0)
    await user.type(screen.getByRole('combobox', { name: 'Model' }), 'actual')
    await user.click(
      await screen.findByRole('option', { name: 'actual-model' })
    )
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(writes).toBe(1))
    expect(saved?.recommendations[0]).toEqual({
      model_name: 'actual-model',
      scenarios: [],
      enabled: true,
    })
  })

  test('selects a model using the keyboard and disables edits during the pending save', async () => {
    let finishSave: (() => void) | undefined
    const pendingSave = new Promise<void>((resolve) => {
      finishSave = resolve
    })
    const user = renderSettings(async (config) => {
      if (config.method === 'put') await pendingSave
      return {
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
        data: {
          success: true,
          data:
            config.method === 'put'
              ? JSON.parse(config.data as string)
              : { enabled: false, recommendations: [] },
          models: ['gpt-code'],
        },
      }
    })
    await user.click(
      await screen.findByRole('button', { name: 'Add recommendation' })
    )
    const modelInput = screen.getByRole('combobox', { name: 'Model' })
    await user.type(modelInput, 'gpt')
    expect(modelInput).toHaveAttribute('aria-expanded', 'true')
    await user.keyboard('{ArrowDown}{Enter}')
    expect(modelInput).toHaveValue('gpt-code')
    expect(modelInput).toHaveAttribute('aria-expanded', 'false')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(
      await screen.findByRole('button', { name: 'Saving...' })
    ).toBeDisabled()
    expect(
      screen.getByRole('combobox', { name: 'Usage scenarios' })
    ).toBeDisabled()
    expect(
      screen.getByRole('switch', { name: 'Enable model recommendations' })
    ).toHaveAttribute('aria-disabled', 'true')
    expect(
      screen.getByRole('button', { name: 'Remove recommendation 1' })
    ).toBeDisabled()
    await act(async () => {
      finishSave?.()
      await pendingSave
    })
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Save changes' })
      ).toBeDisabled()
    )
  })

  test('retries loading and retains edits when save fails before a successful retry', async () => {
    let reads = 0
    let writes = 0
    const user = renderSettings(async (config) => {
      const isSave = config.method === 'put'
      if (isSave) writes += 1
      else reads += 1
      const success = isSave ? writes > 1 : reads > 1
      return {
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
        data: {
          success,
          message: success ? '' : 'Request failed',
          data: isSave
            ? JSON.parse(config.data as string)
            : { enabled: false, recommendations: [] },
          models: [],
        },
      }
    })
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Failed to load model square settings'
    )
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    await user.click(
      await screen.findByRole('switch', {
        name: 'Enable model recommendations',
      })
    )
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Failed to save model square settings'
    )
    expect(
      screen.getByRole('switch', { name: 'Enable model recommendations' })
    ).toBeChecked()
    expect(screen.getByText('Unsaved changes')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Save changes' })
      ).toBeDisabled()
    )
    expect(writes).toBe(2)
  })
})
