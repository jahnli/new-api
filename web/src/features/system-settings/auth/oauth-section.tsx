import { zodResolver } from '@hookform/resolvers/zod'
import axios from 'axios'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  useFieldArray,
  useForm,
  type UseFieldArrayReturn,
  type UseFormReturn,
} from 'react-hook-form'
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
 * `oidc.*` and `company_registration.*` fields are modeled as nested objects here and
 * flattened back to dotted server keys only when persisting.
 */
const oauthSchema = z.object({
  oidc: z.object({
    enabled: z.boolean(),
    silent_login: z.boolean(),
    display_name: z.string(),
    client_id: z.string(),
    client_secret: z.string(),
    well_known: z.string(),
    authorization_endpoint: z.string(),
    token_endpoint: z.string(),
    user_info_endpoint: z.string(),
  }),
  company_registration: z.object({
    configs: z.array(
      z.object({
        company: z.string(),
        display_name: z.string(),
        auto_subscribe_plan_id: z.number().int().nonnegative(),
      })
    ),
  }),
  WeChatAuthEnabled: z.boolean(),
  WeChatServerAddress: z.string(),
  WeChatServerToken: z.string(),
  WeChatAccountQRCodeImageURL: z.string(),
})

type OAuthFormValues = z.infer<typeof oauthSchema>

type CompanyRegistrationConfig =
  OAuthFormValues['company_registration']['configs'][number]

type FlatOAuthDefaults = {
  'oidc.enabled': boolean
  'oidc.silent_login'?: boolean
  'oidc.display_name': string
  'oidc.client_id': string
  'oidc.client_secret': string
  'oidc.well_known': string
  'oidc.authorization_endpoint': string
  'oidc.token_endpoint': string
  'oidc.user_info_endpoint': string
  'company_registration.configs': string
  WeChatAuthEnabled: boolean
  WeChatServerAddress: string
  WeChatServerToken: string
  WeChatAccountQRCodeImageURL: string
}

const oauthTabContentClassName =
  'grid min-w-0 gap-x-5 gap-y-6 lg:grid-cols-2 [&>[data-slot=form-item]]:min-w-0 lg:[&>[data-slot=form-item]:has([data-slot=switch])]:col-span-2'

const emptyCompanyRegistrationConfig = (): CompanyRegistrationConfig => ({
  company: '',
  display_name: '',
  auto_subscribe_plan_id: 0,
})

const normalizeCompanyRegistrationConfig = (
  config: Partial<CompanyRegistrationConfig>
): CompanyRegistrationConfig => {
  const company = config.company?.trim() ?? ''
  return {
    company,
    display_name: config.display_name?.trim() || company,
    auto_subscribe_plan_id: Number(config.auto_subscribe_plan_id ?? 0),
  }
}

const parseCompanyRegistrationConfigs = (
  value: string | CompanyRegistrationConfig[]
): CompanyRegistrationConfig[] => {
  if (Array.isArray(value)) {
    return value.map(normalizeCompanyRegistrationConfig)
  }
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) return []
    return parsed.map((item) =>
      normalizeCompanyRegistrationConfig(
        item as Partial<CompanyRegistrationConfig>
      )
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
    silent_login: defaults['oidc.silent_login'] ?? false,
    display_name: defaults['oidc.display_name'] ?? '',
    client_id: defaults['oidc.client_id'] ?? '',
    client_secret: defaults['oidc.client_secret'] ?? '',
    well_known: defaults['oidc.well_known'] ?? '',
    authorization_endpoint: defaults['oidc.authorization_endpoint'] ?? '',
    token_endpoint: defaults['oidc.token_endpoint'] ?? '',
    user_info_endpoint: defaults['oidc.user_info_endpoint'] ?? '',
  },
  company_registration: {
    configs: parseCompanyRegistrationConfigs(
      defaults['company_registration.configs']
    ),
  },
  WeChatAuthEnabled: defaults.WeChatAuthEnabled,
  WeChatServerAddress: defaults.WeChatServerAddress ?? '',
  WeChatServerToken: defaults.WeChatServerToken ?? '',
  WeChatAccountQRCodeImageURL: defaults.WeChatAccountQRCodeImageURL ?? '',
})

