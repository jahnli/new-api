import { zodResolver } from '@hookform/resolvers/zod'
import axios from 'axios'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import * as z from 'zod'

import { CopyButton } from '@/components/copy-button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getAdminPlans } from '@/features/subscriptions/api'
import type { PlanRecord } from '@/features/subscriptions/types'
import { api } from '@/lib/api'
import { handleServerError } from '@/lib/handle-server-error'

import { FormDirtyIndicator } from '../components/form-dirty-indicator'
import { FormNavigationGuard } from '../components/form-navigation-guard'
import {
  SettingsForm,
  SettingsSwitchContent,
  SettingsSwitchItem,
} from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'
import {
  buildOAuthCallbackUrl,
  resolveOAuthSiteUrl,
} from './oauth-callback-url'

/**
 * react-hook-form 7 treats dotted `name` strings as nested paths. To keep
 * form state, schema validation, and dirty tracking aligned, the
 * `oidc.*` and `ldap.*` fields are modeled as nested objects here and
 * flattened back to dotted server keys only when persisting.
 */
const oauthSchema = z.object({
  oidc: z.object({
    enabled: z.boolean(),
    display_name: z.string(),
    client_id: z.string(),
    client_secret: z.string(),
    well_known: z.string(),
    authorization_endpoint: z.string(),
    token_endpoint: z.string(),
    user_info_endpoint: z.string(),
  }),
  ldap: z.object({
    enabled: z.boolean(),
    server_url: z.string(),
    bind_dn: z.string(),
    bind_password: z.string(),
    search_base: z.string(),
    search_filter: z.string(),
    username_attribute: z.string(),
    email_attribute: z.string(),
    display_name_attribute: z.string(),
    start_tls: z.boolean(),
    skip_tls_verify: z.boolean(),
    login_label: z.string(),
    company_sync_configs: z.array(
      z.object({
        company: z.string(),
        display_name: z.string(),
        sync_platform: z.enum(['none', 'feishu', 'dingtalk']),
        auto_subscribe_plan_id: z.number().int().nonnegative(),
        feishu_app_id: z.string(),
        feishu_app_secret: z.string(),
        feishu_email_suffix: z.string(),
        dingtalk_client_id: z.string(),
        dingtalk_client_secret: z.string(),
      })
    ),
  }),
  WeChatAuthEnabled: z.boolean(),
  WeChatServerAddress: z.string(),
  WeChatServerToken: z.string(),
  WeChatAccountQRCodeImageURL: z.string(),
})

type OAuthFormValues = z.infer<typeof oauthSchema>

type LDAPCompanySyncConfig =
  OAuthFormValues['ldap']['company_sync_configs'][number]

type FlatOAuthDefaults = {
  'oidc.enabled': boolean
  'oidc.display_name': string
  'oidc.client_id': string
  'oidc.client_secret': string
  'oidc.well_known': string
  'oidc.authorization_endpoint': string
  'oidc.token_endpoint': string
  'oidc.user_info_endpoint': string
  'ldap.enabled': boolean
  'ldap.server_url': string
  'ldap.bind_dn': string
  'ldap.bind_password': string
  'ldap.search_base': string
  'ldap.search_filter': string
  'ldap.username_attribute': string
  'ldap.email_attribute': string
  'ldap.display_name_attribute': string
  'ldap.start_tls': boolean
  'ldap.skip_tls_verify': boolean
  'ldap.login_label': string
  'ldap.company_sync_configs': string
  WeChatAuthEnabled: boolean
  WeChatServerAddress: string
  WeChatServerToken: string
  WeChatAccountQRCodeImageURL: string
}

const oauthTabContentClassName =
  'grid min-w-0 gap-x-5 gap-y-6 lg:grid-cols-2 [&>[data-slot=form-item]]:min-w-0 lg:[&>[data-slot=form-item]:has([data-slot=switch])]:col-span-2'

