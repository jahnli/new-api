import { useMemo } from 'react'

import { Markdown } from '@/components/ui/markdown'
import { cn } from '@/lib/utils'

import type { NotificationMessage } from '../types'

export function MessageContent(props: {
  message: NotificationMessage
  placeholder?: string
  className?: string
}) {
  const images = useMemo(
    () =>
      (props.message.images ?? []).filter(
        (image) =>
          /^image\/(jpeg|png|gif|webp)$/.test(image.content_type) &&
          /^[A-Za-z0-9+/]+={0,2}$/.test(image.data)
      ),
    [props.message.images]
  )
  const imageSources = useMemo(
    () =>
      Object.fromEntries(
        images
          .filter((image) => image.id)
          .map((image) => [
            `cid:notification-image-${image.id}`,
            `data:${image.content_type};base64,${image.data}`,
          ])
      ),
    [images]
  )
  return (
    <>
      <Markdown
        breaks
        codeLineNumbers={props.message.channel === 'feishu'}
        className={cn(
          props.className,
          props.message.channel === 'feishu' &&
            '[&_pre]:border-neutral-200 [&_pre]:bg-[#f5f6f7] [&_pre]:text-neutral-700 [&_thead]:bg-[#f5f6f7] [&_img]:my-3 [&_img]:h-auto [&_img]:max-w-full [&_li]:marker:text-blue-600 dark:[&_pre]:border-neutral-700 dark:[&_pre]:bg-neutral-800 dark:[&_pre]:text-neutral-200 dark:[&_thead]:bg-neutral-800'
        )}
        imageSources={imageSources}
      >
        {props.message.content || props.placeholder || ''}
      </Markdown>
      {images
        .filter((image) => !image.id)
        .map((image) => (
          <img
            key={`${image.filename}-${image.data.slice(-32)}`}
            src={`data:${image.content_type};base64,${image.data}`}
            alt={image.filename}
            className={cn(
              'mt-3 rounded-lg object-contain',
              props.message.channel === 'feishu'
                ? 'h-auto max-w-full'
                : 'max-h-72'
            )}
          />
        ))}
    </>
  )
}
