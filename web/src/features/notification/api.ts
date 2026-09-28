import { api } from '@/lib/api'
import { requireServerSuccess } from '@/lib/server-error-message'

import {
  formatNotificationTitle,
  normalizeNotificationMessage,
} from './lib/message'
import type {
  LibraryFilters,
  LibraryKind,
  NotificationAudience,
  NotificationChannel,
  NotificationConfig,
  NotificationMessage,
  NotificationRecord,
  NotificationRetryResult,
  RecordFilters,
  SavedNotification,
  SavedNotificationSummary,
} from './types'

interface Response<T> {
  success: boolean
  message?: string
  data: T
}
const base = '/api/notification'

export async function getNotificationImage(
  url: string,
  signal: AbortSignal
): Promise<string> {
  const response = await api.get<Blob>(url, {
    responseType: 'blob',
    signal,
    disableDuplicate: true,
  })
  // TanStack Query owns cancellation and deduplication. Data URLs work with the
  // existing sanitized Markdown renderer without broadening allowed URL schemes.
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener('load', () => resolve(String(reader.result)), {
      once: true,
    })
    reader.addEventListener('error', () => reject(reader.error), { once: true })
    reader.readAsDataURL(response.data)
  })
}

export const notificationKeys = {
  all: ['notification'] as const,
  config: ['notification', 'config'] as const,
  records: ['notification', 'records'] as const,
  library: (kind: LibraryKind) => ['notification', kind] as const,
  libraryPage: (kind: LibraryKind, filters: LibraryFilters) =>
    ['notification', kind, 'list', filters] as const,
  audience: (channel: NotificationChannel, companyId: number) =>
    ['notification', 'audience', channel, companyId] as const,
  detail: (id: number) => ['notification', 'record', id] as const,
}

export async function getNotificationConfig(): Promise<NotificationConfig> {
  return requireServerSuccess(
    (await api.get<Response<NotificationConfig>>(`${base}/config`)).data
  ).data
}

export async function sendNotification(
  message: NotificationMessage,
  test: boolean
): Promise<NotificationRecord> {
  return requireServerSuccess(
    (
      await api.post<Response<NotificationRecord>>(
        `${base}/${test ? 'test' : 'send'}`,
        {
          ...normalizeNotificationMessage(message),
          // Submit exactly the title shown in the confirmation preview.
          // Templates keep the icon separate so it remains editable.
          title: formatNotificationTitle(message),
          title_icon: '',
          recipients:
            test || message.channel === 'email' ? message.recipients : [],
        },
        { timeout: 0 }
      )
    ).data
  ).data
}

export async function getNotificationAudience(
  channel: NotificationChannel,
  companyId: number
): Promise<NotificationAudience> {
  return requireServerSuccess(
    (
      await api.get<Response<NotificationAudience>>(`${base}/audience`, {
        params: { channel, company_id: companyId },
      })
    ).data
  ).data
}

export async function getRecords(
  filters: RecordFilters
): Promise<{ items: NotificationRecord[]; total: number }> {
  return requireServerSuccess(
    (
      await api.get<Response<{ items: NotificationRecord[]; total: number }>>(
        `${base}/records`,
        { params: filters }
      )
    ).data
  ).data
}

export async function getRecord(
  id: number,
  includeMessage = true
): Promise<NotificationRecord> {
  const record = requireServerSuccess(
    (
      await api.get<Response<NotificationRecord>>(`${base}/records/${id}`, {
        params: { include_message: includeMessage },
      })
    ).data
  ).data
  return {
    ...record,
    message: record.message
      ? normalizeNotificationMessage(record.message)
      : undefined,
  }
}

export async function retryRecords(
  ids: number[]
): Promise<NotificationRetryResult[]> {
  if (ids.length === 1) {
    const record = requireServerSuccess(
      (
        await api.post<Response<NotificationRecord>>(
          `${base}/records/${ids[0]}/retry`,
          undefined,
          { timeout: 0 }
        )
      ).data
    ).data
    return [
      {
        id: ids[0],
        success: record.status === 'success',
        message: record.deliveries?.find((delivery) => delivery.error)?.error,
      },
    ]
  }
  return requireServerSuccess(
    (
      await api.post<Response<NotificationRetryResult[]>>(
        `${base}/records/retry`,
        { ids },
        { timeout: 0 }
      )
    ).data
  ).data
}

export async function deleteRecords(ids: number[]): Promise<void> {
  requireServerSuccess(
    (await api.delete(`${base}/records`, { data: { ids } })).data
  )
}

export async function getLibrary(
  kind: LibraryKind,
  filters: LibraryFilters = { page: 1, page_size: 20 }
): Promise<{ items: SavedNotificationSummary[]; total: number }> {
  return requireServerSuccess(
    (
      await api.get<
        Response<{ items: SavedNotificationSummary[]; total: number }>
      >(`${base}/${kind}`, { params: filters })
    ).data
  ).data
}

export async function getLibraryEntry(
  kind: LibraryKind,
  id: number
): Promise<SavedNotification> {
  const entry = requireServerSuccess(
    (await api.get<Response<SavedNotification>>(`${base}/${kind}/${id}`)).data
  ).data
  return { ...entry, message: normalizeNotificationMessage(entry.message) }
}

export async function saveLibrary(
  kind: LibraryKind,
  value: {
    id?: number
    name: string
    message: NotificationMessage
    is_public?: boolean
  }
): Promise<SavedNotification> {
  const url = `${base}/${kind}${value.id ? `/${value.id}` : ''}`
  const body = {
    name: value.name,
    message: {
      ...normalizeNotificationMessage(value.message),
      recipients:
        value.message.channel === 'email' ? value.message.recipients : [],
    },
    is_public: value.is_public ?? false,
  }
  const response = value.id
    ? await api.put<Response<SavedNotification>>(url, body)
    : await api.post<Response<SavedNotification>>(url, body)
  return requireServerSuccess(response.data).data
}

export async function deleteLibrary(
  kind: LibraryKind,
  id: number
): Promise<void> {
  requireServerSuccess((await api.delete(`${base}/${kind}/${id}`)).data)
}
