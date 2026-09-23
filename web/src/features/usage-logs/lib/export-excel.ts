import axios from 'axios'

import i18n from '@/i18n/config'
import { api } from '@/lib/api'
import dayjs from '@/lib/dayjs'
import {
  createServerError,
  requireServerSuccess,
} from '@/lib/server-error-message'

import type { FetchLogsConfig } from '../types'
import { buildApiParams, buildQueryParams } from './utils'

export async function exportUsageLogs(
  config: Pick<
    FetchLogsConfig,
    'canManageScope' | 'isAdmin' | 'selfUsername' | 'searchParams'
  >,
  signal: AbortSignal
): Promise<number> {
  const params = buildApiParams({
    ...config,
    page: 1,
    pageSize: 100,
    isAdmin: config.canManageScope,
  })
  params.p = undefined
  params.page_size = undefined
  const query = buildQueryParams({
    ...params,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  })
  const endpoint = config.isAdmin ? '/api/log/export' : '/api/log/self/export'
  const response = await api
    .get<Blob>(`${endpoint}?${query}`, {
      responseType: 'blob',
      signal,
      timeout: 11 * 60 * 1000,
      disableDuplicate: true,
    })
    .catch(async (error: unknown) => {
      if (
        axios.isAxiosError(error) &&
        error.response?.data instanceof Blob &&
        error.response.data.type.includes('application/json')
      ) {
        const payload: unknown = JSON.parse(await error.response.data.text())
        throw createServerError(payload)
      }
      throw error
    })
  if (response.status === 204) return 0
  if (response.data.type.includes('application/json')) {
    const payload: unknown = JSON.parse(await response.data.text())
    requireServerSuccess(payload)
    throw new Error(i18n.t('Export failed'))
  }
  if (
    !response.data.type.includes(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
  ) {
    throw new Error(i18n.t('Export failed'))
  }
  const count = Number(response.headers['x-export-count'])
  if (!Number.isSafeInteger(count) || count <= 0) {
    throw new Error(i18n.t('Export failed'))
  }
  signal.throwIfAborted()
  const url = URL.createObjectURL(response.data)
  const anchor = document.createElement('a')
  anchor.href = url
  const startLabel =
    params.start_timestamp == null
      ? ''
      : dayjs.unix(params.start_timestamp).format('YYYY-MM-DD_HH-mm-ss')
  const endLabel =
    params.end_timestamp == null
      ? ''
      : dayjs.unix(params.end_timestamp).format('YYYY-MM-DD_HH-mm-ss')
  anchor.download = `${i18n.t('Usage Logs', { lng: 'zhCN' })}_${startLabel}~${endLabel}.xlsx`
  document.body.appendChild(anchor)
  try {
    anchor.click()
  } finally {
    anchor.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return count
}
