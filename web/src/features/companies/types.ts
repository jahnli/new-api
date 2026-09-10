import { z } from 'zod'

export const companyPlatformSchema = z.enum(['none', 'feishu', 'dingtalk'])
export type CompanyPlatform = z.infer<typeof companyPlatformSchema>

export const companyStatusSchema = z.enum(['enabled', 'disabled'])
export type CompanyStatus = z.infer<typeof companyStatusSchema>

export const companyLoginMethodSchema = z.enum(['password', 'ldap', 'platform'])
export type CompanyLoginMethod = z.infer<typeof companyLoginMethodSchema>

export const companyCredentialsSchema = z.object({
  app_id: z.string().optional(),
  client_id: z.string().optional(),
  agent_id: z.number().optional(),
  app_secret_configured: z.boolean().optional().default(false),
  client_secret_configured: z.boolean().optional().default(false),
})
export type CompanyCredentials = z.infer<typeof companyCredentialsSchema>

export const companySchema = z.object({
  id: z.number(),
  name: z.string(),
  alias: z.string(),
  platform: companyPlatformSchema,
  status: companyStatusSchema,
  sort_order: z.number(),
  login_methods: z.array(companyLoginMethodSchema),
  platform_credentials: companyCredentialsSchema.optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
})
export type Company = z.infer<typeof companySchema>

export type ApiResponse<T = unknown> = {
  success: boolean
  message?: string
  data?: T
}
