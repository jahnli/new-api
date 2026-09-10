import type { TFunction } from 'i18next'
import { z } from 'zod'

export const MAX_NOTIFICATION_IMAGES = 5
export const MAX_NOTIFICATION_IMAGE_BYTES = 5 * 1024 * 1024
export const NOTIFICATION_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]

export function splitNotificationRecipients(value: string): string[] {
  return [...new Set(value.split(/[\n,;]+/).map((item) => item.trim()))].filter(
    Boolean
  )
}

export function getCompanyNotificationSchema(t: TFunction) {
  return z
    .object({
      company_id: z.string(),
      send_platform: z.boolean(),
      send_email: z.boolean(),
      test_mode: z.boolean(),
      title: z
        .string()
        .trim()
        .min(1, t('Notification title is required'))
        .max(200, t('Notification title must not exceed 200 characters')),
      content: z
        .string()
        .trim()
        .min(1, t('Notification content is required'))
        .max(5000, t('Notification content must not exceed 5000 characters')),
      test_platform_ids: z.string(),
      test_emails: z.string(),
    })
    .superRefine((values, context) => {
      if (!values.send_platform && !values.send_email) {
        context.addIssue({
          code: 'custom',
          path: ['send_platform'],
          message: t('Select at least one notification channel'),
        })
      }
      if (values.send_platform && !values.company_id) {
        context.addIssue({
          code: 'custom',
          path: ['company_id'],
          message: t('Select a company'),
        })
      }
      if (!values.test_mode) return
      if (
        values.send_platform &&
        splitNotificationRecipients(values.test_platform_ids).length === 0
      ) {
        context.addIssue({
          code: 'custom',
          path: ['test_platform_ids'],
          message: t('Enter at least one platform account ID'),
        })
      }
      const emails = splitNotificationRecipients(values.test_emails)
      if (values.send_email && emails.length === 0) {
        context.addIssue({
          code: 'custom',
          path: ['test_emails'],
          message: t('Enter at least one test email address'),
        })
      }
      if (
        values.send_email &&
        emails.some((email) => !z.string().email().safeParse(email).success)
      ) {
        context.addIssue({
          code: 'custom',
          path: ['test_emails'],
          message: t('Enter valid email addresses'),
        })
      }
    })
}

export type CompanyNotificationFormValues = z.infer<
  ReturnType<typeof getCompanyNotificationSchema>
>

export const COMPANY_NOTIFICATION_DEFAULTS: CompanyNotificationFormValues = {
  company_id: '',
  send_platform: false,
  send_email: false,
  test_mode: false,
  title: '',
  content: '',
  test_platform_ids: '',
  test_emails: '',
}
