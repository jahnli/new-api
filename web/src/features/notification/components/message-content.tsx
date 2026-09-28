import { useQueries } from '@tanstack/react-query'

import { Markdown } from '@/components/ui/markdown'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

import { getNotificationImage } from '../api'
import type { NotificationMessage } from '../types'

export function MessageContent(props: {
  message: NotificationMessage
  placeholder?: string
  className?: string
}) {
  const sessionID = useAuthStore((state) => state.auth.session?.sid)
  const images = (props.message.images ?? []).filter(
    (image) =>
      /^image\/(jpeg|png|gif|webp)$/.test(image.content_type) &&
      (/^[A-Za-z0-9+/]+={0,2}$/.test(image.data) ||
        /^\/api\/notification\/messages\/[1-9]\d*\/images\/[a-f0-9-]{36}\.(png|jpg|gif|webp)$/.test(
          image.url ?? ''
        ))
  )
  const remoteURLs = [
    ...new Set(
      images.flatMap((image) => (!image.data && image.url ? [image.url] : []))
    ),
  ]
  const queries = useQueries({
    queries: remoteURLs.map((url) => ({
      queryKey: ['notification', 'image', sessionID, url],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        getNotificationImage(url, signal),
      staleTime: 30_000,
      gcTime: 60_000,
      retry: 1,
    })),
  })
  const remoteSources = new Map(
    remoteURLs.map((url, i) => [url, queries[i].data])
  )
  const sources = images.map((image) => ({
    ...image,
    src: image.data
      ? `data:${image.content_type};base64,${image.data}`
      : (remoteSources.get(image.url ?? '') ??
        'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs='),
  }))
  const imageSources = Object.fromEntries(
    sources
      .filter((image) => image.id)
      .map((image) => [`cid:notification-image-${image.id}`, image.src])
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
      {sources
        .filter((image) => !image.id)
        .map((image) => (
          <img
            key={image.url || `${image.filename}-${image.data.slice(-32)}`}
            src={image.src}
            loading='lazy'
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
