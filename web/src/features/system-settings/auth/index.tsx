import { SettingsPage } from '../components/settings-page'
import type { AuthSettings } from '../types'
import {
  AUTH_DEFAULT_SECTION,
  getAuthSectionContent,
  getAuthSectionMeta,
} from './section-registry.tsx'

const defaultAuthSettings: AuthSettings = {
  PasswordLoginEnabled: true,
  PasswordRegisterEnabled: true,
  EmailVerificationEnabled: false,
  RegisterEnabled: true,
  EmailDomainRestrictionEnabled: false,
  EmailAliasRestrictionEnabled: false,
  EmailDomainWhitelist: '',
  ServerAddress: '',
  'oidc.enabled': false,
  'oidc.display_name': '',
  'oidc.client_id': '',
  'oidc.client_secret': '',
  'oidc.well_known': '',
  'oidc.authorization_endpoint': '',
  'oidc.token_endpoint': '',
  'oidc.user_info_endpoint': '',
  'ldap.enabled': false,
  'ldap.server_url': '',
  'ldap.bind_dn': '',
  'ldap.bind_password': '',
  'ldap.search_base': '',
  'ldap.search_filter': '(uid={{username}})',
  'ldap.username_attribute': 'uid',
  'ldap.email_attribute': 'mail',
  'ldap.display_name_attribute': 'cn',
  'ldap.start_tls': false,
  'ldap.skip_tls_verify': false,
  'ldap.login_label': '',
  'ldap.company_sync_configs': '[]',
  WeChatAuthEnabled: false,
  WeChatServerAddress: '',
  WeChatServerToken: '',
  WeChatAccountQRCodeImageURL: '',
  TurnstileCheckEnabled: false,
  TurnstileSiteKey: '',
  TurnstileSecretKey: '',
  'passkey.enabled': false,
  'passkey.rp_display_name': '',
  'passkey.rp_id': '',
  'passkey.legacy_rp_ids': '',
  'passkey.origins': '',
  'passkey.allow_insecure_origin': false,
  'passkey.user_verification': 'preferred',
  'passkey.attachment_preference': '',
}

export function AuthSettings() {
  return (
    <SettingsPage
      routePath='/_authenticated/system-settings/auth/$section'
      defaultSettings={defaultAuthSettings}
      defaultSection={AUTH_DEFAULT_SECTION}
      getSectionContent={getAuthSectionContent}
      getSectionMeta={getAuthSectionMeta}
    />
  )
}
