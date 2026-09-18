import { Wrench01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useTranslation } from 'react-i18next'

import { StatusBadge } from '@/components/status-badge'
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
  showWalletSource?: boolean
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
  const match = formattedQuota.match(/^([^0-9+\-.,\s]+)(.+)$/)
  const quotaDisplay = match
    ? { prefix: match[1], amount: match[2] }
    : { prefix: '', amount: formattedQuota }
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

export function LogCostDisplay(props: LogCostDisplayProps) {
  const demoMode = useDemoMode()
  const { t } = useTranslation()
  const isSubscription = props.other?.billing_source === 'subscription'
  const showToolSurcharge = hasToolSurcharge(props.other)
  const quota = isSubscription
    ? (props.other?.subscription_consumed ?? props.quota)
    : props.quota
  let source: string | undefined

  if (isSubscription) {
    source = t('Subscription')
  } else if (
    props.showWalletSource &&
    props.other?.billing_source === 'wallet'
  ) {
    source = t('Wallet')
  }

  return (
    <TooltipProvider>
      <div className='flex w-fit flex-col items-start gap-0.5'>
        <div className='flex items-center gap-1.5'>
          <QuotaBadge quota={quota} masked={demoMode} />
          {showToolSurcharge ? <ToolSurchargeMarker /> : null}
        </div>
        {source ? (
          <StatusBadge
            label={source}
            type='text'
            variant={isSubscription ? 'success' : 'neutral'}
            size='sm'
            copyable={false}
          />
        ) : null}
      </div>
    </TooltipProvider>
  )
}
