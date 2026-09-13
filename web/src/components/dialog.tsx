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
import * as React from 'react'

import {
  Dialog as DialogRoot,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

type DialogProps = React.ComponentProps<typeof DialogRoot> & {
  title: React.ReactNode
  description?: React.ReactNode
  children: React.ReactNode
  trigger?: React.ReactElement
  footer?: React.ReactNode
  /** Rendered before the title inside the header, e.g. an avatar or icon. */
  headerLeading?: React.ReactNode
  /** Rendered after the title inside the header, e.g. a badge trailing it. */
  headerTrailing?: React.ReactNode
  contentHeight?: React.CSSProperties['height']
  contentClassName?: string
  headerClassName?: string
  titleClassName?: string
  descriptionClassName?: string
  bodyClassName?: string
  bodyContainerClassName?: string
  footerClassName?: string
  initialFocus?: boolean
  showCloseButton?: boolean
}

const dialogContentMotionClassName =
  'data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 duration-100'

export function Dialog({
  title,
  description,
  children,
  trigger,
  footer,
  headerLeading,
  headerTrailing,
  contentHeight = 'auto',
  contentClassName,
  headerClassName,
  titleClassName,
  descriptionClassName,
  bodyClassName,
  bodyContainerClassName,
  footerClassName,
  initialFocus,
  showCloseButton,
  ...dialogProps
}: DialogProps) {
  return (
    <DialogRoot {...dialogProps}>
      {trigger ? <DialogTrigger render={trigger} /> : null}
      <DialogContent
        className={cn(
          'flex max-h-[calc(100vh-2rem)] w-full flex-col gap-4 overflow-hidden p-4 sm:max-w-2xl sm:p-6',
          contentClassName,
          dialogContentMotionClassName
        )}
        initialFocus={initialFocus}
        showCloseButton={showCloseButton}
        style={
          {
            '--dialog-content-height': contentHeight,
          } as React.CSSProperties
        }
      >
        <DialogHeader
          className={cn('flex-shrink-0 text-start', headerClassName)}
        >
          {headerLeading}
          <DialogTitle className={titleClassName}>{title}</DialogTitle>
          {headerTrailing}
          {description ? (
            <DialogDescription className={descriptionClassName}>
              {description}
            </DialogDescription>
          ) : null}
        </DialogHeader>

        <div
          className={cn(
            '-mx-1 min-h-0 overflow-x-hidden overflow-y-auto overscroll-contain',
            'h-[var(--dialog-content-height)] max-h-[calc(100vh-14rem)]',
            bodyContainerClassName
          )}
        >
          <div
            className={cn(
              'min-w-0 px-1 py-1',
              '[&_form]:overflow-x-visible',
              '[&_[data-slot=scroll-area-viewport]]:px-1 [&_[data-slot=scroll-area-viewport]]:py-1',
              bodyClassName
            )}
          >
            {children}
          </div>
        </div>

        {footer ? (
          <DialogFooter
            className={cn(
              'flex-shrink-0 gap-2 sm:-mx-6 sm:-mb-6 sm:justify-end sm:p-6',
              footerClassName
            )}
          >
            {footer}
          </DialogFooter>
        ) : null}
      </DialogContent>
    </DialogRoot>
  )
}
