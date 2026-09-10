import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { AlertTriangle, Mail, Send } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { SectionPageLayout } from '@/components/layout'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { companyQueryKeys, getCompanies } from '@/features/companies/api'
import type { Company } from '@/features/companies/types'

import { sendCompanyNotification, type CompanyNotificationResult } from './api'
import { NotificationImagePicker } from './components/notification-image-picker'
import {
  COMPANY_NOTIFICATION_DEFAULTS,
  getCompanyNotificationSchema,
  type CompanyNotificationFormValues,
} from './lib/notification-form'

function companySupportsPlatformNotifications(company: Company | undefined) {
  if (!company || company.status !== 'enabled') return false
  if (company.platform === 'feishu') {
    return Boolean(
      company.platform_credentials?.app_id &&
      company.platform_credentials.app_secret_configured
    )
  }
  if (company.platform === 'dingtalk') {
    return Boolean(
      company.platform_credentials?.client_id &&
      company.platform_credentials.client_secret_configured &&
      company.platform_credentials.agent_id
    )
  }
  return false
}

export function CompanyNotifications() {
  const { t } = useTranslation()
  const [images, setImages] = useState<File[]>([])
  const [imageError, setImageError] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pendingValues, setPendingValues] =
    useState<CompanyNotificationFormValues | null>(null)
  const [result, setResult] = useState<CompanyNotificationResult | null>(null)
  const schema = getCompanyNotificationSchema(t)
  const form = useForm<CompanyNotificationFormValues>({
    resolver: zodResolver(schema) as Resolver<CompanyNotificationFormValues>,
    defaultValues: COMPANY_NOTIFICATION_DEFAULTS,
  })

  const companiesQuery = useQuery({
    queryKey: companyQueryKeys.all,
    queryFn: async () => {
      const response = await getCompanies()
      if (!response.success) {
        throw new Error(response.message || t('Failed to load companies'))
      }
      return (response.data ?? []).filter(
        (company) => company.status === 'enabled'
      )
    },
  })

  const selectedCompanyId = form.watch('company_id')
  const testMode = form.watch('test_mode')
  const sendPlatform = form.watch('send_platform')
  const sendEmail = form.watch('send_email')
  const selectedCompany = useMemo(
    () =>
      companiesQuery.data?.find(
        (company) => String(company.id) === selectedCompanyId
      ),
    [companiesQuery.data, selectedCompanyId]
  )
  const platformAvailable =
    companySupportsPlatformNotifications(selectedCompany)
  const companyItems = (companiesQuery.data ?? []).map((company) => ({
    value: String(company.id),
    label: company.alias || company.name,
  }))

  const mutation = useMutation({
    mutationFn: async (values: CompanyNotificationFormValues) => {
      const response = await sendCompanyNotification(values, images)
      if (!response.success || !response.data) {
        throw new Error(response.message || t('Notification sending failed'))
      }
      return response.data
    },
    onSuccess: (data) => {
      setResult(data)
      setConfirmOpen(false)
      setPendingValues(null)
      if (data.failed > 0) {
        toast.warning(t('Notification completed with some failures'))
      } else {
        toast.success(t('Notification sent successfully'))
      }
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : t('Notification sending failed')
      )
    },
  })

  const submit = (values: CompanyNotificationFormValues) => {
    if (values.send_platform && !platformAvailable) {
      form.setError('send_platform', {
        message: t(
          'The selected company has no complete platform configuration'
        ),
      })
      return
    }
    setPendingValues(values)
    setConfirmOpen(true)
  }

  let platformRecipientLabel = t('Platform account IDs')
  if (selectedCompany?.platform === 'feishu') {
    platformRecipientLabel = t('Feishu Open IDs')
  } else if (selectedCompany?.platform === 'dingtalk') {
    platformRecipientLabel = t('DingTalk User IDs')
  }

  let platformDescription = t(
    'Uses the application configured for this company.'
  )
  if (sendPlatform && !selectedCompany) {
    platformDescription = t('Select a company')
  } else if (selectedCompany && platformAvailable) {
    platformDescription = t('Uses the application configured for this company.')
  } else if (selectedCompany) {
    platformDescription = t(
      'This company has no complete platform configuration.'
    )
  }

  return (
    <>
      <SectionPageLayout>
        <SectionPageLayout.Title>{t('Notifications')}</SectionPageLayout.Title>
        <SectionPageLayout.Content>
          <div className='mx-auto w-full max-w-5xl space-y-5 pb-8'>
            <p className='text-muted-foreground text-sm'>
              {t(
                'Send platform notifications and email to enabled users. Platform recipients must have an Open ID.'
              )}
            </p>
            <Form {...form}>
              <form className='grid gap-5' onSubmit={form.handleSubmit(submit)}>
                <Card>
                  <CardHeader>
                    <CardTitle>{t('Delivery settings')}</CardTitle>
                    <CardDescription>
                      {t(
                        'Choose the company application and delivery channels.'
                      )}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className='grid gap-5 md:grid-cols-2'>
                    <FormField
                      control={form.control}
                      name='send_platform'
                      render={({ field }) => (
                        <FormItem className='flex items-start justify-between gap-4 rounded-lg border p-4'>
                          <div>
                            <FormLabel>{t('Platform notification')}</FormLabel>
                            <FormDescription>
                              {platformDescription}
                            </FormDescription>
                            <FormMessage />
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={(checked) => {
                                field.onChange(checked)
                                if (!checked) {
                                  form.setValue('company_id', '', {
                                    shouldValidate: true,
                                  })
                                }
                              }}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name='send_email'
                      render={({ field }) => (
                        <FormItem className='flex items-start justify-between gap-4 rounded-lg border p-4'>
                          <div>
                            <FormLabel>{t('Email notification')}</FormLabel>
                            <FormDescription>
                              {t(
                                'Sends to enabled users with a non-empty email address.'
                              )}
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    {sendPlatform ? (
                      <FormField
                        control={form.control}
                        name='company_id'
                        render={({ field }) => (
                          <FormItem className='md:col-span-2'>
                            <FormLabel>{t('Company')}</FormLabel>
                            <Select
                              items={companyItems}
                              value={field.value}
                              onValueChange={field.onChange}
                            >
                              <FormControl>
                                <SelectTrigger className='w-full'>
                                  <SelectValue
                                    placeholder={t('Select a company')}
                                  />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent alignItemWithTrigger={false}>
                                <SelectGroup>
                                  {companyItems.map((item) => (
                                    <SelectItem
                                      key={item.value}
                                      value={item.value}
                                    >
                                      {item.label}
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    ) : null}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>{t('Test send')}</CardTitle>
                    <CardDescription>
                      {testMode
                        ? t(
                            'Only the manually entered test recipients will receive this notification.'
                          )
                        : t(
                            'All eligible enabled users will receive this notification.'
                          )}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className='space-y-5'>
                    <FormField
                      control={form.control}
                      name='test_mode'
                      render={({ field }) => (
                        <FormItem className='flex items-start justify-between gap-4 rounded-lg border p-4'>
                          <div>
                            <FormLabel>{t('Test send')}</FormLabel>
                            <FormDescription>
                              {t(
                                'Only the manually entered test recipients will receive this notification.'
                              )}
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    {testMode ? (
                      <div className='grid gap-5 md:grid-cols-2'>
                        {sendPlatform ? (
                          <FormField
                            control={form.control}
                            name='test_platform_ids'
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{platformRecipientLabel}</FormLabel>
                                <FormControl>
                                  <Textarea rows={4} {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        ) : null}
                        {sendEmail ? (
                          <FormField
                            control={form.control}
                            name='test_emails'
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>
                                  {t('Test email addresses')}
                                </FormLabel>
                                <FormControl>
                                  <Textarea
                                    rows={4}
                                    placeholder='name@example.com'
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        ) : null}
                      </div>
                    ) : null}
                  </CardContent>
                </Card>

                {!testMode && (sendPlatform || sendEmail) ? (
                  <Alert variant='destructive'>
                    <AlertTriangle aria-hidden='true' />
                    <AlertTitle>{t('All-user delivery is enabled')}</AlertTitle>
                    <AlertDescription>
                      {t(
                        'The notification will be sent to every eligible enabled user in the users table.'
                      )}
                    </AlertDescription>
                  </Alert>
                ) : null}

                <Card>
                  <CardHeader>
                    <CardTitle>{t('Notification content')}</CardTitle>
                    <CardDescription>
                      {t(
                        'Enter a plain-text title and message, then optionally attach images.'
                      )}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className='space-y-5'>
                    <FormField
                      control={form.control}
                      name='title'
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('Title')}</FormLabel>
                          <FormControl>
                            <Input maxLength={200} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name='content'
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('Content')}</FormLabel>
                          <FormControl>
                            <Textarea rows={10} maxLength={5000} {...field} />
                          </FormControl>
                          <FormDescription>
                            {t('Plain text, up to 5000 characters.')}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div>
                      <FormLabel>{t('Images')}</FormLabel>
                      <div className='mt-2'>
                        <NotificationImagePicker
                          files={images}
                          onChange={setImages}
                          onError={setImageError}
                        />
                      </div>
                      {imageError ? (
                        <p className='text-destructive mt-2 text-sm'>
                          {imageError}
                        </p>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>

                {result ? (
                  <Alert
                    variant={result.failed > 0 ? 'destructive' : 'default'}
                  >
                    <Mail aria-hidden='true' />
                    <AlertTitle>{t('Latest delivery result')}</AlertTitle>
                    <AlertDescription className='space-y-2'>
                      <p>
                        {t(
                          'Total: {{total}}, succeeded: {{success}}, failed: {{failed}}, skipped: {{skipped}}',
                          result
                        )}
                      </p>
                      {result.failures.map((failure) => (
                        <p key={`${failure.channel}-${failure.reason}`}>
                          {t('{{channel}}: {{reason}} ({{count}})', failure)}
                        </p>
                      ))}
                    </AlertDescription>
                  </Alert>
                ) : null}

                <div className='flex justify-end'>
                  <Button type='submit' size='lg' disabled={mutation.isPending}>
                    {mutation.isPending ? (
                      <Spinner aria-hidden='true' />
                    ) : (
                      <Send aria-hidden='true' />
                    )}
                    {testMode
                      ? t('Review test send')
                      : t('Review all-user send')}
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        </SectionPageLayout.Content>
      </SectionPageLayout>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={(open) => !mutation.isPending && setConfirmOpen(open)}
        title={testMode ? t('Confirm test send') : t('Confirm all-user send')}
        desc={
          testMode
            ? t('Send this notification to the entered test recipients?')
            : t(
                'Send this notification to all eligible enabled users? This action cannot be undone.'
              )
        }
        confirmText={testMode ? t('Send test') : t('Send to all users')}
        destructive={!testMode}
        isLoading={mutation.isPending}
        handleConfirm={() => {
          if (pendingValues) mutation.mutate(pendingValues)
        }}
      />
    </>
  )
}
