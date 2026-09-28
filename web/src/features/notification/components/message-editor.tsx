import {
  Bold,
  Code,
  Eye,
  Heading,
  ImagePlus,
  Info,
  Italic,
  Link,
  List,
  Table2,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Dialog } from '@/components/dialog'
import { TextTooltip } from '@/components/text-tooltip'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable'
import { Textarea } from '@/components/ui/textarea'
import { useIsMobile } from '@/hooks/use-mobile'
import { handleServerError } from '@/lib/handle-server-error'
import { cn } from '@/lib/utils'

import {
  formatNotificationTitle,
  missingNotificationImages,
} from '../lib/message'
import { NOTIFICATION_TITLE_THEME_CLASSES } from '../lib/title-theme'
import { useNotificationLayout } from '../store'
import type { NotificationImage, NotificationMessage } from '../types'
import { MessageContent } from './message-content'

interface Props {
  message: NotificationMessage
  onChange: (content: string, images?: NotificationImage[]) => void
  onProcessingChange: (processing: boolean) => void
}

export function MessageEditor(props: Props) {
  const { t } = useTranslation()
  const editor = useRef<HTMLTextAreaElement>(null)
  const selection = useRef({
    start: props.message.content.length,
    end: props.message.content.length,
  })
  const fileInput = useRef<HTMLInputElement>(null)
  const processing = useRef(false)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  const [uploading, setUploading] = useState(false)
  const [urlDialog, setUrlDialog] = useState<'link' | 'image' | null>(null)
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const isMobile = useIsMobile()
  const layout = useNotificationLayout((state) => state.layout)
  const preview = useNotificationLayout((state) => state.preview)
  const setLayout = useNotificationLayout((state) => state.setLayout)
  const setPreview = useNotificationLayout((state) => state.setPreview)
  const missingImages = missingNotificationImages(props.message)
  const channelLabel = {
    feishu: t('Feishu'),
    dingtalk: t('DingTalk'),
    email: t('Email'),
  }[props.message.channel]
  const previewHint = t(
    'Preview is approximate. Send a test to verify channel formatting.'
  )

  const insert = (before: string, after = '') => {
    if (processing.current) return
    const element = editor.current
    const { start, end } = selection.current
    const selected = props.message.content.slice(start, end)
    props.onChange(
      props.message.content.slice(0, start) +
        before +
        selected +
        after +
        props.message.content.slice(end)
    )
    requestAnimationFrame(() => {
      element?.focus()
      element?.setSelectionRange(start + before.length, end + before.length)
      selection.current = {
        start: start + before.length,
        end: end + before.length,
      }
    })
  }

  const insertImages = (
    images: NotificationImage[],
    attachments: NotificationImage[]
  ) => {
    const { start, end } = selection.current
    const references = images
      .map((image) => {
        const filename = image.filename
          .replaceAll(/[\\`*_[\]{}()<>!$]/g, '\\$&')
          .replaceAll(/[\r\n]/g, ' ')
        return `![${filename}](cid:notification-image-${image.id})`
      })
      .join('\n\n')
    const insertion = `\n\n${references}\n\n`
    props.onChange(
      props.message.content.slice(0, start) +
        insertion +
        props.message.content.slice(end),
      attachments
    )
    const position = start + insertion.length
    selection.current = { start: position, end: position }
    requestAnimationFrame(() => {
      editor.current?.focus()
      editor.current?.setSelectionRange(position, position)
    })
  }

  const setProcessing = (value: boolean) => {
    processing.current = value
    setUploading(value)
    props.onProcessingChange(value)
  }

  const addImages = async (
    files: File[],
    importingUrl = false
  ): Promise<boolean> => {
    if ((!importingUrl && processing.current) || !files.length) return false
    if (files.length + props.message.images.length > 10) {
      setError(t('You can attach up to 10 images.'))
      return false
    }
    if (
      files.some(
        (file) =>
          !['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(
            file.type
          )
      )
    ) {
      setError(t('Only JPEG, PNG, GIF, and WebP images are supported.'))
      return false
    }
    if (files.some((file) => file.size <= 0 || file.size > 15 * 1024 * 1024)) {
      setError(t('Each image must be no larger than 15 MiB.'))
      return false
    }
    if (!importingUrl) setProcessing(true)
    try {
      const images = await Promise.all(
        files.map(
          (file) =>
            new Promise<NotificationImage>((resolve, reject) => {
              const reader = new FileReader()
              reader.addEventListener(
                'load',
                () =>
                  resolve({
                    id: crypto.randomUUID(),
                    filename: file.name,
                    content_type: file.type,
                    data: String(reader.result).split(',')[1],
                  }),
                { once: true }
              )
              reader.addEventListener('error', () => reject(reader.error), {
                once: true,
              })
              reader.readAsDataURL(file)
            })
        )
      )
      const uniqueImages = [...props.message.images]
      const insertedImages: NotificationImage[] = []
      for (const image of images) {
        const existingIndex = uniqueImages.findIndex(
          (existing) => existing.data === image.data
        )
        if (existingIndex === -1) {
          uniqueImages.push(image)
          insertedImages.push(image)
        } else {
          const existing = uniqueImages[existingIndex]
          const identified = { ...existing, id: existing.id || image.id }
          uniqueImages[existingIndex] = identified
          insertedImages.push(identified)
        }
      }
      if (!mounted.current) return false
      insertImages(insertedImages, uniqueImages)
      setError('')
      return true
    } catch (cause) {
      handleServerError(cause)
      return false
    } finally {
      if (!importingUrl && mounted.current) setProcessing(false)
    }
  }

  const addUrl = async () => {
    if (processing.current) return
    let parsed: URL
    try {
      parsed = new URL(url)
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error()
    } catch {
      setError(t('Please enter a valid URL'))
      return
    }
    if (urlDialog === 'link') {
      insert('[', `](${parsed.href})`)
      setUrlDialog(null)
      setUrl('')
      return
    }
    setProcessing(true)
    try {
      const response = await fetch(parsed.href, {
        credentials: 'omit',
        signal: AbortSignal.timeout(15000),
      })
      if (!response.ok) {
        throw new Error(t('Unable to load image. Try uploading it instead.'))
      }
      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error(t('Unable to load image. Try uploading it instead.'))
      }
      const chunks: Uint8Array<ArrayBuffer>[] = []
      let size = 0
      while (true) {
        const chunk = await reader.read()
        if (chunk.done) break
        size += chunk.value.length
        if (size > 15 * 1024 * 1024) {
          await reader.cancel()
          throw new Error(t('Each image must be no larger than 15 MiB.'))
        }
        chunks.push(chunk.value)
      }
      const blob = new Blob(chunks, {
        type: response.headers.get('content-type')?.split(';')[0] ?? '',
      })
      const added = await addImages(
        [
          new File(
            [blob],
            decodeURIComponent(parsed.pathname.split('/').pop() || 'image'),
            { type: blob.type }
          ),
        ],
        true
      )
      if (!added) return
      setUrlDialog(null)
      setUrl('')
    } catch (cause) {
      handleServerError(
        cause,
        t('Unable to load image. Try uploading it instead.')
      )
    } finally {
      if (mounted.current) setProcessing(false)
    }
  }

  const toolbar = [
    { label: t('Bold'), icon: Bold, action: () => insert('**', '**') },
    { label: t('Italic'), icon: Italic, action: () => insert('*', '*') },
    { label: t('Heading'), icon: Heading, action: () => insert('\n## ') },
    { label: t('List'), icon: List, action: () => insert('\n- ') },
    {
      label: t('Code'),
      icon: Code,
      action: () => insert('\n```\n', '\n```\n'),
    },
    {
      label: t('Link'),
      icon: Link,
      action: () => {
        setError('')
        setUrlDialog('link')
      },
    },
    {
      label: t('Table'),
      icon: Table2,
      action: () => insert('\n|  |  |\n| --- | --- |\n|  |  |\n'),
    },
  ]

  return (
    <section
      className='bg-card overflow-hidden rounded-xl border'
      onKeyDown={(event) => {
        if (processing.current) return
        if (urlDialog !== null) return
        if (!(event.ctrlKey || event.metaKey)) return
        const key = event.key.toLowerCase()
        if (['b', 'i', 'k'].includes(key)) event.preventDefault()
        if (key === 'b') insert('**', '**')
        if (key === 'i') insert('*', '*')
        if (key === 'k') setUrlDialog('link')
      }}
    >
      <div className='bg-muted/20 flex flex-wrap items-center gap-1 border-b p-2'>
        {toolbar.map((tool) => (
          <Button
            key={tool.label}
            type='button'
            variant='ghost'
            size='icon-sm'
            aria-label={tool.label}
            title={tool.label}
            onClick={tool.action}
            disabled={uploading}
          >
            <tool.icon className='size-4' aria-hidden='true' />
          </Button>
        ))}
        <span className='bg-border mx-1 h-5 w-px' />
        <Button
          type='button'
          variant='ghost'
          size='icon-sm'
          title={t('Add images')}
          aria-label={t('Add images')}
          disabled={uploading || props.message.images.length >= 10}
          onClick={() => fileInput.current?.click()}
        >
          <ImagePlus className='size-4' aria-hidden='true' />
        </Button>
        <Button
          type='button'
          variant='ghost'
          size='sm'
          disabled={uploading || props.message.images.length >= 10}
          onClick={() => {
            setError('')
            setUrlDialog('image')
          }}
        >
          {t('Image URL')}
        </Button>
        <div className='ml-auto flex gap-1'>
          <Button
            type='button'
            variant={preview ? 'secondary' : 'ghost'}
            size='icon-sm'
            aria-label={t('Preview')}
            title={t('Preview')}
            aria-pressed={preview}
            onClick={() => setPreview(!preview)}
          >
            <Eye className='size-4' aria-hidden='true' />
          </Button>
        </div>
        <input
          ref={fileInput}
          aria-label={t('Notification images')}
          className='sr-only'
          type='file'
          accept='image/jpeg,image/png,image/gif,image/webp'
          multiple
          onChange={(event) => {
            void addImages([...(event.target.files ?? [])])
            event.target.value = ''
          }}
        />
      </div>
      <div className='min-h-[420px]'>
        <ResizablePanelGroup
          orientation={isMobile ? 'vertical' : 'horizontal'}
          defaultLayout={layout}
          onLayoutChanged={setLayout}
          className='min-h-[420px]'
        >
          <ResizablePanel id='editor' minSize='25%'>
            <div className='flex h-full min-h-[320px] flex-col'>
              <div className='text-muted-foreground px-4 pt-3 text-xs font-medium'>
                Markdown
              </div>
              <Textarea
                ref={editor}
                id='notification-content'
                aria-label={t('Content')}
                value={props.message.content}
                readOnly={uploading}
                onSelect={(event) => {
                  if (!processing.current) {
                    selection.current = {
                      start: event.currentTarget.selectionStart,
                      end: event.currentTarget.selectionEnd,
                    }
                  }
                }}
                onBlur={(event) => {
                  if (!processing.current) {
                    selection.current = {
                      start: event.currentTarget.selectionStart,
                      end: event.currentTarget.selectionEnd,
                    }
                  }
                }}
                onChange={(event) => props.onChange(event.target.value)}
                placeholder={t('Write your message.')}
                className='min-h-[350px] flex-1 resize-none rounded-none border-0 bg-transparent p-4 font-mono text-sm shadow-none focus-visible:ring-0'
                onDragOver={(event) => {
                  if (!event.dataTransfer.types.includes('Files')) return
                  event.preventDefault()
                  const blocked =
                    processing.current ||
                    event.currentTarget.matches(':disabled')
                  event.dataTransfer.dropEffect = blocked ? 'none' : 'copy'
                }}
                onDrop={(event) => {
                  if (!event.dataTransfer.types.includes('Files')) return
                  event.preventDefault()
                  event.stopPropagation()
                  if (
                    processing.current ||
                    event.currentTarget.matches(':disabled')
                  ) {
                    return
                  }
                  void addImages([...event.dataTransfer.files])
                }}
                onPaste={(event) => {
                  const files = [...event.clipboardData.files].filter((file) =>
                    file.type.startsWith('image/')
                  )
                  if (files.length) {
                    event.preventDefault()
                    void addImages(files)
                  }
                }}
              />
            </div>
          </ResizablePanel>
          {preview && (
            <>
              <ResizableHandle withHandle />
              <ResizablePanel id='preview' minSize='25%'>
                <div className='bg-muted/25 flex h-full min-h-[320px] min-w-0 flex-col'>
                  <div className='bg-background/70 flex items-center justify-between gap-3 border-b px-3 py-2'>
                    <div className='flex flex-wrap items-center gap-2 text-sm font-medium'>
                      <Eye
                        className='text-muted-foreground size-4'
                        aria-hidden='true'
                      />
                      {t('Live preview')}
                      <span
                        className='text-muted-foreground'
                        aria-hidden='true'
                      >
                        ·
                      </span>
                      <span className='text-muted-foreground'>
                        {channelLabel}
                      </span>
                    </div>
                    <TextTooltip content={previewHint}>
                      <Button
                        type='button'
                        variant='ghost'
                        size='icon-sm'
                        aria-label={previewHint}
                      >
                        <Info
                          className='text-muted-foreground size-4'
                          aria-hidden='true'
                        />
                      </Button>
                    </TextTooltip>
                  </div>
                  <div className='from-background/20 to-muted/40 min-w-0 flex-1 overflow-auto bg-gradient-to-b p-3.5'>
                    <div className='w-full min-w-0'>
                      <Card
                        data-card-hover='false'
                        className='-translate-y-px gap-0 rounded-lg border-0 py-0 shadow-[0_4px_12px_rgb(0_0_0/0.06)] ring-0 dark:shadow-[0_4px_12px_rgb(0_0_0/0.3)]'
                      >
                        <CardHeader
                          className={cn(
                            'rounded-t-lg border-0 p-3.5',
                            props.message.channel === 'feishu' &&
                              NOTIFICATION_TITLE_THEME_CLASSES[
                                props.message.title_theme ?? 'blue'
                              ],
                            props.message.channel === 'dingtalk' &&
                              'bg-sky-500/7',
                            props.message.channel === 'email' && 'bg-muted/30'
                          )}
                        >
                          <h3 className='text-base leading-relaxed font-semibold break-words'>
                            {formatNotificationTitle({
                              ...props.message,
                              title:
                                props.message.title.trim() || t('Untitled'),
                            })}
                          </h3>
                        </CardHeader>
                        <CardContent className='min-w-0 p-3.5 sm:p-3.5'>
                          <MessageContent
                            message={props.message}
                            className='text-sm leading-7'
                            placeholder={t(
                              'Your message preview appears here.'
                            )}
                          />
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </div>
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </div>
      <div className='bg-muted/10 space-y-2 border-t p-3'>
        <div className='text-muted-foreground flex flex-wrap justify-between gap-2 text-sm'>
          <span>
            {t('Up to 10 images, 15 MiB each. Drag, paste or upload images.')}
          </span>
          <span>Ctrl / ⌘ + B · I · K</span>
        </div>
        {missingImages.length > 0 && (
          <p role='alert' className='text-destructive text-xs'>
            {t('Notification images')}: {t('Content not found.')}
          </p>
        )}
        {error && (
          <p role='alert' className='text-destructive text-xs'>
            {error}
          </p>
        )}
      </div>
      <Dialog
        open={urlDialog !== null}
        onOpenChange={(open) => {
          if (!open && !uploading) setUrlDialog(null)
        }}
        title={urlDialog === 'image' ? t('Image URL') : t('Link')}
        footer={
          <Button
            type='button'
            disabled={!url.trim() || uploading}
            onClick={() => void addUrl()}
          >
            {uploading ? t('Loading...') : t('Insert')}
          </Button>
        }
      >
        <div className='space-y-3'>
          <Label htmlFor='notification-url'>URL</Label>
          <Input
            id='notification-url'
            type='url'
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder='https://'
          />
          {error && (
            <p role='alert' className='text-destructive text-sm'>
              {error}
            </p>
          )}
        </div>
      </Dialog>
    </section>
  )
}
