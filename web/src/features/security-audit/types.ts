/** Mirrors backend model.OffHoursDayRow */
export interface OffHoursDayRow {
  date: string
  /** Audit window bounds (unix seconds, end exclusive) for detail drill-down */
  window_start: number
  window_end: number
  /** Earliest / latest request inside the window (unix seconds) */
  start_time: number
  end_time: number
  models: string[]
  ips: string[]
  count: number
  quota: number
}

/** Mirrors backend model.OffHoursUserRow */
export interface OffHoursUserRow {
  user_id: number
  username: string
  display_name: string
  avatar_url: string
  days: number
  models: string[]
  ips: string[]
  count: number
  quota: number
  day_rows: OffHoursDayRow[]
}

export interface GetOffHoursUsageParams {
  p?: number
  page_size?: number
  start_timestamp?: number
  end_timestamp?: number
  username?: string
}

export interface GetOffHoursUsageResponse {
  success: boolean
  message?: string
  data?: {
    items: OffHoursUserRow[] | null
    total: number
    page: number
    page_size: number
  }
}

export interface NotifyOffHoursViolationRequest {
  user_id: number
  start_time: number
  end_time: number
  request_count: number
}

export interface NotifyOffHoursViolationResponse {
  success: boolean
  message?: string
}

export interface SecurityAuditSetting {
  off_hours: {
    enabled: boolean
    start_hour: number
    end_hour: number
  }
  image_studio: boolean
}

export interface GetSecurityAuditSettingResponse {
  success: boolean
  message?: string
  data?: SecurityAuditSetting
}

/** Tree row rendered by the off-hours table: user rows expand into day rows. */
export interface AuditRow {
  id: string
  kind: 'user' | 'day'
  user: OffHoursUserRow
  day?: OffHoursDayRow
  children?: AuditRow[]
}

/** Target of the day-level detail dialog. */
export interface OffHoursDetailTarget {
  userId: number
  username: string
  displayName: string
  avatarUrl?: string
  date: string
  windowStart: number
  windowEnd: number
  requestStart: number
  requestEnd: number
  requestCount: number
}

/** Mirrors backend model.ImageStudioAsset */
export interface ImageAuditAsset {
  id: string
  url: string
  mime_type: string
  size_bytes: number
  width?: number
  height?: number
  revised_prompt?: string
}

/** Mirrors backend model.ImageStudioAuditItem */
export interface ImageAuditItem {
  id: string
  user_id: number
  username: string
  display_name: string
  avatar_url: string
  /** Unix milliseconds */
  created_at: number
  updated_at: number
  mode: 'generate' | 'edit' | string
  prompt: string
  model: string
  group: string
  size: string
  quality?: string
  moderation?: string
  output_format?: string
  n: number
  duration_ms: number
  quota?: number
  prompt_tokens?: number
  completion_tokens?: number
  user_agent?: string
  channel_id?: number
  channel_name?: string
  favorite: boolean
  images: ImageAuditAsset[]
}

export interface GetImageAuditParams {
  p?: number
  page_size?: number
  start_timestamp?: number
  end_timestamp?: number
  username?: string
}

export interface GetImageAuditResponse {
  success: boolean
  message?: string
  data?: {
    items: ImageAuditItem[] | null
    total: number
    page: number
    page_size: number
  }
}

/** Image opened in the audit lightbox: a generation record plus the image index. */
export interface ImageAuditPreviewTarget {
  item: ImageAuditItem
  index: number
}
