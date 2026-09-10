import ExcelJS from 'exceljs'
import { t } from 'i18next'

import dayjs from '@/lib/dayjs'
import { calculateUnitPricePer100MTokens } from '@/lib/unit-price'

import type {
  CostBucket,
  DepartmentStat,
  DepartmentUser,
  DeptTreeNode,
  SubDepartmentStat,
  UsageAnalysis,
  UserRankingItem,
} from '../types'
import {
  renderChartToBase64,
  buildSubDeptBarSpec,
  buildSubDeptPieSpec,
  buildCostBucketDistributionSpec,
  buildCostTrendSpec,
  buildRequestTrendSpec,
  buildTokenTrendSpec,
  buildModelUsageTrendSpec,
  buildModelCallDistributionSpec,
  buildModelCostRankSpec,
  buildUserRankBarSpec,
  buildUserRankPieSpec,
} from './chart-to-image'
import {
  getDepartmentRegistrationStatusLabel,
  getDepartmentUserRegistrationStatus,
  isDepartmentUserRegistered,
} from './registration-status'

function fmtCny(value: number): string {
  if (value === 0) return '¥0.00'
  return `¥${value.toFixed(2)}`
}

function fmtTokens(tokens: number): string {
  if (tokens === 0) return '0'
  if (tokens >= 1_0000_0000) return `${(tokens / 1_0000_0000).toFixed(2)} 亿`
  if (tokens >= 1_0000) return `${(tokens / 1_0000).toFixed(2)} 万`
  return tokens.toLocaleString()
}

function fmtRequests(count: number): string {
  if (count >= 1_0000) return `${(count / 1_0000).toFixed(2)} 万`
  return count.toLocaleString()
}

function fmtUnitPrice(cost: number, tokens: number): string {
  if (cost <= 0 || tokens <= 0) return '-'
  return `${fmtCny(calculateUnitPricePer100MTokens(cost, tokens))}/${t('100M Tokens')}`
}

export function formatTimeRangeForFilename(
  startTs: number,
  endTs: number
): string {
  if (!startTs && !endTs) return dayjs().format('YYYY-MM-DD')

  const s = dayjs.unix(startTs)
  const e = dayjs.unix(endTs)
  const sameDay = s.isSame(e, 'day')
  const startMidnight = s.hour() === 0 && s.minute() === 0
  const endEod = e.hour() === 23 && e.minute() >= 59

  if (sameDay) {
    if (startMidnight && endEod) return s.format('YYYY-MM-DD')
    return `${s.format('YYYY-MM-DD HH:mm')}~${e.format('HH:mm')}`
  }
  if (startMidnight && endEod) {
    return `${s.format('YYYY-MM-DD')}~${e.format('YYYY-MM-DD')}`
  }
  return `${s.format('YYYY-MM-DD HH:mm')}~${e.format('YYYY-MM-DD HH:mm')}`
}

export function sanitizeSheetName(name: string): string {
  let s = name.replaceAll(/[/\\?*[\]]/g, '').trim()
  if (s.length > 31) s = s.slice(0, 31)
  return s || 'Sheet'
}

function getRequiredWorksheet(
  wb: ExcelJS.Workbook,
  name: string
): ExcelJS.Worksheet {
  const ws = wb.getWorksheet(name)
  if (!ws) {
    throw new Error(`Worksheet not found: ${name}`)
  }
  return ws
}

function ensureUniqueSheetNames(names: string[]): string[] {
  const seen = new Map<string, number>()
  return names.map((raw) => {
    const base = sanitizeSheetName(raw)
    const count = seen.get(base) ?? 0
    seen.set(base, count + 1)
    if (count === 0) return base
    const suffix = ` (${count})`
    return base.slice(0, 31 - suffix.length) + suffix
  })
}

export function findNodeByValue(
  nodes: DeptTreeNode[],
  value: string
): DeptTreeNode | null {
  for (const node of nodes) {
    if (node.value === value) return node
    const found = findNodeByValue(node.children, value)
    if (found) return found
  }
  return null
}

// ── Style constants ───────────────────────────────────

