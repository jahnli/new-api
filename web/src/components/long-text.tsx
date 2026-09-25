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
import { TextTooltip } from '@/components/text-tooltip'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { useMediaQuery } from '@/hooks/use-media-query'
import { useOverflow } from '@/hooks/use-overflow'
import { cn } from '@/lib/utils'

type LongTextProps = {
  children: React.ReactNode
  className?: string
  contentClassName?: string
}

export function LongText({
  children,
  className = '',
  contentClassName = '',
}: LongTextProps) {
  const isMobile = useMediaQuery('(max-width: 639px)')
  const mobileOverflow = useOverflow(isMobile)

  if (!isMobile) {
    return (
      <TextTooltip
        content={children}
        contentClassName={contentClassName}
        onlyWhenOverflow
      >
        <div className={cn('truncate', className)}>{children}</div>
      </TextTooltip>
    )
  }

  return (
    <Popover>
      <PopoverTrigger
        nativeButton={false}
        disabled={!mobileOverflow.isOverflowing}
        render={
          <div ref={mobileOverflow.ref} className={cn('truncate', className)} />
        }
      >
        {children}
      </PopoverTrigger>
      <PopoverContent
        className={cn('w-fit max-w-xs break-words', contentClassName)}
      >
        <p>{children}</p>
      </PopoverContent>
    </Popover>
  )
}