const emptyLDAPCompanySyncConfig = (): LDAPCompanySyncConfig => ({
  company: '',
  display_name: '',
  sync_platform: 'none',
  auto_subscribe_plan_id: 0,
  feishu_app_id: '',
  feishu_app_secret: '',
  feishu_email_suffix: '',
  dingtalk_client_id: '',
  dingtalk_client_secret: '',
})

const normalizeLDAPCompanySyncConfig = (
  config: Partial<LDAPCompanySyncConfig>
): LDAPCompanySyncConfig => {
  const company = config.company?.trim() ?? ''
  const syncPlatform =
    config.sync_platform === 'feishu' || config.sync_platform === 'dingtalk'
      ? config.sync_platform
      : 'none'

  return {
    ...emptyLDAPCompanySyncConfig(),
    ...config,
    company,
    display_name: config.display_name?.trim() || company,
    sync_platform: syncPlatform,
    auto_subscribe_plan_id: Number(config.auto_subscribe_plan_id ?? 0),
  }
}

const parseLDAPCompanySyncConfigs = (
  value: string | LDAPCompanySyncConfig[]
): LDAPCompanySyncConfig[] => {
  if (Array.isArray(value)) {
    return value.map(normalizeLDAPCompanySyncConfig)
  }
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) return []
    return parsed.map((item) =>
      normalizeLDAPCompanySyncConfig(item as Partial<LDAPCompanySyncConfig>)
    )
  } catch {
    return []
  }
}

type OAuthSetupGuideRow = {
  label: ReactNode
  value: string
  copyLabel: string
}

type OAuthSetupGuideProps = {
  title: string
  description: ReactNode
  rows: OAuthSetupGuideRow[]
  children?: ReactNode
}

function OAuthSetupGuide(props: OAuthSetupGuideProps) {
  return (
    <Alert className='lg:col-span-2'>
      <AlertTitle>{props.title}</AlertTitle>
      <AlertDescription className='space-y-3 text-sm'>
        <div>{props.description}</div>
        <div className='space-y-2'>
          {props.rows.map((row) => (
            <div
              key={`${String(row.label)}-${row.value}`}
              className='flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between'
            >
              <span className='text-muted-foreground shrink-0'>
                {row.label}
              </span>
              <span className='flex min-w-0 items-center gap-2'>
                <code className='bg-muted text-foreground min-w-0 rounded px-1.5 py-0.5 text-xs break-all'>
                  {row.value}
                </code>
                <CopyButton
                  value={row.value}
                  size='icon'
                  className='size-7'
                  tooltip={row.copyLabel}
                  aria-label={row.copyLabel}
                />
              </span>
            </div>
          ))}
        </div>
        {props.children}
      </AlertDescription>
    </Alert>
  )
}

const buildFormDefaults = (defaults: FlatOAuthDefaults): OAuthFormValues => ({
  oidc: {
    enabled: defaults['oidc.enabled'],
    display_name: defaults['oidc.display_name'] ?? '',
    client_id: defaults['oidc.client_id'] ?? '',
    client_secret: defaults['oidc.client_secret'] ?? '',
    well_known: defaults['oidc.well_known'] ?? '',
    authorization_endpoint: defaults['oidc.authorization_endpoint'] ?? '',
    token_endpoint: defaults['oidc.token_endpoint'] ?? '',
    user_info_endpoint: defaults['oidc.user_info_endpoint'] ?? '',
  },
  ldap: {
    enabled: defaults['ldap.enabled'],
    server_url: defaults['ldap.server_url'] ?? '',
    bind_dn: defaults['ldap.bind_dn'] ?? '',
    bind_password: defaults['ldap.bind_password'] ?? '',
    search_base: defaults['ldap.search_base'] ?? '',
    search_filter: defaults['ldap.search_filter'] ?? '(uid={{username}})',
    username_attribute: defaults['ldap.username_attribute'] ?? 'uid',
    email_attribute: defaults['ldap.email_attribute'] ?? 'mail',
    display_name_attribute: defaults['ldap.display_name_attribute'] ?? 'cn',
    start_tls: defaults['ldap.start_tls'],
    skip_tls_verify: defaults['ldap.skip_tls_verify'],
    login_label: defaults['ldap.login_label'] ?? '',
    company_sync_configs: parseLDAPCompanySyncConfigs(
      defaults['ldap.company_sync_configs']
    ),
  },
  WeChatAuthEnabled: defaults.WeChatAuthEnabled,
  WeChatServerAddress: defaults.WeChatServerAddress ?? '',
  WeChatServerToken: defaults.WeChatServerToken ?? '',
  WeChatAccountQRCodeImageURL: defaults.WeChatAccountQRCodeImageURL ?? '',
})

