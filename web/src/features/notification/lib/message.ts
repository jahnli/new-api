import type { TFunction } from 'i18next'
import { z } from 'zod'

import { markdownImageReferences } from '@/components/ui/markdown'

import type { NotificationMessage } from '../types'
import { NOTIFICATION_TITLE_THEMES } from './title-theme'

export const NOTIFICATION_TITLE_ICONS: readonly string[] = [
  '📢',
  '🔔',
  '📣',
  '✉️',
  '📝',
  '📌',
  '📅',
  '⏰',
  '🚀',
  '🎉',
  '🎁',
  '🏆',
  '⭐',
  '✨',
  '💡',
  '🔥',
  '✅',
  '⚠️',
  '❗',
  '🛠️',
  '🔒',
  '📋',
  '📁',
  '📂',
  '📖',
  '🗂️',
  '🗓️',
  '🔎',
  '🛡️',
  '⚙️',
  '🌐',
  '⚡',
  '💎',
  '🥇',
  '🎖️',
  '🎨',
  '🌟',
  '❤️',
  '💛',
  '👍',
  '👏',
  '🤝',
  '😊',
  '💬',
  '📍',
  '🚩',
  '❓',
  '❌',
  '🔄',
]

export function messageSchema(t: TFunction) {
  return z
    .object({
      channel: z.enum(['feishu', 'dingtalk', 'email']),
      company_id: z.number(),
      recipients: z.array(z.string()),
      title: z.string().trim().min(1, t('Title is required')),
      title_theme: z.enum(NOTIFICATION_TITLE_THEMES).optional(),
      title_icon: z
        .string()
        .refine(
          (icon) => icon === '' || NOTIFICATION_TITLE_ICONS.includes(icon),
          t('Select icon')
        )
        .optional(),
      content: z.string().trim().min(1, t('Content is required')).max(100000),
      images: z
        .array(
          z.object({
            id: z
              .string()
              .regex(/^[A-Za-z0-9_-]{1,64}$/)
              .optional(),
            filename: z.string(),
            content_type: z.string(),
            data: z.string(),
            url: z
              .string()
              .regex(
                /^\/api\/notification\/messages\/[1-9]\d*\/images\/[a-f0-9-]{36}\.(png|jpg|gif|webp)$/
              )
              .optional(),
          })
        )
        .max(10),
    })
    .superRefine((message, context) => {
      if ([...formatNotificationTitle(message)].length > 200) {
        context.addIssue({
          code: 'custom',
          path: ['title'],
          message: t('Maximum 200 characters'),
        })
      }
      if (missingNotificationImages(message).length > 0) {
        context.addIssue({
          code: 'custom',
          path: ['content'],
          message: `${t('Notification images')}: ${t('Content not found.')}`,
        })
      }
      const imageIds = message.images.flatMap((image) =>
        image.id ? [image.id] : []
      )
      if (new Set(imageIds).size !== imageIds.length) {
        context.addIssue({
          code: 'custom',
          path: ['content'],
          message: t('Notification images'),
        })
      }
      if (message.channel !== 'email' && message.company_id <= 0) {
        context.addIssue({
          code: 'custom',
          path: ['company_id'],
          message: t('Select a company'),
        })
      }
    })
}

// Pick the supported fields so historical templates cannot restore retired options.
export function normalizeNotificationMessage(
  message: NotificationMessage
): NotificationMessage {
  return {
    channel: message.channel,
    company_id: message.company_id ?? 0,
    recipients: message.recipients ?? [],
    title: message.title ?? '',
    title_icon: message.title_icon ?? '',
    title_theme: NOTIFICATION_TITLE_THEMES.includes(
      message.title_theme ?? 'blue'
    )
      ? (message.title_theme ?? 'blue')
      : 'blue',
    content: message.content ?? '',
    images: message.images ?? [],
  }
}

export function formatNotificationTitle(message: NotificationMessage): string {
  const title = message.title.trim()
  return message.title_icon ? `${message.title_icon} ${title}`.trim() : title
}

export function missingNotificationImages(
  message: NotificationMessage
): string[] {
  const sources = new Set(
    message.images
      .filter((image) => image.id)
      .map((image) => `cid:notification-image-${image.id}`)
  )
  return markdownImageReferences(message.content).filter(
    (reference) =>
      reference.startsWith('cid:notification-image-') && !sources.has(reference)
  )
}

export function splitRecipients(value: string): string[] {
  return [
    ...new Set(
      value
        .split(/[\s,;，；]+/)
        .map((item) => item.trim())
        .filter(Boolean)
    ),
  ]
}

export function notificationDate(
  value: number | string,
  locale: string | undefined
): string {
  const date = new Date(
    typeof value === 'number' && value < 1e12 ? value * 1000 : value
  )
  if (!Number.isFinite(date.getTime())) return '—'
  return date.toLocaleString(locale)
}
