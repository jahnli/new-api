import { CircleAlert, Mail, MessageSquare, Users } from 'lucide-react'
import type { UseFormReturn } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { TextTooltip } from '@/components/text-tooltip'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { toIntlLocale } from '@/i18n/languages'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'

import { splitRecipients } from '../lib/message'
import { NOTIFICATION_TITLE_THEME_CLASSES } from '../lib/title-theme'
import type {
  NotificationChannel,
  NotificationConfig,
  NotificationMessage,
} from '../types'
import { TitleIconPicker } from './title-icon-picker'

export function DeliverySettings(props: {
  form: UseFormReturn<NotificationMessage>
  config: NotificationConfig
}) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const channel = props.form.watch('channel')
  const titleIcon = props.form.watch('title_icon')
  const companies = props.config.companies
    .filter((company) => company.platform === channel)
    .map((company) => ({ value: String(company.id), label: company.name }))
  const channels = [
    { value: 'feishu' as const, label: t('Feishu'), icon: MessageSquare },
    { value: 'dingtalk' as const, label: t('DingTalk'), icon: MessageSquare },
    { value: 'email' as const, label: t('Email'), icon: Mail },
  ]
  const titleThemes = [
    { value: 'blue', label: t('Blue') },
    { value: 'wathet', label: t('Light blue') },
    { value: 'turquoise', label: t('Turquoise') },
    { value: 'green', label: t('Green') },
    { value: 'yellow', label: t('Yellow') },
    { value: 'orange', label: t('Orange') },
    { value: 'red', label: t('Red') },
    { value: 'carmine', label: t('Carmine') },
    { value: 'violet', label: t('Violet') },
    { value: 'purple', label: t('Purple') },
    { value: 'indigo', label: t('Indigo') },
    { value: 'grey', label: t('Grey') },
    { value: 'default', label: t('Default') },
  ] as const

  const changeChannel = (next: NotificationChannel) => {
    if (next === channel) return
    props.form.setValue('channel', next, { shouldDirty: true })
    props.form.setValue('company_id', 0, { shouldDirty: true })
    props.form.setValue('recipients', [], { shouldDirty: true })
    props.form.clearErrors()
  }

  const titleIconPicker = (
    <FormField
      control={props.form.control}
      name='title_icon'
      render={({ field }) => (
        <FormItem>
          <FormControl>
            <TitleIconPicker
              ref={field.ref}
              value={field.value ?? ''}
              onChange={field.onChange}
              onBlur={field.onBlur}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )

  return (
    <Card data-card-hover='false' className='gap-2 shadow-none'>
      <CardHeader>
        <div className='flex items-center gap-2'>
          <Users className='text-primary size-4' />
          <CardTitle className='text-base'>{t('Delivery settings')}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className='space-y-5'>
        <div
          className='bg-muted/50 grid grid-cols-3 gap-1 rounded-xl p-1'
          aria-label={t('Channel')}
        >
          {channels.map((item) => (
            <Button
              key={item.value}
              type='button'
              variant={channel === item.value ? 'secondary' : 'ghost'}
              className={
                channel === item.value
                  ? 'bg-background shadow-sm'
                  : 'text-muted-foreground'
              }
              onClick={() => changeChannel(item.value)}
              aria-pressed={channel === item.value}
            >
              <item.icon
                className='hidden size-4 sm:block'
                aria-hidden='true'
              />
              {item.label}
            </Button>
          ))}
        </div>
        <div className='grid gap-5 md:grid-cols-[minmax(0,2fr)_minmax(0,8fr)]'>
          {channel !== 'email' && (
            <FormField
              control={props.form.control}
              name='company_id'
              render={({ field }) => (
                <FormItem>
                  <div className='flex items-center gap-1'>
                    <FormLabel>{t('Company')}</FormLabel>
                    <TextTooltip
                      content={t(
                        'Official notifications reach all users with a valid Open ID in the user table, regardless of company. Blank or invalid IDs are skipped and duplicate IDs receive one message.'
                      )}
                      contentClassName='max-w-xs text-sm leading-relaxed sm:max-w-sm'
                    >
                      <Button
                        type='button'
                        variant='ghost'
                        size='icon-sm'
                        className='text-muted-foreground hover:text-primary'
                        aria-label={t('All users')}
                      >
                        <CircleAlert className='size-4' aria-hidden='true' />
                      </Button>
                    </TextTooltip>
                  </div>
                  <Select
                    items={companies}
                    value={field.value ? String(field.value) : ''}
                    onValueChange={(value) => field.onChange(Number(value))}
                  >
                    <FormControl>
                      <SelectTrigger className='w-full'>
                        <SelectValue placeholder={t('Select a company')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent alignItemWithTrigger={false}>
                      <SelectGroup>
                        {companies.map((company) => (
                          <SelectItem key={company.value} value={company.value}>
                            {company.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
          {channel === 'email' && (
            <FormField
              control={props.form.control}
              name='recipients'
              render={({ field }) => (
                <FormItem className='md:col-span-2'>
                  <FormLabel>
                    {t('Email addresses')}
                    <Badge variant='secondary'>
                      {formatNumber(field.value.length, locale)}
                    </Badge>
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      key={channel}
                      defaultValue={field.value.join('\n')}
                      onChange={(event) =>
                        field.onChange(splitRecipients(event.target.value))
                      }
                      onBlur={field.onBlur}
                      className='min-h-20 font-mono text-sm'
                      placeholder={t(
                        'Separate email addresses with commas or new lines.'
                      )}
                    />
                  </FormControl>
                  <p className='text-muted-foreground text-xs'>
                    {t(
                      'Official email notifications are sent only to these addresses. Test recipients are entered separately.'
                    )}
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
          <FormField
            control={props.form.control}
            name='title'
            render={({ field }) => (
              <FormItem className={cn(channel === 'email' && 'md:col-span-2')}>
                <div className='flex min-h-8 items-center justify-between gap-2'>
                  <FormLabel>{t('Title')}</FormLabel>
                  {!titleIcon && titleIconPicker}
                </div>
                <InputGroup>
                  {titleIcon && (
                    <InputGroupAddon className='h-full w-8 shrink-0 p-0'>
                      {titleIconPicker}
                    </InputGroupAddon>
                  )}
                  <FormControl>
                    <InputGroupInput
                      {...field}
                      maxLength={200}
                      placeholder={t('Give your message a clear title')}
                      className='placeholder:text-muted-foreground/60'
                    />
                  </FormControl>
                  {channel === 'feishu' && (
                    <InputGroupAddon
                      align='inline-end'
                      className='h-full max-w-[45%] shrink-0 py-0 pr-0'
                    >
                      <FormField
                        control={props.form.control}
                        name='title_theme'
                        render={({ field: themeField }) => (
                          <FormItem className='min-w-0 gap-0'>
                            <FormLabel className='sr-only'>
                              {t('Title theme')}
                            </FormLabel>
                            <Select
                              items={titleThemes}
                              value={themeField.value ?? 'blue'}
                              onValueChange={themeField.onChange}
                            >
                              <FormControl>
                                <SelectTrigger
                                  className='h-7 w-auto max-w-full gap-1.5 rounded-l-none border-0 border-l bg-transparent px-2 shadow-none dark:bg-transparent'
                                  onBlur={themeField.onBlur}
                                  ref={themeField.ref}
                                >
                                  <span
                                    aria-hidden='true'
                                    className={cn(
                                      'size-3 shrink-0 rounded border',
                                      NOTIFICATION_TITLE_THEME_CLASSES[
                                        themeField.value ?? 'blue'
                                      ]
                                    )}
                                  />
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent
                                align='end'
                                alignItemWithTrigger={false}
                              >
                                <SelectGroup>
                                  {titleThemes.map((theme) => (
                                    <SelectItem
                                      key={theme.value}
                                      value={theme.value}
                                    >
                                      <span
                                        aria-hidden='true'
                                        className={cn(
                                          'size-4 shrink-0 rounded border',
                                          NOTIFICATION_TITLE_THEME_CLASSES[
                                            theme.value
                                          ]
                                        )}
                                      />
                                      {theme.label}
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </InputGroupAddon>
                  )}
                </InputGroup>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </CardContent>
    </Card>
  )
}