const normalizeFormValues = (values: OAuthFormValues): FlatOAuthDefaults => ({
  'oidc.enabled': values.oidc.enabled,
  'oidc.display_name': values.oidc.display_name,
  'oidc.client_id': values.oidc.client_id,
  'oidc.client_secret': values.oidc.client_secret,
  'oidc.well_known': values.oidc.well_known,
  'oidc.authorization_endpoint': values.oidc.authorization_endpoint,
  'oidc.token_endpoint': values.oidc.token_endpoint,
  'oidc.user_info_endpoint': values.oidc.user_info_endpoint,
  'ldap.enabled': values.ldap.enabled,
  'ldap.server_url': values.ldap.server_url,
  'ldap.bind_dn': values.ldap.bind_dn,
  'ldap.bind_password': values.ldap.bind_password,
  'ldap.search_base': values.ldap.search_base,
  'ldap.search_filter': values.ldap.search_filter,
  'ldap.username_attribute': values.ldap.username_attribute,
  'ldap.email_attribute': values.ldap.email_attribute,
  'ldap.display_name_attribute': values.ldap.display_name_attribute,
  'ldap.start_tls': values.ldap.start_tls,
  'ldap.skip_tls_verify': values.ldap.skip_tls_verify,
  'ldap.login_label': values.ldap.login_label,
  'ldap.company_sync_configs': JSON.stringify(
    values.ldap.company_sync_configs.map(normalizeLDAPCompanySyncConfig)
  ),
  WeChatAuthEnabled: values.WeChatAuthEnabled,
  WeChatServerAddress: values.WeChatServerAddress,
  WeChatServerToken: values.WeChatServerToken,
  WeChatAccountQRCodeImageURL: values.WeChatAccountQRCodeImageURL,
})

type OAuthSectionProps = {
  defaultValues: FlatOAuthDefaults
  serverAddress: string
}