const TITLE_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF126DF5' },
}
const TITLE_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  color: { argb: 'FFFFFFFF' },
  size: 14,
}
const SECTION_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFF0F5FF' },
}
const SECTION_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  color: { argb: 'FF126DF5' },
  size: 11,
}
const TABLE_HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFF7F8FA' },
}
const TABLE_HEADER_BORDER: Partial<ExcelJS.Borders> = {
  bottom: { style: 'thin', color: { argb: 'FFD6E4F0' } },
}

function styleTitleRow(
  ws: ExcelJS.Worksheet,
  text: string,
  colSpan: number
): void {
  const row = ws.addRow([text])
  const cell = row.getCell(1)
  cell.font = TITLE_FONT
  cell.fill = TITLE_FILL
  cell.alignment = { vertical: 'middle', horizontal: 'center' }
  if (colSpan > 1) ws.mergeCells(row.number, 1, row.number, colSpan)
  row.height = 30
}

function styleHeaderRow(row: ExcelJS.Row): void {
  row.eachCell((cell) => {
    cell.fill = TABLE_HEADER_FILL
    cell.font = { bold: true, size: 11 }
    cell.border = TABLE_HEADER_BORDER
    cell.alignment = { vertical: 'middle', horizontal: 'left' }
  })
  row.height = 22
}

function styleDataRow(row: ExcelJS.Row, _alt: boolean): void {
  row.eachCell((cell) => {
    cell.alignment = { vertical: 'middle', horizontal: 'left' }
  })
}

function addSectionTitle(
  ws: ExcelJS.Worksheet,
  title: string,
  colSpan: number
): void {
  ws.addRow([])
  const row = ws.addRow([title])
  const cell = row.getCell(1)
  cell.font = SECTION_FONT
  cell.fill = SECTION_FILL
  cell.alignment = { vertical: 'middle' }
  if (colSpan > 1) ws.mergeCells(row.number, 1, row.number, colSpan)
  row.height = 22
}

function addStatsTable(ws: ExcelJS.Worksheet, stat: DepartmentStat): void {
  const hdr = ws.addRow([t('Metric'), t('Value')])
  styleHeaderRow(hdr)

  const rows: [string, string][] = [
    [t('Total Tokens'), fmtTokens(stat.total_tokens)],
    [t('Uncached Input'), fmtTokens(stat.uncached_input_tokens ?? 0)],
    [t('Uncached Output'), fmtTokens(stat.uncached_output_tokens ?? 0)],
    [t('Cache Read'), fmtTokens(stat.cache_read_tokens ?? 0)],
    [t('Cache Write'), fmtTokens(stat.cache_write_tokens ?? 0)],
    [t('Total Cost'), fmtCny(stat.total_amount_cny)],
    [
      `${t('Unit Price')}/${t('100M Tokens')}`,
      !stat.unit_price_per_100m_tokens
        ? '¥0.00'
        : fmtCny(stat.unit_price_per_100m_tokens),
    ],
    [t('Total Requests'), fmtRequests(stat.total_requests)],
    [t('Avg Response Time'), `${(stat.avg_use_time ?? 0).toFixed(1)}s`],
    [t('Registered Count'), (stat.registered_users ?? 0).toLocaleString()],
    [t('Unregistered Count'), (stat.unregistered_users ?? 0).toLocaleString()],
    [
      t('Active Users / Active Rate'),
      `${(stat.active_users ?? 0).toLocaleString()} / ${(stat.active_user_rate ?? 0).toFixed(1)}%`,
    ],
    [
      t('Cost >10 Users / Share'),
      `${(stat.high_cost_users ?? 0).toLocaleString()} / ${(stat.high_cost_user_rate ?? 0).toFixed(1)}%`,
    ],
    [
      t('Tokens per Active User'),
      fmtTokens((stat.avg_tokens_per_active_user_mt ?? 0) * 1_000_000),
    ],
    [t('Error Rate'), `${(stat.error_rate ?? 0).toFixed(1)}%`],
  ]
  rows.forEach(([label, value], i) => {
    const r = ws.addRow([label, value])
    styleDataRow(r, i % 2 === 1)
    r.getCell(1).font = { bold: true }
  })
}

// ── Sheet builders ────────────────────────────────────

