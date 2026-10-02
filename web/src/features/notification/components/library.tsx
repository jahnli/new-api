import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileText, Pencil, Plus, Trash2, WandSparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { StaticDataTable } from '@/components/data-table'
import { Dialog } from '@/components/dialog'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { toIntlLocale } from '@/i18n/languages'
import { useAuthStore } from '@/stores/auth-store'

import {
  deleteLibrary,
  getLibrary,
  getLibraryEntry,
  getNotificationConfig,
  notificationKeys,
  saveLibrary,
} from '../api'
import { formatNotificationTitle, notificationDate } from '../lib/message'
import type {
  LibraryFilters,
  LibraryKind,
  SavedNotification,
  SavedNotificationSummary,
} from '../types'
import { MessageContent } from './message-content'
import { MessageEditor } from './message-editor'

export function NotificationLibrary(props: {
  kind: LibraryKind
  onLoad: (entry: SavedNotification, kind: LibraryKind) => void
  onCreate: () => void
}) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const userId = useAuthStore((state) => state.auth.user?.id)
  const client = useQueryClient()
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<LibraryFilters>({
    page: 1,
    page_size: 20,
    keyword: '',
  })
  const [editing, setEditing] = useState<SavedNotification | null>(null)
  const [processingImages, setProcessingImages] = useState(false)
  const [previewId, setPreviewId] = useState<number | null>(null)
  const [deleting, setDeleting] = useState<SavedNotificationSummary | null>(
    null
  )
  const query = useQuery({
    queryKey: notificationKeys.libraryPage(props.kind, filters),
    queryFn: () => getLibrary(props.kind, filters),
  })
  const preview = useQuery({
    queryKey: [...notificationKeys.library(props.kind), 'preview', previewId],
    queryFn: () => {
      if (previewId === null) throw new Error('No template selected')
      return getLibraryEntry(props.kind, previewId)
    },
    enabled: previewId !== null,
  })
  useEffect(() => {
    const timeout = window.setTimeout(
      () =>
        setFilters((current) => ({
          ...current,
          page: 1,
          keyword: search.trim(),
        })),
      350
    )
    return () => window.clearTimeout(timeout)
  }, [search])
  const config = useQuery({
    queryKey: notificationKeys.config,
    queryFn: getNotificationConfig,
  })
  const load = useMutation({
    mutationFn: (value: { id: number; edit: boolean }) =>
      getLibraryEntry(props.kind, value.id),
    onSuccess: (entry, value) => {
      if (value.edit) setEditing(entry)
      else props.onLoad(entry, props.kind)
    },
  })
  const update = useMutation({
    mutationFn: (entry: SavedNotification) => saveLibrary(props.kind, entry),
    onSuccess: () => {
      setEditing(null)
      void client.invalidateQueries({
        queryKey: notificationKeys.library(props.kind),
      })
      toast.success(t('Saved successfully'))
    },
  })
  const remove = useMutation({
    mutationFn: (id: number) => deleteLibrary(props.kind, id),
    onSuccess: () => {
      setDeleting(null)
      if (query.data?.items.length === 1 && filters.page > 1) {
        setFilters((current) => ({ ...current, page: current.page - 1 }))
      }
      void client.invalidateQueries({
        queryKey: notificationKeys.library(props.kind),
      })
      toast.success(t('Deleted successfully'))
    },
  })
  const items = query.data?.items ?? []

  return (
    <div className='space-y-5'>
      <div className='flex flex-wrap items-center gap-3'>
        <Input
          aria-label={t('Search')}
          placeholder={t('Search')}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className='max-w-sm'
        />
        <Button className='ml-auto' onClick={props.onCreate}>
          <Plus className='size-4' />
          {t('New message')}
        </Button>
      </div>
      {query.isPending && (
        <div className='flex justify-center p-16'>
          <Spinner />
        </div>
      )}
      {query.isError && <ErrorState onRetry={() => void query.refetch()} />}
      {query.isSuccess && !items.length && (
        <EmptyState
          icon={FileText}
          title={t('No templates yet')}
          description={t('Save a message to keep it here for next time.')}
        />
      )}
      {query.isSuccess && items.length > 0 && (
        <StaticDataTable
          data={items}
          getRowKey={(entry) => entry.id}
          tableClassName='min-w-[960px] table-fixed'
          columns={[
            {
              id: 'name',
              header: t('Name'),
              className: 'w-[250px]',
              cellClassName: 'max-w-[250px] font-medium',
              cell: (entry) => entry.name,
            },
            {
              id: 'summary',
              header: t('Content'),
              cellClassName: 'text-muted-foreground',
              cell: (entry) => (
                <Button
                  variant='ghost'
                  className='hover:text-foreground h-auto w-full min-w-0 justify-start px-0 py-1 text-left font-normal'
                  aria-label={`${t('Preview')}: ${entry.name}`}
                  onClick={() => setPreviewId(entry.id)}
                >
                  <span className='truncate'>{entry.summary || '—'}</span>
                </Button>
              ),
            },
            {
              id: 'channel',
              header: t('Channel'),
              className: 'w-[120px] px-[18px]',
              cellClassName: 'px-[18px]',
              cell: (entry) =>
                ({
                  feishu: t('Feishu'),
                  dingtalk: t('DingTalk'),
                  email: t('Email'),
                })[entry.channel],
            },
            {
              id: 'updated_at',
              header: t('Updated At'),
              className: 'w-[210px] px-[18px] whitespace-nowrap',
              cellClassName: 'px-[18px] whitespace-nowrap',
              cell: (entry) => notificationDate(entry.updated_at, locale),
            },
            {
              id: 'actions',
              header: t('Actions'),
              className: 'w-[190px] px-[18px] whitespace-nowrap',
              cellClassName: 'px-[18px]',
              cell: (entry) => (
                <div className='flex items-center gap-1'>
                  <Button
                    variant='ghost'
                    size='icon-sm'
                    aria-label={t('Use template')}
                    disabled={load.isPending}
                    onClick={() => load.mutate({ id: entry.id, edit: false })}
                  >
                    <WandSparkles className='size-4' aria-hidden='true' />
                  </Button>
                  {(config.data?.can_send || entry.user_id === userId) && (
                    <>
                      <Button
                        variant='ghost'
                        size='icon-sm'
                        aria-label={t('Edit')}
                        disabled={load.isPending}
                        onClick={() =>
                          load.mutate({ id: entry.id, edit: true })
                        }
                      >
                        <Pencil className='size-4' aria-hidden='true' />
                      </Button>
                      <Button
                        variant='ghost'
                        size='icon-sm'
                        aria-label={t('Delete')}
                        className='text-muted-foreground hover:text-destructive'
                        onClick={() => setDeleting(entry)}
                      >
                        <Trash2 className='size-4' aria-hidden='true' />
                      </Button>
                    </>
                  )}
                </div>
              ),
            },
          ]}
        />
      )}
      <div className='flex justify-end gap-2'>
        <Button
          variant='outline'
          size='sm'
          disabled={filters.page <= 1 || query.isFetching}
          onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
        >
          {t('Previous')}
        </Button>
        <Button
          variant='outline'
          size='sm'
          disabled={
            filters.page * filters.page_size >= (query.data?.total ?? 0) ||
            query.isFetching
          }
          onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
        >
          {t('Next')}
        </Button>
      </div>
      <Dialog
        open={previewId !== null}
        onOpenChange={(open) => {
          if (!open) setPreviewId(null)
        }}
        title={t('Preview')}
        description={preview.data?.name}
        contentClassName='sm:max-w-4xl'
        contentHeight='min(70vh, 720px)'
      >
        {preview.isPending && (
          <div className='flex justify-center p-16'>
            <Spinner />
          </div>
        )}
        {preview.isError && (
          <ErrorState onRetry={() => void preview.refetch()} />
        )}
        {preview.isSuccess && (
          <div className='space-y-4'>
            <h3 className='text-lg font-semibold break-words'>
              {formatNotificationTitle(preview.data.message)}
            </h3>
            <MessageContent message={preview.data.message} />
          </div>
        )}
      </Dialog>
      <Dialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open && !processingImages && !update.isPending) setEditing(null)
        }}
        title={t('Edit')}
        contentClassName='sm:max-w-6xl'
        footer={
          <Button
            disabled={
              !editing?.name.trim() || processingImages || update.isPending
            }
            onClick={() => {
              if (editing) update.mutate(editing)
            }}
          >
            {t('Save')}
          </Button>
        }
      >
        {editing && (
          <fieldset disabled={update.isPending} className='min-w-0 space-y-5'>
            <div className='space-y-2'>
              <Label htmlFor='library-name'>{t('Name')}</Label>
              <Input
                id='library-name'
                value={editing.name}
                maxLength={128}
                onChange={(event) =>
                  setEditing({ ...editing, name: event.target.value })
                }
              />
            </div>
            <MessageEditor
              key={editing.id}
              message={editing.message}
              onChange={(content, images) => {
                setEditing((current) => {
                  if (!current) return current
                  return {
                    ...current,
                    message: {
                      ...current.message,
                      content,
                      images: images ?? current.message.images,
                    },
                  }
                })
              }}
              onProcessingChange={setProcessingImages}
            />
          </fieldset>
        )}
      </Dialog>
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
        title={t('Delete')}
        desc={t('This action cannot be undone.')}
        destructive
        confirmText={t('Delete')}
        isLoading={remove.isPending}
        handleConfirm={() => {
          if (deleting) remove.mutate(deleting.id)
        }}
      />
    </div>
  )
}
