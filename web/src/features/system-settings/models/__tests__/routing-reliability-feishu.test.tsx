import { createInstance } from 'i18next'
import { renderToStaticMarkup } from 'react-dom/server'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, test, vi } from 'vitest'

vi.mock('../../request-policies/use-save-policy', () => ({
  useSavePolicy: () => ({
    isPending: false,
    mutateAsync: async () => undefined,
  }),
}))

const { isValidFeishuRobotWebhookUrl } = await import('../feishu-webhook-url')
const { ChannelHealthSection } =
  await import('../../request-policies/channel-health-section')

const i18n = createInstance()
await i18n.init({
  lng: 'en',
  fallbackLng: 'en',
  resources: { en: { translation: {} } },
})

const configuredWebhookUrl =
  'https://open.feishu.cn/open-apis/bot/v2/hook/robot-token-123'

describe('routing reliability Feishu notifications', () => {
  test('renders the configured webhook URL and disable guidance', () => {
    const html = renderToStaticMarkup(
      <I18nextProvider i18n={i18n}>
        <ChannelHealthSection
          defaultValues={{
            ChannelDisableThreshold: '5',
            AutomaticDisableChannelEnabled: true,
            AutomaticEnableChannelEnabled: true,
            AutomaticDisableKeywords: '',
            AutomaticDisableStatusCodes: '401',
            'monitor_setting.auto_test_channel_enabled': true,
            'monitor_setting.auto_test_channel_minutes': 10,
            'monitor_setting.channel_test_concurrency': 1,
            'monitor_setting.channel_test_mode': 'scheduled_all',
            'monitor_setting.feishu_channel_status_webhook_url':
              configuredWebhookUrl,
          }}
        />
      </I18nextProvider>
    )

    expect(html).toContain('Channel status notifications')
    expect(html).toContain('Feishu group robot webhook URL')
    expect(html).toContain(`value="${configuredWebhookUrl}"`)
    expect(html).toContain('Leave empty to disable notifications.')
  })

  test('accepts only empty or official Feishu group robot webhook URLs', () => {
    expect(isValidFeishuRobotWebhookUrl('')).toBe(true)
    expect(isValidFeishuRobotWebhookUrl(configuredWebhookUrl)).toBe(true)
    expect(
      isValidFeishuRobotWebhookUrl(
        'https://open.feishu.cn.attacker.example/open-apis/bot/v2/hook/token'
      )
    ).toBe(false)
    expect(
      isValidFeishuRobotWebhookUrl(
        'https://open.feishu.cn/open-apis/bot/v2/hook/token?redirect=1'
      )
    ).toBe(false)
  })
})