function buildMainSheet(wb: ExcelJS.Workbook, p: ExportParams): void {
  const ws = wb.addWorksheet(t('Data Overview'))

  const timeRange = formatTimeRangeForFilename(p.startTimestamp, p.endTimestamp)
  styleTitleRow(
    ws,
    `${t('Data Overview')} — ${p.departmentName}（${timeRange}）`,
    9
  )
  ws.addRow([])

  ws.getColumn(1).width = 28
  ws.getColumn(2).width = 16
  ws.getColumn(3).width = 14
  ws.getColumn(4).width = 14
  ws.getColumn(5).width = 12
  ws.getColumn(6).width = 14
  ws.getColumn(7).width = 16
  ws.getColumn(8).width = 22
  ws.getColumn(9).width = 18

  addSectionTitle(ws, t('Overview'), 9)
  addStatsTable(ws, p.stats)

  if (p.subStats.length > 0) {
    addSectionTitle(ws, t('Sub-department Statistics'), 9)
    const hdr = ws.addRow([
      t('Department'),
      t('Registered Count'),
      t('Total Users'),
      t('Total Tokens'),
      t('Total Cost'),
      `${t('Unit Price')}/${t('100M Tokens')}`,
      t('Request Count'),
      t('Active Users / Active Rate'),
      t('Tokens per Active User'),
    ])
    styleHeaderRow(hdr)

    ;[...p.subStats]
      .sort((a, b) => b.total_amount_cny - a.total_amount_cny)
      .forEach((sub, i) => {
        const r = ws.addRow([
          sub.department_name,
          sub.registered_users,
          sub.total_users,
          fmtTokens(sub.total_tokens),
          fmtCny(sub.total_amount_cny),
          `${fmtCny(sub.unit_price_per_100m_tokens)}/${t('100M Tokens')}`,
          fmtRequests(sub.total_requests),
          `${(sub.active_users ?? 0).toLocaleString()} / ${(sub.active_user_rate ?? 0).toFixed(1)}%`,
          fmtTokens((sub.avg_tokens_per_active_user_mt ?? 0) * 1_000_000),
        ])
        styleDataRow(r, i % 2 === 1)
      })
  }
}

function buildSubDeptSheet(
  wb: ExcelJS.Workbook,
  sheetName: string,
  detail: SubDepartmentDetail,
  timeRange: string
): void {
  const ws = wb.addWorksheet(sheetName)

  styleTitleRow(
    ws,
    `${t('Data Overview')} — ${detail.departmentName}（${timeRange}）`,
    9
  )
  ws.addRow([])

  ws.getColumn(1).width = 28
  ws.getColumn(2).width = 16
  ws.getColumn(3).width = 14
  ws.getColumn(4).width = 14
  ws.getColumn(5).width = 12
  ws.getColumn(6).width = 14
  ws.getColumn(7).width = 16
  ws.getColumn(8).width = 22
  ws.getColumn(9).width = 18

  addSectionTitle(ws, t('Overview'), 9)
  addStatsTable(ws, detail.stats)

  if (detail.subStats.length > 0) {
    addSectionTitle(ws, t('Sub-department Statistics'), 9)
    const hdr = ws.addRow([
      t('Department'),
      t('Registered Count'),
      t('Total Users'),
      t('Total Tokens'),
      t('Total Cost'),
      `${t('Unit Price')}/${t('100M Tokens')}`,
      t('Request Count'),
      t('Active Users / Active Rate'),
      t('Tokens per Active User'),
    ])
    styleHeaderRow(hdr)

    ;[...detail.subStats]
      .sort((a, b) => b.total_amount_cny - a.total_amount_cny)
      .forEach((sub, i) => {
        const r = ws.addRow([
          sub.department_name,
          sub.registered_users,
          sub.total_users,
          fmtTokens(sub.total_tokens),
          fmtCny(sub.total_amount_cny),
          `${fmtCny(sub.unit_price_per_100m_tokens)}/${t('100M Tokens')}`,
          fmtRequests(sub.total_requests),
          `${(sub.active_users ?? 0).toLocaleString()} / ${(sub.active_user_rate ?? 0).toFixed(1)}%`,
          fmtTokens((sub.avg_tokens_per_active_user_mt ?? 0) * 1_000_000),
        ])
        styleDataRow(r, i % 2 === 1)
      })
  }
}

