import type { TFunction } from 'i18next'
import { z } from 'zod'

import {
  MODEL_SQUARE_MAX_SCENARIOS,
  MODEL_SQUARE_MAX_SCENARIO_LENGTH,
} from '../types'

export function createModelSquareConfigSchema(t: TFunction) {
  return z
    .object({
      enabled: z.boolean(),
      recommendations: z
        .array(
          z.object({
            model_name: z
              .string()
              .min(1, t('Select a model'))
              .max(128, t('Model name must not exceed 128 characters')),
            scenarios: z
              .array(
                z
                  .string()
                  .max(
                    MODEL_SQUARE_MAX_SCENARIO_LENGTH,
                    t('A scenario must not exceed 40 characters')
                  )
              )
              .max(
                MODEL_SQUARE_MAX_SCENARIOS,
                t('You can configure up to 10 scenarios per recommendation')
              ),
            enabled: z.boolean(),
          })
        )
        .max(100, t('You can configure up to 100 recommendations')),
    })
    .superRefine((config, context) => {
      const seenModels = new Set<string>()
      config.recommendations.forEach((recommendation, index) => {
        if (seenModels.has(recommendation.model_name)) {
          context.addIssue({
            code: 'custom',
            path: ['recommendations', index, 'model_name'],
            message: t('This model is already recommended'),
          })
        }
        seenModels.add(recommendation.model_name)

        if (
          new Set(recommendation.scenarios).size !==
          recommendation.scenarios.length
        ) {
          context.addIssue({
            code: 'custom',
            path: ['recommendations', index, 'scenarios'],
            message: t('This scenario is already added'),
          })
        }
      })
    })
}

export type ModelSquareFormValues = z.infer<
  ReturnType<typeof createModelSquareConfigSchema>
>
