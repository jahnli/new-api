import { Wrench01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useDemoMode } from '@/hooks/use-demo-mode'
import { DEMO_MODE_MASK } from '@/lib/demo-mode'
import { formatLogQuota } from '@/lib/format'

import { hasToolSurcharge } from '../lib/format'
import type { LogOtherData } from '../types'

interface LogCostDisplayProps {
  quota: number
  other: LogOtherData | null
}

function splitQuotaDisplay(value: string): { prefix: string; amount: string } {
  const match = value.match(/^([^0-9+\-.,\s]+)(.+)$/)
  if (!match) return { prefix: '', amount: value }
  return { prefix: match[1], amount: match[2] }
}

function ToolSurchargeMarker() {
  const { t } = useTranslation()
  const label = t('Includes tool-call surcharge')

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Badge
            variant='warning'
            className='h-5 min-w-5 cursor-help gap-0 rounded-full px-1'
            role='img'
            aria-label={label}
            tabIndex={0}
            data-tool-surcharge-indicator='true'
          >
            <HugeiconsIcon
              icon={Wrench01Icon}
              strokeWidth={2}
              aria-hidden='true'
            />
            <span
              className='text-[9px] leading-none font-bold'
              aria-hidden='true'
            >
              +
            </span>
          </Badge>
        }
      />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

function QuotaBadge(props: { quota: number; masked?: boolean }) {
  const formattedQuota = formatLogQuota(props.quota)
  const quotaDisplay = splitQuotaDisplay(formattedQuota)
  const amount = props.masked ? DEMO_MODE_MASK : quotaDisplay.amount

  return (
    <span className='border-border/80 bg-muted/60 inline-flex h-6 w-fit items-center rounded-md border px-2 [font-family:var(--font-body)] text-sm leading-none font-semibold tabular-nums'>
      {quotaDisplay.prefix ? (
        <span className='mr-1'>{quotaDisplay.prefix}</span>
      ) : null}
      <span>{amount}</span>
    </span>
  )
}

function SubscriptionCost(props: { quota: number; masked?: boolean }) {
  const { t } = useTranslation()

  return (
    <Tooltip>
      <TooltipTrigger
        render={<span className='inline-flex w-fit cursor-help' tabIndex={0} />}
      >
        <QuotaBadge quota={props.quota} masked={props.masked} />
      </TooltipTrigger>
      <TooltipContent>{t('Subscription')}</TooltipContent>
    </Tooltip>
  )
}

export function LogCostDisplay(props: LogCostDisplayProps) {
  const demoMode = useDemoMode()
  const isSubscription = props.other?.billing_source === 'subscription'
  const showToolSurcharge = hasToolSurcharge(props.other)

  if (!isSubscription && !showToolSurcharge) {
    return (
      <div className='flex flex-col gap-0.5'>
        <QuotaBadge quota={props.quota} masked={demoMode} />
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className='inline-flex items-center gap-1'>
        {isSubscription ? (
          <SubscriptionCost quota={props.quota} masked={demoMode} />
        ) : (
          <QuotaBadge quota={props.quota} masked={demoMode} />
        )}
        {showToolSurcharge ? <ToolSurchargeMarker /> : null}
      </div>
    </TooltipProvider>
  )
}
