import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'

import type { NotificationStatus } from '../types'

export function NotificationStatusBadge(props: { status: NotificationStatus }) {
  const { t } = useTranslation()
  const labels = {
    queued: t('Queued'),
    sending: t('Sending'),
    success: t('Success'),
    failed: t('Failed'),
    partial: t('Partially delivered'),
    unknown: t('Unknown'),
  }
  let variant: 'secondary' | 'destructive' | 'warning' | 'outline' = 'secondary'
  if (props.status === 'failed') variant = 'destructive'
  if (props.status === 'partial' || props.status === 'unknown') {
    variant = 'warning'
  }
  if (props.status === 'success') variant = 'outline'
  return (
    <Badge
      variant={variant}
      className={
        props.status === 'success'
          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
          : undefined
      }
    >
      <span className='size-1.5 rounded-full bg-current' />
      {labels[props.status] ?? labels.unknown}
    </Badge>
  )
}
