import { useTranslation } from 'react-i18next'

import { formatLogQuota, formatTokens, formatUseTime } from '@/lib/format'

import type { UsageLog } from '../../data/schema'
import { parseLogOther } from '../../lib/format'
import { DetailRow } from './log-detail-layout'

interface RequestLogSummaryProps {
  log: UsageLog
}

/**
 * 同一次请求在日志里已记录的运行信息（用量、费用、耗时、渠道等）。
 * 与请求内容并列展示，审计时无需再打开日志详情弹窗。
 */
export function RequestLogSummary(props: RequestLogSummaryProps) {
  const { t } = useTranslation()
  const other = parseLogOther(props.log.other)

  const cacheReadTokens = other?.cache_tokens || 0
  const cacheWrite5m = other?.cache_creation_tokens_5m || 0
  const cacheWrite1h = other?.cache_creation_tokens_1h || 0
  const cacheWriteTokens =
    cacheWrite5m > 0 || cacheWrite1h > 0
      ? cacheWrite5m + cacheWrite1h
      : other?.cache_creation_tokens || 0

  const rawUseChannel = other?.admin_info?.use_channel
  const retryChain =
    Array.isArray(rawUseChannel) && rawUseChannel.length > 1
      ? rawUseChannel.map(String).filter(Boolean).join(' → ')
      : ''
  const firstResponseTime = other?.frt ?? 0
  const upstreamModel = other?.is_model_mapped ? other.upstream_model_name : ''

  return (
    <div className='flex flex-col gap-2.5 [&_span]:text-[13px]'>
      {props.log.use_time > 0 && (
        <DetailRow
          label={t('Response Time')}
          value={
            <>
              {formatUseTime(props.log.use_time)}
              {props.log.is_stream && firstResponseTime > 0 && (
                <span className='text-muted-foreground'>
                  {` (FRT: ${formatUseTime(firstResponseTime / 1000)})`}
                </span>
              )}
            </>
          }
          mono
        />
      )}

      {props.log.prompt_tokens > 0 && (
        <DetailRow
          label={t('Input Tokens')}
          value={formatTokens(props.log.prompt_tokens)}
          mono
        />
      )}

      {props.log.completion_tokens > 0 && (
        <DetailRow
          label={t('Output Tokens')}
          value={formatTokens(props.log.completion_tokens)}
          mono
        />
      )}

      {cacheReadTokens > 0 && (
        <DetailRow
          label={t('Cache Read')}
          value={formatTokens(cacheReadTokens)}
          mono
        />
      )}

      {cacheWriteTokens > 0 && (
        <DetailRow
          label={t('Cache Write')}
          value={formatTokens(cacheWriteTokens)}
          mono
        />
      )}

      {props.log.quota > 0 && (
        <DetailRow
          label={t('Cost')}
          value={formatLogQuota(props.log.quota)}
          mono
        />
      )}

      {props.log.channel > 0 && (
        <DetailRow
          label={t('Channel')}
          value={
            props.log.channel_name
              ? `${props.log.channel} (${props.log.channel_name})`
              : props.log.channel
          }
          mono
        />
      )}

      {retryChain && (
        <DetailRow label={t('Retry Chain')} value={retryChain} mono />
      )}

      {props.log.token_name && (
        <DetailRow label={t('Token')} value={props.log.token_name} mono />
      )}

      {props.log.group && (
        <DetailRow label={t('Group')} value={props.log.group} mono />
      )}

      {upstreamModel && (
        <DetailRow
          label={t('Model Mapping')}
          value={`${props.log.model_name} → ${upstreamModel}`}
          mono
        />
      )}

      {props.log.upstream_request_id && (
        <DetailRow
          label={t('Upstream Request ID')}
          value={props.log.upstream_request_id}
          mono
        />
      )}

      {props.log.ip && (
        <DetailRow label={t('IP Address')} value={props.log.ip} mono />
      )}
    </div>
  )
}
