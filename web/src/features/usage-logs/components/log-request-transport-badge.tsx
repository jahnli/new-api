import { useTranslation } from 'react-i18next'

import { TextTooltip } from '@/components/text-tooltip'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface LogRequestTransportBadgeProps {
  requestId: string
  requestPath?: string
}

export function LogRequestTransportBadge(props: LogRequestTransportBadgeProps) {
  const { t } = useTranslation()
  // Responses messages get a WebSocket-specific request ID. Realtime uses
  // the original handshake request ID, so identify it by its WebSocket route.
  const isWebSocket =
    /-ws-\d+$/.test(props.requestId) || props.requestPath === '/v1/realtime'

  if (!isWebSocket && !props.requestPath) return null

  return (
    <TextTooltip content={isWebSocket ? t('WebSocket') : undefined}>
      <Badge
        variant='outline'
        tabIndex={isWebSocket ? 0 : undefined}
        className={cn(
          'h-4 rounded-md px-1.5 py-0 text-[11px]! leading-none',
          isWebSocket
            ? 'border-info/25 bg-info/10 text-info'
            : 'border-border/70 bg-muted/50 text-muted-foreground'
        )}
      >
        {isWebSocket ? t('WS') : t('HTTP')}
      </Badge>
    </TextTooltip>
  )
}