export function OAuthSection(props: OAuthSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const [activeTab, setActiveTab] = useState('oidc')
  const [plans, setPlans] = useState<PlanRecord[]>([])
  const siteUrl = resolveOAuthSiteUrl(props.serverAddress, t('Site URL'))
  const oidcCallbackUrl = buildOAuthCallbackUrl(
    props.serverAddress,
    'oidc',
    t('Site URL')
  )

  const formDefaults = useMemo(
    () => buildFormDefaults(props.defaultValues),
    [props.defaultValues]
  )

  const form = useForm<OAuthFormValues>({
    resolver: zodResolver(oauthSchema),
    defaultValues: formDefaults,
  })

  const companySyncConfigs = useFieldArray({
    control: form.control,
    name: 'ldap.company_sync_configs',
  })

  const planTitleById = useMemo(() => {
    const nextPlanTitleById = new Map<number, string>()
    plans.forEach((item) => {
      nextPlanTitleById.set(item.plan.id, item.plan.title)
    })
    return nextPlanTitleById
  }, [plans])

  useEffect(() => {
    let mounted = true

    const loadPlans = async () => {
      try {
        const res = await getAdminPlans()
        if (mounted && res.success) {
          setPlans(res.data ?? [])
        }
      } catch {
        if (mounted) {
          setPlans([])
        }
      }
    }

    loadPlans()

    return () => {
      mounted = false
    }
  }, [])

  const baselineRef = useRef<FlatOAuthDefaults>(props.defaultValues)
  const baselineSerializedRef = useRef<string>(
    JSON.stringify(props.defaultValues)
  )

  useEffect(() => {
    const serialized = JSON.stringify(props.defaultValues)
    if (serialized === baselineSerializedRef.current) return
    baselineRef.current = props.defaultValues
    baselineSerializedRef.current = serialized
    form.reset(buildFormDefaults(props.defaultValues))
  }, [props.defaultValues, form])

  const onSubmit = async (values: OAuthFormValues) => {
    let finalValues = values

    if (values.oidc.well_known && values.oidc.well_known.trim() !== '') {
      const wellKnown = values.oidc.well_known.trim()
      if (
        !wellKnown.startsWith('http://') &&
        !wellKnown.startsWith('https://')
      ) {
        toast.error(t('Well-Known URL must start with http:// or https://'))
        return
      }

      try {
        const res = await axios.create().get(wellKnown)
        const authEndpoint = res.data['authorization_endpoint'] || ''
        const tokenEndpoint = res.data['token_endpoint'] || ''
        const userInfoEndpoint = res.data['userinfo_endpoint'] || ''

        finalValues = {
          ...values,
          oidc: {
            ...values.oidc,
            authorization_endpoint: authEndpoint,
            token_endpoint: tokenEndpoint,
            user_info_endpoint: userInfoEndpoint,
          },
        }

        form.setValue('oidc.authorization_endpoint', authEndpoint)
        form.setValue('oidc.token_endpoint', tokenEndpoint)
        form.setValue('oidc.user_info_endpoint', userInfoEndpoint)

        toast.success(t('OIDC configuration fetched successfully'))
      } catch (err) {
        handleServerError(
          err,
          t(
            'Failed to fetch OIDC configuration. Please check the URL and network status'
          )
        )
        return
      }
    }

    const normalized = normalizeFormValues(finalValues)
    const changedKeys = (
      Object.keys(normalized) as Array<keyof FlatOAuthDefaults>
    ).filter((key) => normalized[key] !== baselineRef.current[key])

    if (changedKeys.length === 0) {
      toast.info(t('No changes to save'))
      return
    }

    for (const key of changedKeys) {
      await updateOption.mutateAsync({
        key,
        value: normalized[key],
      })
    }

    baselineRef.current = normalized
    baselineSerializedRef.current = JSON.stringify(normalized)
    form.reset(buildFormDefaults(normalized))
  }

  const handleReset = () => {
    form.reset(buildFormDefaults(baselineRef.current))
    toast.success(t('Form reset to saved values'))
  }

  const [isTestingLDAP, setIsTestingLDAP] = useState(false)
  const handleTestLDAP = async () => {
    setIsTestingLDAP(true)
    try {
      const res = await api.post('/api/option/ldap/test')
      if (res.data?.success) {
        toast.success(t('LDAP connection test succeeded'))
      } else {
        toast.error(res.data?.message || t('LDAP connection test failed'))
      }
    } catch {
      toast.error(t('LDAP connection test failed'))
    } finally {
      setIsTestingLDAP(false)
    }
  }

  return (
    <>
      <FormNavigationGuard when={form.formState.isDirty} />

      <SettingsSection title={t('OAuth Integrations')}>
        <Form {...form}>
          <SettingsForm onSubmit={form.handleSubmit(onSubmit)}>
            <SettingsPageFormActions
              onSave={form.handleSubmit(onSubmit)}
              onReset={handleReset}
              isSaving={updateOption.isPending}
              isResetDisabled={!form.formState.isDirty}
            />
            <FormDirtyIndicator isDirty={form.formState.isDirty} />

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className='grid w-full grid-cols-3'>
                <TabsTrigger value='oidc'>{t('OIDC')}</TabsTrigger>
                <TabsTrigger value='wechat'>{t('WeChat')}</TabsTrigger>
                <TabsTrigger value='ldap'>{t('LDAP')}</TabsTrigger>
              </TabsList>

              <TabsContent value='oidc' className={oauthTabContentClassName}>
                <OAuthSetupGuide
                  title={t('Setup guide')}
                  description={
                    <div className='space-y-1'>
                      <p>
                        {t(
                          'Set these values in the provider application before enabling login.'
                        )}
                      </p>
                      <p>
                        {t(
                          'OIDC discovery can fill the endpoint fields automatically when the provider supports it.'
                        )}
                      </p>
                    </div>
                  }
                  rows={[
                    {
                      label: t('Homepage URL'),
                      value: siteUrl,
                      copyLabel: t('Copy homepage URL'),
                    },
                    {
                      label: t('Redirect URL'),
                      value: oidcCallbackUrl,
                      copyLabel: t('Copy redirect URL'),
                    },
                  ]}
                />

                <FormField
                  control={form.control}
                  name='oidc.enabled'
                  render={({ field }) => (
                    <SettingsSwitchItem>
                      <SettingsSwitchContent>
                        <FormLabel>{t('Enable OIDC')}</FormLabel>
                        <FormDescription>
                          {t('Allow users to sign in with OpenID Connect')}
                        </FormDescription>
                      </SettingsSwitchContent>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </SettingsSwitchItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='oidc.display_name'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('OIDC Display Name')}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t('e.g. Company SSO')}
                          autoComplete='off'
                          value={field.value ?? ''}
                          onChange={(event) =>
                            field.onChange(event.target.value)
                          }
                          name={field.name}
                          onBlur={field.onBlur}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormDescription>
                        {t('Defaults to "OIDC" if left blank')}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='oidc.client_id'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Client ID')}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t('OIDC Client ID')}
                          autoComplete='off'
                          value={field.value ?? ''}
                          onChange={(event) =>
                            field.onChange(event.target.value)
                          }
                          name={field.name}
                          onBlur={field.onBlur}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='oidc.client_secret'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Client Secret')}</FormLabel>
                      <FormControl>
                        <Input
                          type='password'
                          placeholder={t('OIDC Client Secret')}
                          autoComplete='new-password'
                          value={field.value ?? ''}
                          onChange={(event) =>
                            field.onChange(event.target.value)
                          }
                          name={field.name}
                          onBlur={field.onBlur}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='oidc.well_known'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Well-Known URL')}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t(
                            'https://provider.com/.well-known/openid-configuration'
                          )}
                          autoComplete='off'
                          value={field.value ?? ''}
                          onChange={(event) =>
                            field.onChange(event.target.value)
                          }
                          name={field.name}
                          onBlur={field.onBlur}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormDescription>
                        {t('Auto-discovers endpoints from the provider')}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='oidc.authorization_endpoint'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t('Authorization Endpoint (Optional)')}
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t('Override auto-discovered endpoint')}
                          autoComplete='off'
                          value={field.value ?? ''}
                          onChange={(event) =>
                            field.onChange(event.target.value)
                          }
                          name={field.name}
                          onBlur={field.onBlur}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='oidc.token_endpoint'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Token Endpoint (Optional)')}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t('Override auto-discovered endpoint')}
                          autoComplete='off'
                          value={field.value ?? ''}
                          onChange={(event) =>
                            field.onChange(event.target.value)
                          }
                          name={field.name}
                          onBlur={field.onBlur}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='oidc.user_info_endpoint'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t('User Info Endpoint (Optional)')}
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t('Override auto-discovered endpoint')}
                          autoComplete='off'
                          value={field.value ?? ''}
                          onChange={(event) =>
                            field.onChange(event.target.value)
                          }
                          name={field.name}
                          onBlur={field.onBlur}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              <TabsContent value='wechat' className={oauthTabContentClassName}>
                <FormField
                  control={form.control}
                  name='WeChatAuthEnabled'
                  render={({ field }) => (
                    <SettingsSwitchItem>
                      <SettingsSwitchContent>
                        <FormLabel>{t('Enable WeChat Auth')}</FormLabel>
                        <FormDescription>
                          {t('Allow users to sign in with WeChat')}
                        </FormDescription>
                      </SettingsSwitchContent>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </SettingsSwitchItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='WeChatServerAddress'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Server Address')}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t('https://wechat-server.example.com')}
                          autoComplete='off'
                          value={field.value ?? ''}
                          onChange={(event) =>
                            field.onChange(event.target.value)
                          }
                          name={field.name}
                          onBlur={field.onBlur}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='WeChatServerToken'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Server Token')}</FormLabel>
                      <FormControl>
                        <Input
                          type='password'
                          placeholder={t('Server Token')}
                          autoComplete='new-password'
                          value={field.value ?? ''}
                          onChange={(event) =>
                            field.onChange(event.target.value)
                          }
                          name={field.name}
                          onBlur={field.onBlur}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='WeChatAccountQRCodeImageURL'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('QR Code Image URL')}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t('https://example.com/qr-code.png')}
                          autoComplete='off'
                          value={field.value ?? ''}
                          onChange={(event) =>
                            field.onChange(event.target.value)
                          }
                          name={field.name}
                          onBlur={field.onBlur}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              <TabsContent
                value='ldap'
                className={`${oauthTabContentClassName} pb-16`}
              >
                <FormField
                  control={form.control}
                  name='ldap.enabled'
                  render={({ field }) => (
                    <SettingsSwitchItem>
                      <SettingsSwitchContent>
                        <FormLabel>{t('Enable LDAP Login')}</FormLabel>
                        <FormDescription>
                          {t('Allow users to sign in with LDAP credentials')}
                        </FormDescription>
                      </SettingsSwitchContent>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </SettingsSwitchItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='ldap.server_url'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Server URL')}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t(
                            'ldap://host:port or ldaps://host:port'
                          )}
                          autoComplete='off'
                          value={field.value ?? ''}
                          onChange={(event) =>
                            field.onChange(event.target.value)
                          }
                          name={field.name}
                          onBlur={field.onBlur}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='ldap.bind_dn'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Bind DN')}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t('Service account DN for searching')}
                          autoComplete='off'
                          value={field.value ?? ''}
                          onChange={(event) =>
                            field.onChange(event.target.value)
                          }
                          name={field.name}
                          onBlur={field.onBlur}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='ldap.bind_password'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Bind Password')}</FormLabel>
                      <FormControl>
                        <Input
                          type='password'
                          placeholder={t('Service account password')}
                          autoComplete='new-password'
                          value={field.value ?? ''}
                          onChange={(event) =>
                            field.onChange(event.target.value)
                          }
                          name={field.name}
                          onBlur={field.onBlur}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='ldap.search_base'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Search Base')}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t('Base DN to search users')}
                          autoComplete='off'
                          value={field.value ?? ''}
                          onChange={(event) =>
                            field.onChange(event.target.value)
                          }
                          name={field.name}
                          onBlur={field.onBlur}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='ldap.search_filter'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Search Filter')}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder='(uid={{username}})'
                          autoComplete='off'
                          value={field.value ?? ''}
                          onChange={(event) =>
                            field.onChange(event.target.value)
                          }
                          name={field.name}
                          onBlur={field.onBlur}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormDescription>
                        {t(
                          'Use {{username}} as the placeholder for the login username'
                        )}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='ldap.username_attribute'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Username Attribute')}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder='uid'
                          autoComplete='off'
                          value={field.value ?? ''}
                          onChange={(event) =>
                            field.onChange(event.target.value)
                          }
                          name={field.name}
                          onBlur={field.onBlur}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='ldap.email_attribute'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Email Attribute')}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder='mail'
                          autoComplete='off'
                          value={field.value ?? ''}
                          onChange={(event) =>
                            field.onChange(event.target.value)
                          }
                          name={field.name}
                          onBlur={field.onBlur}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='ldap.display_name_attribute'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Display Name Attribute')}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder='cn'
                          autoComplete='off'
                          value={field.value ?? ''}
                          onChange={(event) =>
                            field.onChange(event.target.value)
                          }
                          name={field.name}
                          onBlur={field.onBlur}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='ldap.login_label'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Login Button Label')}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t('Continue with LDAP')}
                          autoComplete='off'
                          value={field.value ?? ''}
                          onChange={(event) =>
                            field.onChange(event.target.value)
                          }
                          name={field.name}
                          onBlur={field.onBlur}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormDescription>
                        {t('Custom label for the LDAP login button')}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='ldap.start_tls'
                  render={({ field }) => (
                    <SettingsSwitchItem>
                      <SettingsSwitchContent>
                        <FormLabel>{t('StartTLS')}</FormLabel>
                        <FormDescription>
                          {t('Upgrade plain LDAP connection to TLS')}
                        </FormDescription>
                      </SettingsSwitchContent>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </SettingsSwitchItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='ldap.skip_tls_verify'
                  render={({ field }) => (
                    <SettingsSwitchItem>
                      <SettingsSwitchContent>
                        <FormLabel>{t('Skip TLS Verify')}</FormLabel>
                        <FormDescription>
                          {t(
                            'Skip TLS certificate verification (not recommended)'
                          )}
                        </FormDescription>
                      </SettingsSwitchContent>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </SettingsSwitchItem>
                  )}
                />

                <div className='space-y-4 rounded-md border p-4 lg:col-span-2'>
                  <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
                    <div className='space-y-1'>
                      <FormLabel>{t('Company Sync Configurations')}</FormLabel>
                      <FormDescription>
                        {t(
                          'Map LDAP company OUs to directory sync providers and default subscription plans'
                        )}
                      </FormDescription>
                    </div>
                    <Button
                      type='button'
                      variant='outline'
                      onClick={() =>
                        companySyncConfigs.append(emptyLDAPCompanySyncConfig())
                      }
                    >
                      {t('Add Configuration')}
                    </Button>
                  </div>

                  {companySyncConfigs.fields.length === 0 ? (
                    <p className='text-muted-foreground text-sm'>
                      {t('No company sync configurations added')}
                    </p>
                  ) : null}

                  <div className='space-y-4'>
                    {companySyncConfigs.fields.map((item, index) => (
                      <div
                        key={item.id}
                        className='grid gap-4 rounded-md border p-4 lg:grid-cols-2'
                      >
                        <FormField
                          control={form.control}
                          name={`ldap.company_sync_configs.${index}.company`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('Company')}</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder={t('Company OU name')}
                                  autoComplete='off'
                                  value={field.value ?? ''}
                                  onChange={(event) =>
                                    field.onChange(event.target.value)
                                  }
                                  name={field.name}
                                  onBlur={field.onBlur}
                                  ref={field.ref}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name={`ldap.company_sync_configs.${index}.display_name`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('Display Name')}</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder={t('Display Name')}
                                  autoComplete='off'
                                  value={field.value ?? ''}
                                  onChange={(event) =>
                                    field.onChange(event.target.value)
                                  }
                                  name={field.name}
                                  onBlur={field.onBlur}
                                  ref={field.ref}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name={`ldap.company_sync_configs.${index}.sync_platform`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('Sync Platform')}</FormLabel>
                              <FormControl>
                                <select
                                  className='border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm transition-colors focus-visible:ring-1 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50'
                                  value={field.value}
                                  onChange={(event) =>
                                    field.onChange(event.target.value)
                                  }
                                  name={field.name}
                                  onBlur={field.onBlur}
                                  ref={field.ref}
                                >
                                  <option value='none'>{t('None')}</option>
                                  <option value='feishu'>{t('Feishu')}</option>
                                  <option value='dingtalk'>
                                    {t('DingTalk')}
                                  </option>
                                </select>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {form.watch(
                          `ldap.company_sync_configs.${index}.sync_platform`
                        ) === 'feishu' ? (
                          <>
                            <FormField
                              control={form.control}
                              name={`ldap.company_sync_configs.${index}.feishu_app_id`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>{t('Application ID')}</FormLabel>
                                  <FormControl>
                                    <Input
                                      autoComplete='off'
                                      value={field.value ?? ''}
                                      onChange={(event) =>
                                        field.onChange(event.target.value)
                                      }
                                      name={field.name}
                                      onBlur={field.onBlur}
                                      ref={field.ref}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name={`ldap.company_sync_configs.${index}.feishu_app_secret`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>
                                    {t('Application Secret')}
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      type='password'
                                      autoComplete='new-password'
                                      value={field.value ?? ''}
                                      onChange={(event) =>
                                        field.onChange(event.target.value)
                                      }
                                      name={field.name}
                                      onBlur={field.onBlur}
                                      ref={field.ref}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name={`ldap.company_sync_configs.${index}.feishu_email_suffix`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>
                                    {t('Feishu Email Suffix')}
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      placeholder='@example.com'
                                      autoComplete='off'
                                      value={field.value ?? ''}
                                      onChange={(event) =>
                                        field.onChange(event.target.value)
                                      }
                                      name={field.name}
                                      onBlur={field.onBlur}
                                      ref={field.ref}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </>
                        ) : null}

                        {form.watch(
                          `ldap.company_sync_configs.${index}.sync_platform`
                        ) === 'dingtalk' ? (
                          <>
                            <FormField
                              control={form.control}
                              name={`ldap.company_sync_configs.${index}.dingtalk_client_id`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>
                                    {t('DingTalk Client ID')}
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      autoComplete='off'
                                      placeholder={t('Original AppKey')}
                                      value={field.value ?? ''}
                                      onChange={(event) =>
                                        field.onChange(event.target.value)
                                      }
                                      name={field.name}
                                      onBlur={field.onBlur}
                                      ref={field.ref}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name={`ldap.company_sync_configs.${index}.dingtalk_client_secret`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>
                                    {t('DingTalk Client Secret')}
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      type='password'
                                      autoComplete='new-password'
                                      placeholder={t('Original AppSecret')}
                                      value={field.value ?? ''}
                                      onChange={(event) =>
                                        field.onChange(event.target.value)
                                      }
                                      name={field.name}
                                      onBlur={field.onBlur}
                                      ref={field.ref}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </>
                        ) : null}

                        <FormField
                          control={form.control}
                          name={`ldap.company_sync_configs.${index}.auto_subscribe_plan_id`}
                          render={({ field }) => {
                            const selectedPlanLabel = field.value
                              ? planTitleById.get(field.value) || t('Loading')
                              : t('No auto-subscription')

                            return (
                              <FormItem>
                                <FormLabel>
                                  {t('Auto-subscribe plan after registration')}
                                </FormLabel>
                                <Select
                                  value={String(field.value || 0)}
                                  onValueChange={(value) =>
                                    field.onChange(Number(value))
                                  }
                                >
                                  <FormControl>
                                    <SelectTrigger className='h-9 w-full'>
                                      <span className='line-clamp-1 min-w-0 flex-1 text-left'>
                                        {selectedPlanLabel}
                                      </span>
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value='0'>
                                      {t('No auto-subscription')}
                                    </SelectItem>
                                    {plans.map((item) => (
                                      <SelectItem
                                        key={item.plan.id}
                                        value={String(item.plan.id)}
                                      >
                                        {item.plan.title}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )
                          }}
                        />

                        <div className='flex items-end justify-end'>
                          <Button
                            type='button'
                            variant='outline'
                            onClick={() => companySyncConfigs.remove(index)}
                          >
                            {t('Remove')}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <FormItem className='lg:col-span-2'>
                  <Button
                    type='button'
                    variant='outline'
                    onClick={handleTestLDAP}
                    disabled={isTestingLDAP}
                  >
                    {isTestingLDAP ? t('Testing...') : t('Test Connection')}
                  </Button>
                  <FormDescription>
                    {t('Save configuration before testing the LDAP connection')}
                  </FormDescription>
                </FormItem>
              </TabsContent>
            </Tabs>
          </SettingsForm>
        </Form>
      </SettingsSection>
    </>
  )
}