function buildUserListSheet(wb: ExcelJS.Workbook, p: ExportParams): void {
  const ws = wb.addWorksheet(t('Department Personnel List'))

  const timeRange = formatTimeRangeForFilename(p.startTimestamp, p.endTimestamp)
  styleTitleRow(
    ws,
    `${t('Department Personnel List')} — ${p.departmentName}（${timeRange}）`,
    9
  )
  ws.addRow([])

  ws.getColumn(1).width = 14
  ws.getColumn(2).width = 16
  ws.getColumn(3).width = 14
  ws.getColumn(4).width = 14
  ws.getColumn(5).width = 12
  ws.getColumn(6).width = 22
  ws.getColumn(7).width = 18
  ws.getColumn(8).width = 18
  ws.getColumn(9).width = 12

  addSectionTitle(ws, t('User List'), 9)
  const hdr = ws.addRow([
    t('Display Name'),
    t('Total Cost'),
    `${t('Unit Price')}/${t('100M Tokens')}`,
    t('Total Tokens'),
    t('Requests'),
    t('Common Model'),
    t('Last Login'),
    t('Created At'),
    t('Registration Status'),
  ])
  styleHeaderRow(hdr)

  const UNREGISTERED_FONT: Partial<ExcelJS.Font> = {
    color: { argb: 'FF8C8C8C' },
  }
  const UNREGISTERED_FILL: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF5F5F5' },
  }
  const UNREGISTERED_BORDER: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
    left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
    bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
    right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
  }

  p.users.forEach((u) => {
    const registrationStatus = getDepartmentUserRegistrationStatus(u)
    const isRegistered = isDepartmentUserRegistered(u)
    const row = ws.addRow([
      u.display_name || u.username || '-',
      isRegistered ? fmtCny(u.total_amount_cny ?? 0) : '-',
      isRegistered
        ? fmtUnitPrice(u.total_amount_cny ?? 0, u.total_tokens ?? 0)
        : '-',
      isRegistered ? fmtTokens(u.total_tokens ?? 0) : '-',
      isRegistered ? fmtRequests(u.total_requests ?? 0) : '-',
      isRegistered ? u.common_model || '-' : '-',
      isRegistered && u.last_login_at
        ? dayjs.unix(u.last_login_at).format('YYYY-MM-DD HH:mm')
        : '-',
      isRegistered && u.created_at
        ? dayjs.unix(u.created_at).format('YYYY-MM-DD HH:mm')
        : '-',
      t(getDepartmentRegistrationStatusLabel(registrationStatus)),
    ])

    if (!isRegistered) {
      for (let col = 1; col <= 9; col++) {
        row.getCell(col).font = UNREGISTERED_FONT
        row.getCell(col).fill = UNREGISTERED_FILL
        row.getCell(col).border = UNREGISTERED_BORDER
      }
    }

    row.eachCell((cell) => {
      cell.alignment = { horizontal: 'left', vertical: 'middle' }
    })
  })
}

// ── Public API ────────────────────────────────────────

export interface SubDepartmentDetail {
  departmentId: string
  departmentName: string
  stats: DepartmentStat
  subStats: SubDepartmentStat[]
  usage: UsageAnalysis
}

export interface ExportParams {
  departmentName: string
  startTimestamp: number
  endTimestamp: number
  stats: DepartmentStat
  subStats: SubDepartmentStat[]
  usage: UsageAnalysis
  userRankings: UserRankingItem[]
  includeSubDepartments: boolean
  subDepartmentDetails: SubDepartmentDetail[]
  includeUserList: boolean
  users: DepartmentUser[]
}

