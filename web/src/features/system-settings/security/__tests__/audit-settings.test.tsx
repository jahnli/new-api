import { createInstance } from 'i18next'
import { renderToStaticMarkup } from 'react-dom/server'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, test, vi } from 'vitest'

vi.mock('../../hooks/use-update-option', () => ({
  useUpdateOption: () => ({
    isPending: false,
    mutateAsync: async () => undefined,
  }),
}))

const { AuditSection } = await import('../audit-section')

const i18n = createInstance()
await i18n.init({
  lng: 'en',
  fallbackLng: 'en',
  resources: { en: { translation: {} } },
})

describe('security audit settings presentation', () => {
  test('shows request content recording with the configured enabled state', () => {
    const html = renderToStaticMarkup(
      <I18nextProvider i18n={i18n}>
        <AuditSection
          defaultValues={{
            offHours: {
              enabled: true,
              start_hour: 3,
              end_hour: 7,
            },
            imageStudioEnabled: true,
            imageStudioDisplayHistoryLimit: 12,
            imageStudioStorageHistoryLimit: 80,
            requestContentEnabled: true,
          }}
        />
      </I18nextProvider>
    )

    expect(html).toContain('Record request content')
    expect(html).toContain(
      'Store the user prompts and model parameters of each relay request for auditing.'
    )
    expect(html).toContain('data-audit-setting-card="off-hours"')
    expect(html).not.toContain('md:col-span-2')
    expect(html).toContain('data-audit-time-range="true"')
    expect(html).toContain('data-audit-setting-card="request-content"')
    expect(html).toContain('data-audit-setting-card="image-audit"')
    expect(html).toContain(
      'data-audit-setting-card="image-studio-display-history-limit"'
    )
    expect(html).toContain(
      'data-audit-setting-card="image-studio-storage-history-limit"'
    )
    expect(html).toContain('Image studio display limit')
    expect(html).toContain('Image studio storage limit')
    expect(html).toContain('value="12"')
    expect(html).toContain('value="80"')
    expect(html).toContain('role="switch"')
    expect(html).toContain('aria-checked="true"')
  })
})
