import { assert, describe, test } from 'vitest'

import {
  getCompanyRowActions,
  getCompanySecretPlaceholder,
  getPlatformCredentialFields,
  isPlatformSecretConfigured,
} from '../lib/company-form'
import type { Company } from '../types'

const enabledCompany: Company = {
  id: 1,
  name: 'Example Manufacturing',
  alias: 'Example',
  platform: 'feishu',
  status: 'enabled',
  sort_order: 10,
  login_methods: ['password', 'platform'],
  platform_credentials: {
    app_id: 'cli_example',
    app_secret_configured: true,
    client_secret_configured: false,
  },
}

describe('company platform credential visibility', () => {
  test('shows no credential inputs when no platform is selected', () => {
    assert.deepEqual(getPlatformCredentialFields('none'), [])
  })

  test('shows only Feishu credential inputs for a Feishu company', () => {
    assert.deepEqual(getPlatformCredentialFields('feishu'), [
      'feishu_app_id',
      'feishu_app_secret',
    ])
  })

  test('shows only DingTalk credential inputs for a DingTalk company', () => {
    assert.deepEqual(getPlatformCredentialFields('dingtalk'), [
      'dingtalk_client_id',
      'dingtalk_client_secret',
      'dingtalk_agent_id',
    ])
  })
})

describe('company secret presentation', () => {
  test('shows a masked placeholder when the secret is configured', () => {
    assert.equal(
      getCompanySecretPlaceholder(true, 'Enter a new secret'),
      '********'
    )
  })

  test('prompts for a secret when no secret is configured', () => {
    assert.equal(
      getCompanySecretPlaceholder(false, 'Enter a new secret'),
      'Enter a new secret'
    )
  })

  test('reports configured without exposing the stored secret', () => {
    const credentials = enabledCompany.platform_credentials
    assert.ok(credentials)
    assert.equal(isPlatformSecretConfigured(enabledCompany, 'feishu'), true)
    assert.equal('app_secret' in credentials, false)
  })

  test('does not reuse a configured secret for another platform', () => {
    assert.equal(isPlatformSecretConfigured(enabledCompany, 'dingtalk'), false)
  })
})

describe('company row actions', () => {
  test('offers edit, connection test, and disable without a delete action', () => {
    const actions = getCompanyRowActions(enabledCompany)
    const actionIds: string[] = actions.map((action) => action.id)
    assert.deepEqual(actionIds, ['edit', 'test-connection', 'toggle-status'])
    assert.equal(actionIds.includes('delete'), false)
    assert.equal(actions[2]?.labelKey, 'Disable')
  })

  test('offers enable for disabled companies', () => {
    const actions = getCompanyRowActions({
      ...enabledCompany,
      status: 'disabled',
    })
    assert.equal(actions[2]?.labelKey, 'Enable')
  })

  test('does not offer an external connection test without a platform', () => {
    const actions = getCompanyRowActions({
      ...enabledCompany,
      platform: 'none',
    })
    assert.deepEqual(
      actions.map((action) => action.id),
      ['edit', 'toggle-status']
    )
  })
})
