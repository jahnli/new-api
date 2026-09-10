import { api } from '@/lib/api'

import type { CompanyFormValues } from './lib/company-form'
import type {
  ApiResponse,
  Company,
  CompanyLoginMethod,
  CompanyPlatform,
  CompanyStatus,
} from './types'

// RootAuth API contract assumptions are intentionally isolated in this file.
// The backend is expected to protect these routes, use the standard response
// envelope, and return configured flags instead of secret values.
const ROOT_COMPANIES_API = '/api/company/'

export const companyQueryKeys = {
  all: ['root-companies'] as const,
}

type CompanyApiRecord = {
  id: number
  name: string
  alias: string
  platform: CompanyPlatform
  status: CompanyStatus
  sort_order: number
  config: {
    login_methods: CompanyLoginMethod[]
    feishu: {
      app_id: string
      configured: boolean
    }
    dingtalk: {
      client_id: string
      agent_id: number
      configured: boolean
    }
  }
  created_at?: string
  updated_at?: string
}

type CompanyWriteRequest = {
  name: string
  alias: string
  platform: CompanyPlatform
  status: CompanyStatus
  sort_order: number
  config: {
    login_methods: CompanyLoginMethod[]
    feishu: {
      app_id: string
      app_secret: string
    }
    dingtalk: {
      client_id: string
      client_secret: string
      agent_id: number
    }
  }
}

function buildCompanyRequest(values: CompanyFormValues): CompanyWriteRequest {
  return {
    name: values.name.trim(),
    alias: values.alias.trim(),
    platform: values.platform,
    status: values.status,
    sort_order: Number(values.sort_order),
    config: {
      login_methods: values.login_methods,
      feishu: {
        app_id: values.feishu_app_id.trim(),
        app_secret: values.feishu_app_secret.trim(),
      },
      dingtalk: {
        client_id: values.dingtalk_client_id.trim(),
        client_secret: values.dingtalk_client_secret.trim(),
        agent_id: Number(values.dingtalk_agent_id),
      },
    },
  }
}

function normalizeCompany(record: CompanyApiRecord): Company {
  return {
    id: record.id,
    name: record.name,
    alias: record.alias,
    platform: record.platform,
    status: record.status,
    sort_order: record.sort_order,
    login_methods: record.config.login_methods,
    platform_credentials: {
      app_id: record.config.feishu.app_id,
      client_id: record.config.dingtalk.client_id,
      agent_id: record.config.dingtalk.agent_id,
      app_secret_configured: record.config.feishu.configured,
      client_secret_configured: record.config.dingtalk.configured,
    },
    created_at: record.created_at,
    updated_at: record.updated_at,
  }
}

export async function getCompanies(): Promise<ApiResponse<Company[]>> {
  const firstResponse = await api.get<
    ApiResponse<{ items: CompanyApiRecord[]; total: number; page_size: number }>
  >(ROOT_COMPANIES_API, { params: { p: 1, page_size: 100 } })
  if (!firstResponse.data.success || !firstResponse.data.data) {
    return { ...firstResponse.data, data: [] }
  }
  const records = [...firstResponse.data.data.items]
  const pageCount = Math.ceil(
    firstResponse.data.data.total / firstResponse.data.data.page_size
  )
  if (pageCount > 1) {
    const remainingResponses = await Promise.all(
      Array.from({ length: pageCount - 1 }, (_, index) =>
        api.get<ApiResponse<{ items: CompanyApiRecord[] }>>(
          ROOT_COMPANIES_API,
          { params: { p: index + 2, page_size: 100 } }
        )
      )
    )
    for (const response of remainingResponses) {
      if (!response.data.success || !response.data.data) {
        return { ...response.data, data: [] }
      }
      records.push(...response.data.data.items)
    }
  }
  return {
    ...firstResponse.data,
    data: records.map(normalizeCompany),
  }
}

export async function createCompany(
  values: CompanyFormValues
): Promise<ApiResponse<Company>> {
  const response = await api.post<ApiResponse<CompanyApiRecord>>(
    ROOT_COMPANIES_API,
    buildCompanyRequest(values)
  )
  return {
    ...response.data,
    data: response.data.data ? normalizeCompany(response.data.data) : undefined,
  }
}

export async function updateCompany(
  id: number,
  values: CompanyFormValues
): Promise<ApiResponse<Company>> {
  const response = await api.put<ApiResponse<CompanyApiRecord>>(
    `${ROOT_COMPANIES_API}${id}`,
    buildCompanyRequest(values)
  )
  return {
    ...response.data,
    data: response.data.data ? normalizeCompany(response.data.data) : undefined,
  }
}

export async function updateCompanyStatus(
  id: number,
  status: CompanyStatus
): Promise<ApiResponse<Company>> {
  const response = await api.patch<ApiResponse<CompanyApiRecord>>(
    `${ROOT_COMPANIES_API}${id}/status`,
    { status }
  )
  return {
    ...response.data,
    data: response.data.data ? normalizeCompany(response.data.data) : undefined,
  }
}

export type CompanyConnectionResult = {
  connected: boolean
  platform: CompanyPlatform
  organization_name?: string
  name_matched?: boolean
}

export async function testCompanyConnection(
  id: number
): Promise<ApiResponse<CompanyConnectionResult>> {
  const response = await api.post<ApiResponse<CompanyConnectionResult>>(
    `${ROOT_COMPANIES_API}${id}/test`
  )
  return response.data
}
