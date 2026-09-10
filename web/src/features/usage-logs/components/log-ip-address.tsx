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
import { Globe } from 'lucide-react'

import { StatusBadge } from '@/components/status-badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface LogIpAddressProps {
  ipAddress?: string
  sensitiveVisible?: boolean
}

export function LogIpAddress(props: LogIpAddressProps) {
  if (!props.ipAddress) return null

  const sensitiveVisible = props.sensitiveVisible ?? true
  const displayIpAddress = sensitiveVisible ? props.ipAddress : '••••'

  return (
    <div className='flex max-w-[140px] flex-col gap-0.5'>
      <TooltipProvider delay={100}>
        <Tooltip>
          <TooltipTrigger render={<div className='max-w-full' />}>
            <StatusBadge
              label={displayIpAddress}
              icon={Globe}
              copyText={sensitiveVisible ? props.ipAddress : undefined}
              size='sm'
              showDot={false}
              className='border-border/60 bg-muted/30 text-foreground h-6 max-w-full gap-1.5 overflow-hidden rounded-md border px-2 py-0.5 font-mono font-normal [&_svg]:stroke-[1.5]'
            />
          </TooltipTrigger>
          {sensitiveVisible && props.ipAddress.length > 15 && (
            <TooltipContent side='top' className='max-w-xs break-all'>
              {props.ipAddress}
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>
    </div>
  )
}
