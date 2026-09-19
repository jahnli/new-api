import { Info } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useExternalMode } from '@/hooks/use-external-mode'

import { formatPremiumQuota } from '../lib/premium-quota'
import type { PremiumQuota } from '../premium-api'

export function PremiumQuotaSummary(props: { quota?: PremiumQuota }) {
  const { t } = useTranslation()
  const externalMode = useExternalMode()
  const quota = props.quota
  if (externalMode || !quota) return null
  const used = BigInt(quota.premium_amount_used)
  const limit = BigInt(quota.premium_limit)
  let percent = used > 0n ? 100 : 0
  if (limit > 0n) {
    const calculated = (used * 100n) / limit
    percent = calculated > 100n ? 100 : Number(calculated)
  }
  return (
    <div className='bg-muted/40 min-w-0 space-y-3 rounded-lg p-3 text-xs'>
      <div className='flex items-center justify-between gap-2'>
        <span className='font-medium'>{t('Premium model quota')}</span>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type='button'
                variant='ghost'
                size='icon-xs'
                className='text-muted-foreground -my-1 -me-1'
                aria-label={t('Premium model quota settings')}
              />
            }
          >
            <Info className='size-3.5' aria-hidden='true' />
          </TooltipTrigger>
          <TooltipContent className='flex-col items-start gap-1.5'>
            <p>
              {quota.percent_source === 'user'
                ? t('User override')
                : t('System default')}
              {' · '}
              {quota.effective_percent}%
            </p>
            <p>{t('Quota usage includes pending request reservations.')}</p>
          </TooltipContent>
        </Tooltip>
      </div>
      <div className='space-y-2'>
        <div className='flex flex-wrap items-baseline gap-x-1.5 gap-y-1 tabular-nums'>
          <span className='text-muted-foreground'>{t('Used')}</span>
          <span className='text-lg leading-tight font-semibold break-all'>
            {formatPremiumQuota(quota.premium_amount_used)}
          </span>
          <span className='text-muted-foreground break-all'>
            / {formatPremiumQuota(quota.premium_limit)}
          </span>
        </div>
        <Progress
          value={percent}
          aria-label={t('Premium model quota')}
          className='[&_[data-slot=progress-track]]:h-1.5'
        />
      </div>
      <p className='text-muted-foreground leading-relaxed tabular-nums'>
        {quota.enabled
          ? t('Premium quota available: {{amount}}', {
              amount: formatPremiumQuota(quota.premium_available),
            })
          : t('Premium quota limit is disabled')}
      </p>
    </div>
  )
}