export async function exportDataOverview(params: ExportParams): Promise<void> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'New API'
  wb.created = new Date()

  buildMainSheet(wb, params)

  const mainWs = getRequiredWorksheet(wb, t('Data Overview'))

  let nextLeftChartRow = mainWs.rowCount + 2
  if (params.subStats.length > 0) {
    nextLeftChartRow = await embedSubDeptCharts(wb, mainWs, params.subStats)
  }

  if (params.userRankings.length > 0) {
    await embedUserRankingCharts(
      wb,
      mainWs,
      params.userRankings,
      nextLeftChartRow
    )
  }

  await embedRightSideCharts(
    wb,
    mainWs,
    params.usage,
    params.stats.cost_buckets
  )

  if (params.includeUserList) {
    buildUserListSheet(wb, params)
    if (params.userRankings.length > 0) {
      const userWs = getRequiredWorksheet(wb, t('Department Personnel List'))
      await embedUserRankingCharts(wb, userWs, params.userRankings)
    }
  }

  if (params.includeSubDepartments && params.subDepartmentDetails.length > 0) {
    const rawNames = params.subDepartmentDetails.map((d) => d.departmentName)
    const sheetNames = ensureUniqueSheetNames(rawNames)
    const timeRange = formatTimeRangeForFilename(
      params.startTimestamp,
      params.endTimestamp
    )
    for (let i = 0; i < params.subDepartmentDetails.length; i++) {
      const detail = params.subDepartmentDetails[i]
      buildSubDeptSheet(wb, sheetNames[i], detail, timeRange)
      const ws = getRequiredWorksheet(wb, sheetNames[i])
      if (detail.subStats.length > 0) {
        await embedSubDeptCharts(wb, ws, detail.subStats)
      }
      await embedRightSideCharts(
        wb,
        ws,
        detail.usage,
        detail.stats.cost_buckets
      )
    }
  }

  const buffer = await wb.xlsx.writeBuffer()
  const timeRange = formatTimeRangeForFilename(
    params.startTimestamp,
    params.endTimestamp
  )
  const fileName = `${params.departmentName}_${t('Data Overview')}_${timeRange}.xlsx`
  triggerDownload(buffer as ArrayBuffer, fileName)
}

async function embedSubDeptCharts(
  wb: ExcelJS.Workbook,
  ws: ExcelJS.Worksheet,
  subStats: SubDepartmentStat[]
): Promise<number> {
  const imgWidth = 680
  const startRow = ws.rowCount + 2
  let row = startRow

  const barHeight = Math.max(280, subStats.length * 34)
  const barSpec = buildSubDeptBarSpec(subStats)
  const barImg = await renderChartToBase64(barSpec, imgWidth, barHeight)
  addImageToSheet(wb, ws, barImg, row, 0, imgWidth, barHeight)
  row += Math.ceil(barHeight / 18) + 2

  const pieHeight = 360
  const pieSpec = buildSubDeptPieSpec(subStats)
  const pieImg = await renderChartToBase64(pieSpec, imgWidth, pieHeight)
  addImageToSheet(wb, ws, pieImg, row, 0, imgWidth, pieHeight)

  return row + Math.ceil(pieHeight / 18) + 2
}

