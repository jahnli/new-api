import { useQuery } from '@tanstack/react-query'
import { getRouteApi, useNavigate } from '@tanstack/react-router'
import type { OnChangeFn, PaginationState } from '@tanstack/react-table'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { DataTablePage, useDataTable } from '@/components/data-table'

import { getImageAudit } from '../api'
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

  const columns = useImageAuditColumns(handlePreview, handleViewRequestContent)

  const { table } = useDataTable({
    data: items,
    columns,
    enableRowSelection: false,
    getRowId: (row) => row.id,
    pagination,
    onPaginationChange,
    manualPagination: true,
    manualFiltering: true,
    totalCount: total,
  })

  return (
    <>
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
        toolbarProps={null}
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
