import {
  AlertCircle,
  Building2,
  Check,
  ChevronRight,
  Loader2,
  Search,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { TextTooltip } from '@/components/text-tooltip'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { isDepartmentNodeDisabled } from '@/features/data-overview/lib/department-selection'
import type { DeptTreeNode } from '@/features/data-overview/types'
import { cn } from '@/lib/utils'

interface DeptMultiSelectProps {
  treeData: DeptTreeNode[]
  value: string[]
  onValueChange: (selectedValues: string[]) => void
  placeholder?: string
  disabled?: boolean
  isLoading?: boolean
}

export function DeptMultiSelect(props: DeptMultiSelectProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [activePath, setActivePath] = useState<DeptTreeNode[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)

  const selectedSet = useMemo(() => new Set(props.value), [props.value])

  useEffect(() => {
    if (open) {
      setActivePath([])
      setTimeout(() => searchInputRef.current?.focus(), 80)
    } else {
      setSearchQuery('')
    }
  }, [open])

  const selectedLabels = useMemo(() => {
    const result: { value: string; label: string }[] = []
    const visit = (nodes: DeptTreeNode[], breadcrumb: string) => {
      for (const node of nodes) {
        const path = breadcrumb ? `${breadcrumb} / ${node.label}` : node.label
        if (selectedSet.has(node.value)) {
          result.push({ value: node.value, label: node.label })
        }
        visit(node.children, path)
      }
    }
    visit(props.treeData, '')
    return result
  }, [props.treeData, selectedSet])

  const handleToggle = useCallback(
    (node: DeptTreeNode) => {
      if (node.disabled) return
      const next = new Set(selectedSet)
      if (next.has(node.value)) {
        next.delete(node.value)
      } else {
        next.add(node.value)
      }
      props.onValueChange([...next])
    },
    [selectedSet, props]
  )

  const handleRemoveTag = useCallback(
    (nodeValue: string, event: React.MouseEvent) => {
      event.stopPropagation()
      props.onValueChange(props.value.filter((v) => v !== nodeValue))
    },
    [props]
  )

  const handleHover = useCallback((node: DeptTreeNode, depth: number) => {
    setActivePath((prev) => {
      const next = prev.slice(0, depth)
      next.push(node)
      return next
    })
  }, [])

  const columns = useMemo(() => {
    if (searchQuery.trim()) return []
    const columnList: { key: string; depth: number; nodes: DeptTreeNode[] }[] =
      [{ key: 'root', depth: 0, nodes: props.treeData }]
    let currentNodes = props.treeData
    for (let index = 0; index < activePath.length; index++) {
      const pathNode = activePath[index]
      const freshNode = currentNodes.find((n) => n.value === pathNode.value)
      if (!freshNode || freshNode.children.length === 0) break
      columnList.push({
        key: freshNode.value,
        depth: index + 1,
        nodes: freshNode.children,
      })
      currentNodes = freshNode.children
    }
    return columnList
  }, [props.treeData, activePath, searchQuery])

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return []
    const query = searchQuery.toLowerCase()
    const results: { node: DeptTreeNode; breadcrumb: string }[] = []
    const visit = (nodes: DeptTreeNode[], breadcrumb: string) => {
      for (const node of nodes) {
        const path = breadcrumb ? `${breadcrumb} / ${node.label}` : node.label
        if (node.label.toLowerCase().includes(query)) {
          results.push({ node, breadcrumb: path })
        }
        visit(node.children, path)
      }
    }
    visit(props.treeData, '')
    return results
  }, [props.treeData, searchQuery])

  const triggerLabel =
    selectedLabels.length === 0
      ? (props.placeholder ?? t('Select departments'))
      : t('{{count}} departments selected', { count: selectedLabels.length })

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant='outline'
            role='combobox'
            aria-expanded={open}
            disabled={props.disabled || props.isLoading}
            className='h-auto min-h-8 w-full justify-between gap-2 px-3 font-normal'
          />
        }
      >
        <div className='flex min-w-0 flex-1 flex-wrap items-center gap-1'>
          {props.isLoading ? (
            <Loader2 className='text-muted-foreground size-4 animate-spin' />
          ) : (
            <Building2 className='text-muted-foreground size-4 shrink-0' />
          )}
          {selectedLabels.length === 0 ? (
            <span className='text-muted-foreground truncate'>
              {triggerLabel}
            </span>
          ) : (
            <>
              {selectedLabels.slice(0, 3).map((item) => (
                <Badge
                  key={item.value}
                  variant='secondary'
                  className='flex max-w-[140px] items-center gap-1 truncate py-0 text-xs'
                >
                  <span className='truncate'>{item.label}</span>
                  <button
                    type='button'
                    aria-label={t('Remove {{name}}', { name: item.label })}
                    onClick={(e) => handleRemoveTag(item.value, e)}
                    className='hover:text-foreground text-muted-foreground ml-0.5 shrink-0'
                  >
                    <X className='size-3' />
                  </button>
                </Badge>
              ))}
              {selectedLabels.length > 3 && (
                <Badge variant='secondary' className='py-0 text-xs'>
                  +{selectedLabels.length - 3}
                </Badge>
              )}
            </>
          )}
        </div>
        <ChevronRight className='text-muted-foreground size-3.5 shrink-0' />
      </PopoverTrigger>
      <PopoverContent
        side='bottom'
        align='start'
        sideOffset={4}
        className='w-auto max-w-[90vw] overflow-hidden p-0'
      >
        <div className='border-b px-2.5 py-2'>
          <div className='bg-muted/50 flex items-center gap-2 rounded-md px-2'>
            <Search className='text-muted-foreground size-3.5 shrink-0' />
            <input
              ref={searchInputRef}
              type='text'
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('Search departments...')}
              className='placeholder:text-muted-foreground h-8 w-full min-w-[180px] bg-transparent text-sm outline-none'
            />
            {searchQuery && (
              <button
                type='button'
                tabIndex={-1}
                className='text-muted-foreground hover:text-foreground shrink-0'
                onClick={() => setSearchQuery('')}
              >
                <X className='size-3.5' />
              </button>
            )}
          </div>
        </div>

        {selectedLabels.length > 0 && (
          <div className='flex flex-wrap gap-1 border-b px-3 py-2'>
            {selectedLabels.map((item) => (
              <Badge
                key={item.value}
                variant='secondary'
                className='flex max-w-[180px] items-center gap-1 truncate py-0 text-xs'
              >
                <span className='truncate'>{item.label}</span>
                <button
                  type='button'
                  aria-label={t('Remove {{name}}', { name: item.label })}
                  onClick={(e) => handleRemoveTag(item.value, e)}
                  className='hover:text-foreground text-muted-foreground ml-0.5 shrink-0'
                >
                  <X className='size-3' />
                </button>
              </Badge>
            ))}
            <button
              type='button'
              className='text-muted-foreground hover:text-foreground text-xs'
              onClick={() => props.onValueChange([])}
            >
              {t('Clear all')}
            </button>
          </div>
        )}

        {searchQuery.trim() ? (
          <MultiSelectSearchResults
            results={searchResults}
            selectedSet={selectedSet}
            onToggle={handleToggle}
            emptyText={t('No departments found')}
          />
        ) : (
          <div className='flex'>
            {columns.map((column) => (
              <MultiSelectColumn
                key={column.key}
                nodes={column.nodes}
                depth={column.depth}
                activeNode={activePath[column.depth]}
                selectedSet={selectedSet}
                onHover={handleHover}
                onToggle={handleToggle}
              />
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

// ── Column ────────────────────────────────────────────────────────

interface MultiSelectColumnProps {
  nodes: DeptTreeNode[]
  depth: number
  activeNode?: DeptTreeNode
  selectedSet: Set<string>
  onHover: (node: DeptTreeNode, depth: number) => void
  onToggle: (node: DeptTreeNode) => void
}

function MultiSelectColumn(props: MultiSelectColumnProps) {
  const { t } = useTranslation()
  return (
    <div
      className={cn(
        'flex min-w-[160px] max-w-[220px] flex-col overflow-y-auto py-1',
        props.depth > 0 && 'border-l'
      )}
      style={{ maxHeight: 'min(400px, 60vh)' }}
    >
      {props.nodes.map((node) => {
        const isActive = props.activeNode?.value === node.value
        const isSelected = props.selectedSet.has(node.value)
        const hasChildren = node.children.length > 0
        const isUnavailable = isDepartmentNodeDisabled(node)
        const isSelectable = !isUnavailable

        return (
          <TextTooltip key={node.value} content={node.error}>
            <div
              role='option'
              aria-selected={isSelected}
              aria-disabled={!isSelectable}
              tabIndex={node.error ? 0 : undefined}
              className={cn(
                'mx-1 flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
                isUnavailable
                  ? 'text-muted-foreground cursor-not-allowed opacity-50'
                  : 'hover:bg-accent',
                isActive && !isUnavailable && 'bg-accent'
              )}
              onMouseEnter={() => {
                if (!isUnavailable) props.onHover(node, props.depth)
              }}
              onClick={() => {
                if (isSelectable) props.onToggle(node)
              }}
            >
              <div
                className={cn(
                  'border-primary flex size-4 shrink-0 items-center justify-center rounded-sm border',
                  isSelected && 'bg-primary text-primary-foreground',
                  !isSelectable && 'opacity-50'
                )}
                aria-hidden
              >
                {isSelected && <Check className='size-3' />}
              </div>
              <span className='min-w-0 flex-1 truncate'>{node.label}</span>
              {node.error && (
                <AlertCircle className='text-destructive size-3.5 shrink-0' />
              )}
              {hasChildren && (
                <ChevronRight className='text-muted-foreground size-3.5 shrink-0' />
              )}
            </div>
          </TextTooltip>
        )
      })}
      {props.nodes.length === 0 && (
        <p className='text-muted-foreground px-3 py-2 text-sm'>
          {t('No departments')}
        </p>
      )}
    </div>
  )
}

// ── Search results ────────────────────────────────────────────────

interface MultiSelectSearchResultsProps {
  results: { node: DeptTreeNode; breadcrumb: string }[]
  selectedSet: Set<string>
  onToggle: (node: DeptTreeNode) => void
  emptyText: string
}

function MultiSelectSearchResults(props: MultiSelectSearchResultsProps) {
  return (
    <div
      className='overflow-y-auto py-1'
      style={{ maxHeight: 'min(400px, 60vh)', minWidth: 260 }}
    >
      {props.results.length === 0 ? (
        <div className='text-muted-foreground py-8 text-center text-sm'>
          {props.emptyText}
        </div>
      ) : (
        props.results.map((item) => {
          const isSelected = props.selectedSet.has(item.node.value)
          const isSelectable = !isDepartmentNodeDisabled(item.node)
          return (
            <div
              key={item.node.value}
              role='option'
              aria-selected={isSelected}
              aria-disabled={!isSelectable}
              className={cn(
                'mx-1 flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                !isSelectable
                  ? 'text-muted-foreground cursor-not-allowed opacity-50'
                  : 'hover:bg-accent'
              )}
              onClick={() => isSelectable && props.onToggle(item.node)}
            >
              <div
                className={cn(
                  'border-primary flex size-4 shrink-0 items-center justify-center rounded-sm border',
                  isSelected
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background'
                )}
                aria-hidden
              >
                {isSelected && <Check className='size-3' />}
              </div>
              <div className='min-w-0 flex-1'>
                <div className='truncate font-medium'>{item.node.label}</div>
                <div className='text-muted-foreground truncate text-xs'>
                  {item.breadcrumb}
                </div>
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
