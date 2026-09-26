import type { NotificationTitleTheme } from './lib/title-theme'

export type NotificationChannel = 'feishu' | 'dingtalk' | 'email'
export type NotificationStatus =
  | 'queued'
  | 'sending'
  | 'success'
  | 'failed'
  | 'partial'
  | 'unknown'

export interface NotificationImage {
  id?: string
  filename: string
  content_type: string
  data: string
}

export interface NotificationMessage {
  channel: NotificationChannel
  company_id: number
  recipients: string[]
  title: string
  title_icon?: string
  title_theme?: NotificationTitleTheme
  content: string
  images: NotificationImage[]
}

export interface NotificationConfig {
  companies: { id: number; name: string; platform: string }[]
  can_send: boolean
}

export interface NotificationAudience {
  total_users: number
  recipient_count: number
  missing_ids: number
  invalid_ids: number
  duplicate_ids: number
}

export interface NotificationDelivery {
  id: number
  recipient: string
  status: NotificationStatus
  error: string
  message_id: string
  attempts: number
}

export interface NotificationRecord {
  id: number
  user_id: number
  sender_name: string
  display_name?: string
  avatar_url?: string
  open_id?: string
  gender?: number
  channel: NotificationChannel
  title: string
  status: NotificationStatus
  total: number
  success_count: number
  failed_count: number
  unknown_count: number
  summary?: string
  is_test: boolean
  created_at: number | string
  updated_at: number | string
  message?: NotificationMessage
  deliveries?: NotificationDelivery[]
}

export interface SavedNotification {
  id: number
  name: string
  message: NotificationMessage
  updated_at: number | string
  is_public?: boolean
  user_id?: number
}

export type SavedNotificationSummary = Omit<SavedNotification, 'message'> & {
  channel: NotificationChannel
  summary: string
}

export interface NotificationRetryResult {
  id: number
  success: boolean
  message?: string
}

export interface RecordFilters {
  page: number
  page_size: number
  channel?: string
  status?: string
  keyword?: string
  sender?: string
  from?: string
  to?: string
  include_tests?: boolean
}

export type LibraryKind = 'templates'

export interface LibraryFilters {
  page: number
  page_size: number
  keyword?: string
  scope?: 'all' | 'personal' | 'public'
}

export const EMPTY_MESSAGE: NotificationMessage = {
  channel: 'feishu',
  company_id: 0,
  recipients: [],
  title: '',
  title_icon: '📢',
  title_theme: 'blue',
  content: '',
  images: [],
}
