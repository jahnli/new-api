import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileText, Pencil, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { Dialog } from '@/components/dialog'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
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
import { notificationDate } from '../lib/message'
import type {
  LibraryFilters,
  LibraryKind,
  SavedNotification,
  SavedNotificationSummary,
} from '../types'

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
    scope: 'all',
  })
  const [editing, setEditing] = useState<SavedNotification | null>(null)
  const [deleting, setDeleting] = useState<SavedNotificationSummary | null>(
    null
  )
  const query = useQuery({
    queryKey: notificationKeys.libraryPage(props.kind, filters),
    queryFn: () => getLibrary(props.kind, filters),
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
    mutationFn: (entry: SavedNotification) =>
      saveLibrary(props.kind, {
        ...entry,
        is_public: Boolean(config.data?.can_send && entry.is_public),
      }),
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
      <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-3'>
        {items.map((entry) => {
          const canEdit = entry.is_public
            ? config.data?.can_send
            : entry.user_id === userId
          return (
            <Card
              key={entry.id}
              className='gap-0 overflow-hidden shadow-none transition-shadow hover:shadow-md'
            >
              <CardContent className='space-y-4 pt-5'>
                <div className='flex items-center gap-2'>
                  <div className='bg-primary/10 text-primary rounded-lg p-2'>
                    <FileText className='size-4' />
                  </div>
                  <Badge variant='outline'>{entry.channel}</Badge>
                </div>
                <div>
                  <h3 className='truncate font-semibold'>{entry.name}</h3>
                  <p className='text-muted-foreground mt-2 line-clamp-3 min-h-15 text-sm'>
                    {entry.summary}
                  </p>
                </div>
                <p className='text-muted-foreground text-xs'>
                  {notificationDate(entry.updated_at, locale)}
                </p>
                <div className='flex items-center gap-1 border-t pt-3'>
                  <Button
                    variant='outline'
                    size='sm'
                    disabled={load.isPending}
                    onClick={() => load.mutate({ id: entry.id, edit: false })}
                  >
                    {t('Use template')}
                  </Button>
                  {canEdit && (
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
                        <Pencil className='size-4' />
                      </Button>
                      <Button
                        variant='ghost'
                        size='icon-sm'
                        aria-label={t('Delete')}
                        className='text-muted-foreground hover:text-destructive ml-auto'
                        onClick={() => setDeleting(entry)}
                      >
                        <Trash2 className='size-4' />
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
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
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
        title={t('Edit')}
        footer={
          <Button
            disabled={!editing?.name.trim() || update.isPending}
            onClick={() => {
              if (editing) update.mutate(editing)
            }}
          >
            {t('Save')}
          </Button>
        }
      >
        {editing && (
          <div className='space-y-5'>
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
            {config.data?.can_send && (
              <div className='flex items-center justify-between'>
                <Label htmlFor='library-public'>{t('Public template')}</Label>
                <Switch
                  id='library-public'
                  checked={editing.is_public ?? false}
                  onCheckedChange={(checked) =>
                    setEditing({ ...editing, is_public: checked })
                  }
                />
              </div>
            )}
            <Button
              variant='outline'
              onClick={() => {
                props.onLoad(editing, props.kind)
                setEditing(null)
              }}
            >
              {t('Edit content')}
            </Button>
          </div>
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
