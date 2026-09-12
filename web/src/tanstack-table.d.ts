import '@tanstack/react-table'

declare module '@tanstack/react-table' {
  interface ColumnMeta<_TData, _TValue> {
    label?: string
    description?: string
    className?: string
    headerClassName?: string
    pinned?: 'left' | 'right'
    /**
     * Sort options for a column that merges several metrics. When present, the
     * shared column header lets the user pick which field to sort by.
     *
     * Structurally identical to `DataTableSortField` in
     * `@/components/data-table/core/types`; declared inline because importing a
     * type into this module augmentation degrades it to `any`.
     */
    sortFields?: { id: string; label: string }[]
    // Mobile card list layout hints (used by MobileCardList)
    mobileTitle?: boolean // card title area (left, larger text)
    mobileBadge?: boolean // status badge alongside title (right)
    mobileHidden?: boolean // hide this column on mobile entirely
    mobileOrder?: number // lower values appear first in card field area
  }
}
