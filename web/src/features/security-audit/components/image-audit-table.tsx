import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi, useNavigate } from '@tanstack/react-router'
import type { OnChangeFn, PaginationState } from '@tanstack/react-table'
import { Trash2 } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import {
  DataTableBulkActions,
  DataTablePage,
  useDataTable,
} from '@/components/data-table'
import { Button } from '@/components/ui/button'
import { handleServerError } from '@/lib/handle-server-error'

import { deleteImageAudit, getImageAudit } from '../api'
import type { ImageAuditItem, ImageAuditPreviewTarget } from '../types'
import { useImageAuditColumns } from './image-audit-columns'
import { ImageAuditPreviewDialog } from './image-audit-preview-dialog'
import { ImageAuditRequestContentDialog } from './image-audit-request-content-dialog'

const route = getRouteApi('/_authenticated/usage-logs/audit')

interface ImageAuditTableProps {
  startTimestamp: number
  endTimestamp: number
  username: string
}

export function ImageAuditTable(props: ImageAuditTableProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const search = route.useSearch()
  const queryClient = useQueryClient()
  const [deleteTargets, setDeleteTargets] = useState<string[]>([])

  const pagination: PaginationState = {
    pageIndex: (search.imageAuditPage ?? 1) - 1,
    pageSize: search.imageAuditPageSize ?? 10,
  }

  const onPaginationChange: OnChangeFn<PaginationState> = useCallback(
    (updater) => {
      const next = typeof updater === 'function' ? updater(pagination) : updater
      void navigate({
        to: '/usage-logs/audit',
        search: (prev: Record<string, unknown>) => ({
          ...prev,
          imageAuditPage: next.pageIndex + 1,
          imageAuditPageSize: next.pageSize,
        }),
      })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [navigate, pagination.pageIndex, pagination.pageSize]
  )

  const { data, isLoading, isFetching } = useQuery({
    queryKey: [
      'security-audit',
      'image-studio',
      props.startTimestamp,
      props.endTimestamp,
      props.username,
      pagination.pageIndex,
      pagination.pageSize,
    ],
    queryFn: () =>
      getImageAudit({
        p: pagination.pageIndex + 1,
        page_size: pagination.pageSize,
        start_timestamp: props.startTimestamp,
        end_timestamp: props.endTimestamp,
        username: props.username || undefined,
      }),
    staleTime: 60 * 1000,
  })

  const items = useMemo(() => data?.data?.items ?? [], [data])
  const total = data?.data?.total ?? 0

  const [previewTarget, setPreviewTarget] =
    useState<ImageAuditPreviewTarget | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [requestContentItem, setRequestContentItem] =
    useState<ImageAuditItem | null>(null)
  const [requestContentOpen, setRequestContentOpen] = useState(false)

  const handlePreview = useCallback((item: ImageAuditItem, index: number) => {
    setPreviewTarget({ item, index })
    setPreviewOpen(true)
  }, [])
  const handleViewRequestContent = useCallback((item: ImageAuditItem) => {
    setRequestContentItem(item)
    setRequestContentOpen(true)
  }, [])
  const handleRequestContentOpenChange = useCallback(
    (open: boolean) => {
      if (!open && previewOpen) return
      setRequestContentOpen(open)
    },
    [previewOpen]
  )

  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const deletedIds: string[] = []
      const failures: Array<{ id: string; error: unknown }> = []
      for (const id of ids) {
        try {
          await deleteImageAudit(id)
          deletedIds.push(id)
        } catch (error) {
          failures.push({ id, error })
        }
      }
      return { deletedIds, failures }
    },
    onSuccess: async ({ deletedIds, failures }) => {
      setDeleteTargets([])
      table.setRowSelection(
        Object.fromEntries(failures.map(({ id }) => [id, true]))
      )
      setPreviewOpen(false)
      setPreviewTarget(null)
      setRequestContentOpen(false)
      setRequestContentItem(null)
      if (failures.length > 0) {
        handleServerError(failures[0].error)
      } else {
        toast.success(t('Deleted successfully'))
      }
      if (deletedIds.length === items.length && pagination.pageIndex > 0) {
        onPaginationChange({
          ...pagination,
          pageIndex: pagination.pageIndex - 1,
        })
      }
      await queryClient.invalidateQueries({
        queryKey: ['security-audit', 'image-studio'],
      })
    },
  })

  const columns = useImageAuditColumns(handlePreview, handleViewRequestContent)

  const { table } = useDataTable({
    data: items,
    columns,
    enableRowSelection: !deleteMutation.isPending,
    getRowId: (row) => row.id,
    pagination,
    onPaginationChange,
    manualPagination: true,
    manualFiltering: true,
    totalCount: total,
  })

  return (
    <>
      <ConfirmDialog
        open={deleteTargets.length > 0}
        onOpenChange={(open) => {
          if (!open && !deleteMutation.isPending) setDeleteTargets([])
        }}
        title={t('Delete')}
        desc={t(
          'Permanently delete {{count}} selected generation records, their request content, and all their stored images? This cannot be undone. Billing logs and charges are retained.',
          { count: deleteTargets.length }
        )}
        confirmText={t('Delete')}
        destructive
        isLoading={deleteMutation.isPending}
        handleConfirm={() => {
          if (deleteTargets.length > 0 && !deleteMutation.isPending) {
            deleteMutation.mutate(deleteTargets)
          }
        }}
      />
      <DataTablePage
        table={table}
        columns={columns}
        isLoading={isLoading}
        isFetching={isFetching}
        emptyTitle={t('No image generations')}
        emptyDescription={t(
          'No image generation records were found in this time range.'
        )}
        skeletonKeyPrefix='security-audit-image-studio'
        fitContainer
        getColumnClassName={(columnId) =>
          columnId === 'quota'
            ? 'px-1 whitespace-normal [overflow-wrap:anywhere]'
            : 'px-2 whitespace-normal [overflow-wrap:anywhere]'
        }
        toolbarProps={null}
        bulkActions={
          <DataTableBulkActions table={table} entityName=''>
            <Button
              variant='destructive'
              size='sm'
              disabled={deleteMutation.isPending}
              onClick={() =>
                setDeleteTargets(
                  table
                    .getFilteredSelectedRowModel()
                    .rows.map((row) => row.original.id)
                )
              }
            >
              <Trash2 className='size-4' aria-hidden='true' />
              {t('Delete')}
            </Button>
          </DataTableBulkActions>
        }
        tableClassName='[&_[data-slot=table]]:text-[13px] [&_[data-slot=table]_td]:text-[13px] [&_[data-slot=table]_td_*]:text-[13px] [&_[data-slot=table]_th]:text-[13px] [&_[data-slot=table]_th_*]:text-[13px]'
      />
      <ImageAuditPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        target={previewTarget}
      />
      <ImageAuditRequestContentDialog
        open={requestContentOpen}
        onOpenChange={handleRequestContentOpenChange}
        item={requestContentItem}
        onPreview={handlePreview}
      />
    </>
  )
}
