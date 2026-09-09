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
import { afterEach, describe, expect, it } from 'vitest'

import { ModelSquareStatus } from '../components/model-square-status'
import type { Model, ModelSquareState } from '../types'

afterEach(cleanup)

function modelWithState(
  squareState: ModelSquareState,
  overrides: Partial<Model> = {}
): Model {
  return {
    id: 1,
    model_name: 'example-model',
    status: 1,
    sync_official: 1,
    created_time: 1,
    updated_time: 1,
    name_rule: 0,
    square_state: squareState,
    configured_channel_count: 1,
    ...overrides,
  }
}

describe('model square status', () => {
  it.each([
    {
      state: 'visible' as const,
      label: 'Displayed',
      description: 'Visible only to users with access to the model’s groups.',
    },
    {
      state: 'hidden' as const,
      label: 'Listing hidden',
      description: 'Hidden from the model square by metadata policy.',
    },
    {
      state: 'partial' as const,
      label: 'Partly shown',
      description:
        'Some matching models are hidden or have no available channel.',
    },
  ])('explains the $state state', ({ state, label, description }) => {
    render(<ModelSquareStatus detail model={modelWithState(state)} />)

    expect(screen.getByText(label)).toBeVisible()
    expect(screen.getByText(description)).toBeVisible()
  })

  it('explains when a metadata rule matches no configured channel model', () => {
    render(
      <ModelSquareStatus
        detail
        model={modelWithState('unavailable', {
          name_rule: 1,
          configured_channel_count: 0,
        })}
      />
    )

    expect(screen.getByText('Unavailable')).toBeVisible()
    expect(
      screen.getByText('No configured channel models match this metadata rule.')
    ).toBeVisible()
  })
})