const normalizeFormValues = (
  values: OAuthFormValues
): Required<FlatOAuthDefaults> => ({
  'oidc.enabled': values.oidc.enabled,
  'oidc.silent_login': values.oidc.silent_login,
  'oidc.display_name': values.oidc.display_name,
  'oidc.client_id': values.oidc.client_id,
  'oidc.client_secret': values.oidc.client_secret,
  'oidc.well_known': values.oidc.well_known,
  'oidc.authorization_endpoint': values.oidc.authorization_endpoint,
  'oidc.token_endpoint': values.oidc.token_endpoint,
  'oidc.user_info_endpoint': values.oidc.user_info_endpoint,
  'company_registration.configs': JSON.stringify(
    values.company_registration.configs.map(normalizeCompanyRegistrationConfig)
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

  const companyRegistrationConfigs = useFieldArray({
    control: form.control,
    name: 'company_registration.configs',
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
    const wellKnown = values.oidc.well_known.trim()
    if (values.oidc.silent_login && !wellKnown) {
      setActiveTab('oidc')
      form.setError('oidc.well_known', {
        message: t('Configure OIDC discovery before enabling silent sign-in.'),
      })
      return
    }
    const discoveryUrlChanged =
      wellKnown !== (baselineRef.current['oidc.well_known'] ?? '').trim()
    const enablingOIDC =
      values.oidc.enabled && !baselineRef.current['oidc.enabled']

    // Other providers and disabling OIDC must not depend on OIDC discovery.
    if (wellKnown && (discoveryUrlChanged || enablingOIDC)) {
      if (
        !wellKnown.startsWith('http://') &&
        !wellKnown.startsWith('https://')
      ) {
        setActiveTab('oidc')
        form.setError('oidc.well_known', {
          type: 'validate',
          message: t('Well-Known URL must start with http:// or https://'),
        })
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
            well_known: wellKnown,
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

    // The server validates persisted prerequisites when enabling a provider.
    // Disable first, save its configuration, then enable only after all writes
    // succeed.
    const activationKeys = new Set<keyof FlatOAuthDefaults>([
      'oidc.enabled',
      'oidc.silent_login',
      'WeChatAuthEnabled',
    ])
    const orderedKeys = [
      ...changedKeys.filter(
        (key) => activationKeys.has(key) && normalized[key] === false
      ),
      ...changedKeys.filter((key) => !activationKeys.has(key)),
      ...changedKeys.filter(
        (key) => activationKeys.has(key) && normalized[key] === true
      ),
    ]

    for (const key of orderedKeys) {
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

  return (
    <>
      <FormNavigationGuard when={form.formState.isDirty} />

      <SettingsSection title={t('OAuth Integrations')}>
        <Form {...form}>
          <SettingsForm onSubmit={form.handleSubmit(onSubmit)}>
            <SettingsPageFormActions
              onSave={form.handleSubmit(onSubmit)}
              onReset={handleReset}
              isSaving={form.formState.isSubmitting}
              isResetDisabled={!form.formState.isDirty}
            />
            <FormDirtyIndicator isDirty={form.formState.isDirty} />

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className='grid w-full grid-cols-2'>
                <TabsTrigger value='oidc'>{t('OIDC')}</TabsTrigger>
                <TabsTrigger value='wechat'>{t('WeChat')}</TabsTrigger>
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
                      <p>
                        {t(
                          'To sign out of Casdoor when signing out here, configure the Discovery URL and register the post-logout redirect URL in Casdoor. Your Casdoor version must support logout using the browser session without an ID token.'
                        )}
                      </p>
                      <p>
                        {t(
                          'To sign out here after signing out of Casdoor, configure the Discovery URL and set the back-channel logout URL in the Casdoor application. Use an HTTPS address reachable from the Casdoor server or container; localhost is only for testing on the same host. Sign in again after updating to link the sessions.'
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
                    {
                      label: t('Post-logout redirect URL'),
                      value: `${siteUrl}/sign-in`,
                      copyLabel: t('Copy post-logout redirect URL'),
                    },
                    {
                      label: t('Back-channel logout URL'),
                      value: `${siteUrl}/api/oauth/oidc/backchannel-logout`,
                      copyLabel: t('Copy back-channel logout URL'),
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
                  name='oidc.silent_login'
                  render={({ field }) => (
                    <SettingsSwitchItem>
                      <SettingsSwitchContent>
                        <FormLabel>{t('Enable silent OIDC sign-in')}</FormLabel>
                        <FormDescription>
                          {t(
                            'Automatically sign in linked accounts when opening or refreshing this site. Requires OIDC discovery and a provider that supports silent authorization.'
                          )}{' '}
                          {t(
                            'Use HTTPS under the same parent domain for reliable silent sign-in. If cookies or embedded pages are blocked, users can still sign in manually.'
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
                <Alert className='lg:col-span-2'>
                  <AlertDescription>
                    {t(
                      'Casdoor employee profiles and the company subscription are applied only on first registration. Later sign-ins and company changes do not update profiles or grant another subscription. Configure OIDC discovery and include affiliation and properties in the signed ID token.'
                    )}
                  </AlertDescription>
                </Alert>
                <CompanyRegistrationSettings
                  form={form}
                  configs={companyRegistrationConfigs}
                  plans={plans}
                  planTitleById={planTitleById}
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
            </Tabs>
          </SettingsForm>
        </Form>
      </SettingsSection>
    </>
  )
}

function CompanyRegistrationSettings(props: {
  form: UseFormReturn<OAuthFormValues>
  configs: UseFieldArrayReturn<OAuthFormValues, 'company_registration.configs'>
  plans: PlanRecord[]
  planTitleById: Map<number, string>
}) {
  const { t } = useTranslation()
  return (
    <div className='space-y-4 rounded-md border p-4 lg:col-span-2'>
      <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
        <div className='space-y-1'>
          <FormLabel>{t('Company Registration Settings')}</FormLabel>
          <FormDescription>
            {t(
              'Match the company from Casdoor to a display name and a subscription plan for new users.'
            )}
          </FormDescription>
        </div>
        <Button
          type='button'
          variant='outline'
          onClick={() => props.configs.append(emptyCompanyRegistrationConfig())}
        >
          {t('Add Configuration')}
        </Button>
      </div>

      {props.configs.fields.length === 0 ? (
        <p className='text-muted-foreground text-sm'>
          {t('No company registration rules added')}
        </p>
      ) : null}

      <div className='space-y-4'>
        {props.configs.fields.map((item, index) => (
          <div
            key={item.id}
            className='grid gap-4 rounded-md border p-4 lg:grid-cols-2'
          >
            <FormField
              control={props.form.control}
              name={`company_registration.configs.${index}.company`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Company')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('Casdoor affiliation')}
                      autoComplete='off'
                      value={field.value ?? ''}
                      onChange={(event) => field.onChange(event.target.value)}
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
              control={props.form.control}
              name={`company_registration.configs.${index}.display_name`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Display Name')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('Display Name')}
                      autoComplete='off'
                      value={field.value ?? ''}
                      onChange={(event) => field.onChange(event.target.value)}
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
              control={props.form.control}
              name={`company_registration.configs.${index}.auto_subscribe_plan_id`}
              render={({ field }) => {
                const selectedPlanLabel = field.value
                  ? props.planTitleById.get(field.value) || t('Loading')
                  : t('No auto-subscription')

                return (
                  <FormItem>
                    <FormLabel>
                      {t('Auto-subscribe plan after registration')}
                    </FormLabel>
                    <Select
                      value={String(field.value || 0)}
                      onValueChange={(value) => field.onChange(Number(value))}
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
                        {props.plans.map((item) => (
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
                onClick={() => props.configs.remove(index)}
              >
                {t('Remove')}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
