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
import { useMutation } from '@tanstack/react-query'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { api } from '@/lib/api'
import { createServerError } from '@/lib/server-error-message'
import { useAuthStore, type AuthUser } from '@/stores/auth-store'

export type PricingCurrencyPreference = 'USD' | 'site'

function settingWithCurrency(
  setting: AuthUser['setting'],
  currency: PricingCurrencyPreference
): Record<string, unknown> {
  if (typeof setting === 'string') {
    try {
      const parsed: unknown = JSON.parse(setting)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return { ...parsed, pricing_currency: currency }
      }
    } catch {
      // A malformed setting falls back to a minimal preference object.
    }
  }
  return {
    ...(typeof setting === 'object' && setting !== null ? setting : {}),
    pricing_currency: currency,
  }
}

export function usePricingCurrencyPreference() {
  const user = useAuthStore((state) => state.auth.user)
  const setting = user?.setting
  let configured: unknown
  if (typeof setting === 'string') {
    try {
      const parsed: unknown = JSON.parse(setting)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        configured = (parsed as Record<string, unknown>).pricing_currency
      }
    } catch {
      // Use USD until a valid preference is available.
    }
  } else {
    configured = setting?.pricing_currency
  }
  const mutation = useMutation({
    mutationFn: async (currency: PricingCurrencyPreference) => {
      const response = await api.put('/api/user/self', {
        pricing_currency: currency,
      })
      if (!response.data.success) {
        throw createServerError(
          response.data,
          'Failed to save pricing currency'
        )
      }
      return currency
    },
    onSuccess: (currency) => {
      const auth = useAuthStore.getState().auth
      if (auth.user?.id !== user?.id || !auth.user) return
      auth.setUser({
        ...auth.user,
        setting: JSON.stringify(
          settingWithCurrency(auth.user.setting, currency)
        ),
      })
    },
  })
  return {
    currency: configured === 'site' ? 'site' : 'USD',
    saving: mutation.isPending,
    setCurrency: mutation.mutate,
  }
}

type PricingPreferences = {
  currency: PricingCurrencyPreference
  setCurrency: (currency: PricingCurrencyPreference) => void
}

export const usePricingPreferencesStore = create<PricingPreferences>()(
  persist(
    (set) => ({
      currency: 'USD',
      setCurrency: (currency) => set({ currency }),
    }),
    {
      name: 'model-pricing-preferences',
      // Keep the old store API for callers, but never read/write a browser
      // preference: the authenticated user's server setting is authoritative.
      storage: {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
      },
    }
  )
)
