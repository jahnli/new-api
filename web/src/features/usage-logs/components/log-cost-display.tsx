/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import {
  CrownIcon,
  Wallet01Icon,
  Wrench01Icon,
} from '@hugeicons/core-free-icons'
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
  showBillingSource?: boolean
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

function QuotaAmount(props: { quota: number; masked?: boolean }) {
  const formattedQuota = formatLogQuota(props.quota)
  const match = formattedQuota.match(/^([^0-9+\-.,\s]+)(.+)$/)
  const quotaDisplay = match
    ? { prefix: match[1], amount: match[2] }
    : { prefix: '', amount: formattedQuota }
  const amount = props.masked ? DEMO_MODE_MASK : quotaDisplay.amount

  return (
    <>
      {quotaDisplay.prefix ? (
        <span className='mr-1'>{quotaDisplay.prefix}</span>
      ) : null}
      <span>{amount}</span>
    </>
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

  if (props.showBillingSource && isSubscription) {
    source = t('Subscription')
  } else if (
    props.showBillingSource &&
    props.other?.billing_source === 'wallet'
  ) {
    source = t('Wallet')
  }

  return (
    <TooltipProvider>
      <div className='inline-flex w-fit items-center gap-1.5'>
        <StatusBadge
          type='badge'
          variant='neutral'
          size='lg'
          copyable={false}
          className='border-border/80 bg-muted/60 text-foreground rounded-md border font-semibold tabular-nums'
        >
          {source ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <span
                    className='inline-flex shrink-0 cursor-help'
                    role='img'
                    aria-label={source}
                    tabIndex={0}
                  >
                    <HugeiconsIcon
                      icon={isSubscription ? CrownIcon : Wallet01Icon}
                      className='size-3.5'
                      strokeWidth={2}
                      aria-hidden='true'
                    />
                  </span>
                }
              />
              <TooltipContent>{source}</TooltipContent>
            </Tooltip>
          ) : null}
          <span className='whitespace-nowrap'>
            <QuotaAmount quota={quota} masked={demoMode} />
          </span>
        </StatusBadge>
        {showToolSurcharge ? <ToolSurchargeMarker /> : null}
      </div>
    </TooltipProvider>
  )
}
