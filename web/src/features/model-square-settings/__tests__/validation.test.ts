import { createInstance } from 'i18next'
import { describe, expect, test } from 'vitest'

import { createModelSquareConfigSchema } from '../lib/schema'
import type { ModelSquareRecommendation } from '../types'

const i18n = createInstance()
await i18n.init({ lng: 'en', resources: { en: { translation: {} } } })
const schema = createModelSquareConfigSchema(i18n.t)
const entry: ModelSquareRecommendation = {
  model_name: 'actual-model',
  scenarios: ['Coding'],
  enabled: true,
}

describe('recommendation configuration validation', () => {
  test('preserves exact model names and scenario order without requiring a reason', () => {
    const config = schema.parse({
      enabled: false,
      recommendations: [
        {
          ...entry,
          model_name: ' actual-model ',
          scenarios: ['Custom review', 'Coding'],
        },
      ],
    })
    expect(config.recommendations[0]).toEqual({
      ...entry,
      model_name: ' actual-model ',
      scenarios: ['Custom review', 'Coding'],
    })
  })

  test('accepts a recommendation without any scenario', () => {
    expect(
      schema.safeParse({
        enabled: true,
        recommendations: [{ ...entry, scenarios: [] }],
      }).success
    ).toBe(true)
  })

  test.each([
    ['empty model', { model_name: '' }],
    ['long model', { model_name: 'm'.repeat(129) }],
    ['long scenario', { scenarios: ['s'.repeat(41)] }],
    [
      'too many scenarios',
      { scenarios: Array.from({ length: 11 }, (_, index) => `s${index}`) },
    ],
  ])('rejects %s before saving', (_name, override) => {
    expect(
      schema.safeParse({
        enabled: true,
        recommendations: [{ ...entry, ...override }],
      }).success
    ).toBe(false)
  })

  test('rejects a model that appears twice', () => {
    const duplicate = schema.safeParse({
      enabled: true,
      recommendations: [entry, { ...entry, enabled: false }],
    })
    expect(duplicate.success).toBe(false)
    if (!duplicate.success) {
      expect(duplicate.error.issues[0].path).toEqual([
        'recommendations',
        1,
        'model_name',
      ])
    }
  })

  test('rejects a scenario repeated inside one recommendation', () => {
    const duplicate = schema.safeParse({
      enabled: true,
      recommendations: [{ ...entry, scenarios: ['Coding', 'Coding'] }],
    })
    expect(duplicate.success).toBe(false)
    if (!duplicate.success) {
      expect(duplicate.error.issues[0].path).toEqual([
        'recommendations',
        0,
        'scenarios',
      ])
    }
  })

  test('strips legacy reasons when saving recommendation configuration', () => {
    const config = schema.parse({
      enabled: true,
      recommendations: [{ ...entry, reason: 'Legacy reason' }],
    })
    expect(config.recommendations).toEqual([entry])
  })

  test('accepts 100 unique recommendations and rejects the 101st', () => {
    const recommendations = Array.from({ length: 100 }, (_, index) => ({
      ...entry,
      model_name: `model-${index}`,
    }))
    expect(schema.safeParse({ enabled: true, recommendations }).success).toBe(
      true
    )
    expect(
      schema.safeParse({
        enabled: true,
        recommendations: [...recommendations, entry],
      }).success
    ).toBe(false)
    expect(
      schema.safeParse({ enabled: false, recommendations: [] }).success
    ).toBe(true)
  })
})