async function embedRightSideCharts(
  wb: ExcelJS.Workbook,
  ws: ExcelJS.Worksheet,
  usage: UsageAnalysis,
  costBuckets?: CostBucket[]
): Promise<void> {
  const rightCol = 10
  const rightChartColumnCount = 8
  const imgWidth = rightChartColumnCount * 72
  const imgHeight = 360
  const rowSpacing = Math.ceil(imgHeight / 18) + 2
  const headerRowNumber = 4
  const chartStartRow = headerRowNumber

  const sectionHeaderRow = ws.getRow(headerRowNumber)
  const sectionCell = sectionHeaderRow.getCell(rightCol + 1)
  sectionCell.value = t('Usage Analysis')
  sectionCell.font = SECTION_FONT
  sectionCell.fill = SECTION_FILL
  sectionCell.alignment = { vertical: 'middle' }
  ws.mergeCells(
    headerRowNumber,
    rightCol + 1,
    headerRowNumber,
    rightCol + rightChartColumnCount
  )
  sectionHeaderRow.height = 22
  let row = chartStartRow

  const rate = usage.quota_to_cny || 1 / 500000
  const dailyStats = usage.daily_stats ?? []
  const modelStats = usage.model_stats ?? []
  const modelSeriesStats = usage.model_series_stats ?? []
  const modelDailyStats = usage.model_daily_stats ?? []

  const modelTrendSpec = buildModelUsageTrendSpec(modelDailyStats)

  if (costBuckets && costBuckets.length > 0) {
    const spec = buildCostBucketDistributionSpec(costBuckets)
    if (spec) {
      const image = await renderChartToBase64(spec, imgWidth, imgHeight)
      addImageToSheet(wb, ws, image, row, rightCol, imgWidth, imgHeight)
      row += rowSpacing
    }
  }

  if (modelSeriesStats.some((model) => model.total_requests > 0)) {
    const spec = buildModelCallDistributionSpec(
      modelSeriesStats,
      '模型系列调用分布'
    )
    if (spec) {
      const image = await renderChartToBase64(spec, imgWidth, imgHeight)
      addImageToSheet(wb, ws, image, row, rightCol, imgWidth, imgHeight)
      row += rowSpacing
    }
  }

  if (modelSeriesStats.length > 0) {
    const chartHeight = Math.max(280, modelSeriesStats.length * 30)
    const image = await renderChartToBase64(
      buildModelCostRankSpec(modelSeriesStats, rate, {
        title: '模型系列消耗排行',
      }),
      imgWidth,
      chartHeight
    )
    addImageToSheet(wb, ws, image, row, rightCol, imgWidth, chartHeight)
    row += Math.ceil(chartHeight / 18) + 2
  }

  if (modelStats.some((model) => model.total_requests > 0)) {
    const spec = buildModelCallDistributionSpec(modelStats)
    if (spec) {
      const image = await renderChartToBase64(spec, imgWidth, imgHeight)
      addImageToSheet(wb, ws, image, row, rightCol, imgWidth, imgHeight)
      row += rowSpacing
    }
  }

  if (modelStats.length > 0) {
    const chartHeight = Math.max(280, Math.min(modelStats.length, 15) * 30)
    const image = await renderChartToBase64(
      buildModelCostRankSpec(modelStats, rate, { limit: 15 }),
      imgWidth,
      chartHeight
    )
    addImageToSheet(wb, ws, image, row, rightCol, imgWidth, chartHeight)
    row += Math.ceil(chartHeight / 18) + 2
  }

  if (dailyStats.length > 0) {
    const costImage = await renderChartToBase64(
      buildCostTrendSpec(dailyStats, rate),
      imgWidth,
      imgHeight
    )
    addImageToSheet(wb, ws, costImage, row, rightCol, imgWidth, imgHeight)
    row += rowSpacing

    const requestImage = await renderChartToBase64(
      buildRequestTrendSpec(dailyStats),
      imgWidth,
      imgHeight
    )
    addImageToSheet(wb, ws, requestImage, row, rightCol, imgWidth, imgHeight)
    row += rowSpacing

    const tokenImage = await renderChartToBase64(
      buildTokenTrendSpec(dailyStats),
      imgWidth,
      imgHeight
    )
    addImageToSheet(wb, ws, tokenImage, row, rightCol, imgWidth, imgHeight)
    row += rowSpacing
  }

  if (modelStats.length > 0 && modelTrendSpec) {
    const image = await renderChartToBase64(modelTrendSpec, imgWidth, imgHeight)
    addImageToSheet(wb, ws, image, row, rightCol, imgWidth, imgHeight)
  }
}

async function embedUserRankingCharts(
  wb: ExcelJS.Workbook,
  ws: ExcelJS.Worksheet,
  rankings: UserRankingItem[],
  startRow?: number
): Promise<void> {
  const imgWidth = 680
  let row = startRow ?? ws.rowCount + 2

  const barHeight = Math.max(280, Math.min(rankings.length, 10) * 34)
  const barSpec = buildUserRankBarSpec(rankings)
  const barImg = await renderChartToBase64(barSpec, imgWidth, barHeight)
  addImageToSheet(wb, ws, barImg, row, 0, imgWidth, barHeight)
  row += Math.ceil(barHeight / 18) + 2

  const pieHeight = 400
  const pieSpec = buildUserRankPieSpec(rankings)
  const pieImg = await renderChartToBase64(pieSpec, imgWidth, pieHeight)
  addImageToSheet(wb, ws, pieImg, row, 0, imgWidth, pieHeight)
}

function addImageToSheet(
  wb: ExcelJS.Workbook,
  ws: ExcelJS.Worksheet,
  dataUrl: string,
  row: number,
  col: number,
  width: number,
  height: number
): void {
  if (!dataUrl) return
  const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '')
  const imageId = wb.addImage({ base64, extension: 'png' })
  ws.addImage(imageId, {
    tl: { col, row },
    ext: { width, height },
  })
}

function triggerDownload(buffer: ArrayBuffer, fileName: string): void {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}
