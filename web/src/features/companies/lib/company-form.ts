import type { TFunction } from 'i18next'
import { z } from 'zod'

import {
  companyLoginMethodSchema,
  companyPlatformSchema,
  companyStatusSchema,
  type Company,
  type CompanyPlatform,
} from '../types'

export const COMPANY_PLATFORM_OPTIONS = [
  { value: 'none', labelKey: 'No platform' },
  { value: 'feishu', labelKey: 'Feishu' },
  { value: 'dingtalk', labelKey: 'DingTalk' },
] as const

export const COMPANY_LOGIN_METHOD_OPTIONS = [
  { value: 'password', labelKey: 'Password Login' },
  { value: 'ldap', labelKey: 'LDAP Login' },
  { value: 'platform', labelKey: 'Platform Login' },
] as const

export type CompanyCredentialField =
  | 'feishu_app_id'
  | 'feishu_app_secret'
  | 'dingtalk_client_id'
  | 'dingtalk_client_secret'
  | 'dingtalk_agent_id'

export function getPlatformCredentialFields(
  platform: CompanyPlatform
): CompanyCredentialField[] {
  if (platform === 'feishu') {
    return ['feishu_app_id', 'feishu_app_secret']
  }
  if (platform === 'dingtalk') {
    return ['dingtalk_client_id', 'dingtalk_client_secret', 'dingtalk_agent_id']
  }
  return []
}

export function isPlatformSecretConfigured(
  company: Company | null,
  platform: CompanyPlatform
): boolean {
  if (!company?.platform_credentials) return false
  if (platform === 'feishu') {
    return company.platform_credentials.app_secret_configured
  }
  if (platform === 'dingtalk') {
    return company.platform_credentials.client_secret_configured
  }
  return false
}

export function getCompanySecretPlaceholder(
  configured: boolean,
  emptyPlaceholder: string
): string {
  return configured ? '********' : emptyPlaceholder
}

export function getCompanyRowActions(company: Company) {
  const actions: Array<{
    id: 'edit' | 'test-connection' | 'toggle-status'
    labelKey: string
  }> = [
    { id: 'edit' as const, labelKey: 'Edit' },
    {
      id: 'toggle-status' as const,
      labelKey: company.status === 'enabled' ? 'Disable' : 'Enable',
    },
  ]
  if (company.platform !== 'none') {
    actions.splice(1, 0, {
      id: 'test-connection' as const,
      labelKey: 'Test Connection',
    })
  }
  return actions
}

export function getCompanyFormSchema(t: TFunction) {
  return z
    .object({
      name: z
        .string()
        .trim()
        .min(1, t('Company name is required'))
        .max(100, t('Company name must not exceed 100 characters')),
      alias: z
        .string()
        .trim()
        .max(100, t('Company alias must not exceed 100 characters')),
      platform: companyPlatformSchema,
      status: companyStatusSchema,
      sort_order: z.coerce.number().int(),
      login_methods: z
        .array(companyLoginMethodSchema)
        .min(1, t('Select at least one login method')),
      feishu_app_id: z.string().trim(),
      feishu_app_secret: z.string(),
      dingtalk_client_id: z.string().trim(),
      dingtalk_client_secret: z.string(),
      dingtalk_agent_id: z.coerce.number().int().nonnegative(),
      feishu_secret_configured: z.boolean(),
      dingtalk_secret_configured: z.boolean(),
    })
    .superRefine((values, context) => {
      if (
        values.platform === 'none' &&
        values.login_methods.includes('platform')
      ) {
        context.addIssue({
          code: 'custom',
          path: ['login_methods'],
          message: t('Platform Login requires a company platform'),
        })
      }

      if (values.platform === 'feishu') {
        if (!values.feishu_app_id) {
          context.addIssue({
            code: 'custom',
            path: ['feishu_app_id'],
            message: t('Feishu App ID is required'),
          })
        }
        if (
          !values.feishu_secret_configured &&
          !values.feishu_app_secret.trim()
        ) {
          context.addIssue({
            code: 'custom',
            path: ['feishu_app_secret'],
            message: t('Feishu App Secret is required'),
          })
        }
      }

      if (values.platform === 'dingtalk') {
        if (!values.dingtalk_client_id) {
          context.addIssue({
            code: 'custom',
            path: ['dingtalk_client_id'],
            message: t('DingTalk Client ID is required'),
          })
        }
        if (values.dingtalk_agent_id <= 0) {
          context.addIssue({
            code: 'custom',
            path: ['dingtalk_agent_id'],
            message: t('DingTalk Agent ID is required'),
          })
        }
        if (
          !values.dingtalk_secret_configured &&
          !values.dingtalk_client_secret.trim()
        ) {
          context.addIssue({
            code: 'custom',
            path: ['dingtalk_client_secret'],
            message: t('DingTalk Client Secret is required'),
          })
        }
      }
    })
}

export type CompanyFormValues = z.infer<ReturnType<typeof getCompanyFormSchema>>

export const COMPANY_FORM_DEFAULTS: CompanyFormValues = {
  name: '',
  alias: '',
  platform: 'none',
  status: 'enabled',
  sort_order: 0,
  login_methods: ['password'],
  feishu_app_id: '',
  feishu_app_secret: '',
  dingtalk_client_id: '',
  dingtalk_client_secret: '',
  dingtalk_agent_id: 0,
  feishu_secret_configured: false,
  dingtalk_secret_configured: false,
}

export function companyToFormValues(company: Company): CompanyFormValues {
  return {
    name: company.name,
    alias: company.alias,
    platform: company.platform,
    status: company.status,
    sort_order: company.sort_order,
    login_methods: company.login_methods,
    feishu_app_id: company.platform_credentials?.app_id ?? '',
    feishu_app_secret: '',
    dingtalk_client_id: company.platform_credentials?.client_id ?? '',
    dingtalk_client_secret: '',
    dingtalk_agent_id: company.platform_credentials?.agent_id ?? 0,
    feishu_secret_configured: isPlatformSecretConfigured(company, 'feishu'),
    dingtalk_secret_configured: isPlatformSecretConfigured(company, 'dingtalk'),
  }
}
