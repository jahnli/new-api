import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  cleanup,
  render,
  screen,
  within,
  act,
  waitFor,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { afterEach, expect, test, vi } from 'vitest'

import { usePricingData } from '../../hooks/use-pricing-data'
import type { PricingData, PricingModel } from '../../types'
import { ModelCard } from '../model-card'
import { PricingTable } from '../pricing-table'

const model: PricingModel = {
  id: 1,
  model_name: 'recommended-model',
  quota_type: 1,
  model_price: 2,
  model_ratio: 1,
  completion_ratio: 1,
  enable_groups: ['default'],
  group_ratio: { default: 0.5 },
  is_recommended: true,
  recommendation_scenarios: ['coding', 'chat'],
}
const i18n = createInstance()
await i18n.init({
  lng: 'en',
  resources: {
    en: { translation: {} },
    zh: {
      translation: {
        Recommended: '推荐',
        Scenario: '适用场景',
        Coding: '编程',
        'Daily chat': '日常对话',
      },
    },
  },
})
afterEach(() => {
  cleanup()
  void i18n.changeLanguage('en')
})

test('recommended card shows one badge and retains pricing and details actions', async () => {
  const onClick = vi.fn()
  const user = userEvent.setup()
  const { rerender } = render(
    <I18nextProvider i18n={i18n}>
      <ModelCard model={model} onClick={onClick} selectedGroup='default' />
    </I18nextProvider>
  )
  expect(screen.getAllByText('Recommended')).toHaveLength(1)
  expect(screen.getByText('Coding')).toBeVisible()
  expect(screen.getByText('Daily chat')).toBeVisible()
  expect(screen.queryByText('Scenario')).not.toBeInTheDocument()
  expect(screen.getByRole('list', { name: 'Scenario' })).toBeVisible()
  expect(screen.getByText('Coding')).toHaveClass(
    'px-2.5',
    'py-1',
    'text-[13px]'
  )
  expect(screen.getByText('$1')).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Details' }))
  expect(onClick).toHaveBeenCalledOnce()
  await act(() => i18n.changeLanguage('zh'))
  expect(screen.getByText('推荐')).toBeVisible()
  expect(screen.getByText('编程')).toBeVisible()
  expect(screen.getByText('日常对话')).toBeVisible()
  expect(screen.queryByText('适用场景')).not.toBeInTheDocument()
  expect(screen.getByRole('list', { name: '适用场景' })).toBeVisible()
  rerender(
    <I18nextProvider i18n={i18n}>
      <ModelCard
        model={{ ...model, is_recommended: false }}
        onClick={onClick}
      />
    </I18nextProvider>
  )
  expect(screen.queryByText('推荐')).not.toBeInTheDocument()
})

test('long model names retain normal card spacing with the recommendation anchored outside the content flow', () => {
  const { container } = render(
    <I18nextProvider i18n={i18n}>
      <ModelCard
        model={{ ...model, model_name: 'long-model-name-'.repeat(10) }}
        onClick={vi.fn()}
      />
    </I18nextProvider>
  )
  const badge = screen.getByText('Recommended').parentElement
  expect(badge).toHaveClass('shrink-0')
  expect(badge?.parentElement).toHaveClass(
    'absolute',
    'top-0',
    '-translate-y-1/2',
    'pointer-events-none',
    'max-w-[calc(100%-1.5rem)]'
  )
  expect(badge).toHaveClass('max-w-full')
  expect(screen.getByText('Recommended')).toHaveClass('truncate')
  expect(container.firstElementChild).toHaveClass(
    'gap-3',
    'py-4',
    'overflow-visible'
  )
  expect(container.firstElementChild).not.toHaveClass('pt-10', 'sm:pt-11')
  expect(screen.getByRole('heading')).toHaveClass('line-clamp-2')
  expect(screen.getByRole('heading').parentElement).not.toHaveTextContent(
    'Recommended'
  )
  const details = screen.getByRole('button', { name: 'Details' })
  expect(details).toBeVisible()
  expect(details.parentElement).not.toHaveTextContent('Recommended')
  expect(details.parentElement).not.toHaveClass('flex-col')
})

test('table marks only recommended models and keeps row details clickable', async () => {
  const onModelClick = vi.fn()
  const user = userEvent.setup()
  render(
    <I18nextProvider i18n={i18n}>
      <PricingTable
        models={[
          model,
          {
            ...model,
            id: 2,
            model_name: 'ordinary-model',
            is_recommended: false,
          },
        ]}
        onModelClick={onModelClick}
      />
    </I18nextProvider>
  )
  expect(screen.getAllByText('Recommended')).toHaveLength(1)
  const recommendedRow = screen.getByRole('row', { name: /recommended-model/ })
  expect(within(recommendedRow).getByText('Recommended')).toBeVisible()
  expect(within(recommendedRow).getByText('Coding')).toBeVisible()
  expect(within(recommendedRow).getByText('Daily chat')).toBeVisible()
  expect(within(recommendedRow).queryByText('Scenario')).not.toBeInTheDocument()
  expect(within(recommendedRow).getByText('Coding')).toHaveClass(
    'px-2',
    'py-0.5',
    'text-xs'
  )
  expect(
    within(recommendedRow).getByText('Recommended').parentElement
  ).not.toHaveClass('absolute', 'border')
  await user.click(screen.getByText('recommended-model'))
  expect(onModelClick).toHaveBeenCalledWith('recommended-model')
})

function CatalogCards() {
  const { models } = usePricingData(false)
  return (
    <>
      {models.map((item) => (
        <ModelCard key={item.model_name} model={item} onClick={() => {}} />
      ))}
    </>
  )
}

test('catalog joins enabled recommendations by exact name without duplicates or a separate region', async () => {
  const client = new QueryClient()
  client.setQueryData(['status'], {})
  const data: PricingData = {
    success: true,
    data: [model, { ...model, id: 2, model_name: 'ordinary-model' }],
    vendors: [],
    group_ratio: { default: 1 },
    usable_group: {},
    supported_endpoint: {},
    auto_groups: [],
    recommendations: [
      {
        model_name: model.model_name,
        enabled: true,
        scenario: 'coding',
        reason: 'Legacy reason never shown',
      },
      {
        model_name: model.model_name,
        enabled: true,
        scenario: 'chat',
        reason: '',
      },
      {
        model_name: 'ordinary-model',
        enabled: false,
        scenario: 'general',
        reason: '',
      },
      {
        model_name: 'hidden-model',
        enabled: true,
        scenario: 'general',
        reason: '',
      },
    ],
  }
  client.setQueryData(['pricing'], data)
  render(
    <QueryClientProvider client={client}>
      <I18nextProvider i18n={i18n}>
        <CatalogCards />
      </I18nextProvider>
    </QueryClientProvider>
  )
  expect(screen.getAllByText('Recommended')).toHaveLength(1)
  expect(screen.getByText('Coding')).toBeVisible()
  expect(screen.getByText('Daily chat')).toBeVisible()
  expect(
    screen.getAllByRole('heading').map((item) => item.textContent)
  ).toEqual(['recommended-model', 'ordinary-model'])
  expect(
    screen.queryByText('Legacy reason never shown')
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('region', { name: 'Recommended models' })
  ).not.toBeInTheDocument()
  await act(async () => {
    client.setQueryData(['pricing'], { ...data, recommendations: [] })
  })
  await waitFor(() =>
    expect(screen.queryByText('Recommended')).not.toBeInTheDocument()
  )
  client.clear()
})
