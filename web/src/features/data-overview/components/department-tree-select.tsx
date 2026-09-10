import {
  AlertCircle,
  ChevronRight,
  Building2,
  Check,
  Search,
  X,
  Loader2,
} from 'lucide-react'
import { useState, useMemo, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

import {
  getDepartmentNodeErrorText,
  isDepartmentNodeDisabled,
} from '../lib/department-selection'
import type { DeptTreeNode } from '../types'

interface DepartmentTreeSelectProps {
  treeData: DeptTreeNode[]
  value?: string
  onValueChange: (deptId: string, node: DeptTreeNode) => void
  placeholder?: string
  disabled?: boolean
  // Lazy loading: called when the user hovers a node whose children have not
  // been fetched yet (node.loading === true). The parent is expected to fetch
  // the subtree and update treeData so the column re-renders automatically.
  onLoadNodeChildren?: (node: DeptTreeNode) => void
  // Set of node values whose children are currently in-flight.
  loadingNodeValues?: Set<string>
}

// Each entry in the columns list is either a normal node list or a placeholder
// shown while a subtree is being loaded for the active path node.
type CascaderColumnData =
  | { kind: 'nodes'; key: string; depth: number; nodes: DeptTreeNode[] }
  | { kind: 'loading'; key: string }

export function DepartmentTreeSelect(props: DepartmentTreeSelectProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [activePath, setActivePath] = useState<DeptTreeNode[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      // Initialize only on opening; lazy tree updates must preserve navigation.
      setActivePath(
        props.value ? findNodePath(props.treeData, props.value) : []
      )
    } else {
      setSearchQuery('')
    }
    setOpen(nextOpen)
  }

  const selectedLabel = useMemo(() => {
    if (!props.value) return null
    const path = findNodePath(props.treeData, props.value)
    if (path.length === 0) return null
    return path.map((n) => n.label).join(' / ')
  }, [props.value, props.treeData])

  const handleHover = useCallback(
    (node: DeptTreeNode, depth: number) => {
      setActivePath((prev) => {
        const next = prev.slice(0, depth)
        next.push(node)
        return next
      })
      // Trigger lazy load the first time the user hovers a company node whose
      // departments haven't been fetched (loading=true) and aren't already
      // in-flight (loadingNodeValues does not contain the node value).
      const needsFetch =
        node.loading && !props.loadingNodeValues?.has(node.value)
      if (needsFetch && canNavigateDepartmentNode(node)) {
        props.onLoadNodeChildren?.(node)
      }
    },
    [props]
  )

  const handleSelect = (node: DeptTreeNode) => {
    if (isDepartmentNodeDisabled(node)) return
    props.onValueChange(node.value, node)
    handleOpenChange(false)
  }

  // Build cascader columns from the current tree data, using fresh node
  // lookups instead of stale activePath references so that the columns update
  // correctly after a lazy subtree finishes loading.
  const columns = useMemo((): CascaderColumnData[] => {
    if (searchQuery.trim()) return []
    const columnList: CascaderColumnData[] = [
      { kind: 'nodes', key: 'root', depth: 0, nodes: props.treeData },
    ]
    let currentLevelNodes = props.treeData
    for (let index = 0; index < activePath.length; index++) {
      const pathNode = activePath[index]
      const freshNode =
        findNodeInList(currentLevelNodes, pathNode.value) ??
        findNodeByValueDeep(props.treeData, pathNode.value)
      if (!freshNode) break

      const isBeingFetched =
        props.loadingNodeValues?.has(freshNode.value) ?? false
      const needsLazyLoad = freshNode.loading && !isBeingFetched

      if (isBeingFetched || needsLazyLoad) {
        columnList.push({ kind: 'loading', key: freshNode.value })
        break
      }
      if (freshNode.children.length > 0) {
        columnList.push({
          kind: 'nodes',
          key: freshNode.value,
          depth: index + 1,
          nodes: freshNode.children,
        })
        currentLevelNodes = freshNode.children
      } else {
        break
      }
    }
    return columnList
  }, [props.treeData, props.loadingNodeValues, activePath, searchQuery])

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return []
    return flatSearch(props.treeData, searchQuery.toLowerCase())
  }, [props.treeData, searchQuery])

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        render={
          <Button
            variant='outline'
            role='combobox'
            aria-expanded={open}
            disabled={props.disabled}
            className='h-8 max-w-[480px] justify-between gap-2 px-3 font-normal'
          />
        }
      >
        <div className='flex items-center gap-2 truncate'>
          <Building2 className='text-muted-foreground size-4 shrink-0' />
          <span className='truncate'>
            {selectedLabel ?? props.placeholder ?? t('Select department')}
          </span>
        </div>
        <ChevronRight className='text-muted-foreground size-3.5 shrink-0' />
      </PopoverTrigger>
      <PopoverContent
        initialFocus={searchInputRef}
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

        {searchQuery.trim() ? (
          <SearchResultList
            results={searchResults}
            selectedValue={props.value}
            onSelect={handleSelect}
            emptyText={t('No departments found')}
          />
        ) : (
          <div className='flex'>
            {columns.map((column) => {
              if (column.kind === 'loading') {
                return <LoadingColumn key={column.key} />
              }
              return (
                <CascaderColumn
                  key={column.key}
                  nodes={column.nodes}
                  depth={column.depth}
                  activeNode={activePath[column.depth]}
                  selectedValue={props.value}
                  loadingNodeValues={props.loadingNodeValues}
                  onHover={handleHover}
                  onSelect={handleSelect}
                />
              )
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

// ── Loading Column ────────────────────────────────────────────────

function LoadingColumn() {
  return (
    <div
      className='flex min-w-[160px] items-center justify-center border-l'
      style={{ height: 'min(240px, 40vh)' }}
    >
      <Loader2 className='text-muted-foreground size-5 animate-spin' />
    </div>
  )
}

// ── Cascader Column ───────────────────────────────────────────────

interface CascaderColumnProps {
  nodes: DeptTreeNode[]
  depth: number
  activeNode?: DeptTreeNode
  selectedValue?: string
  loadingNodeValues?: Set<string>
  onHover: (node: DeptTreeNode, depth: number) => void
  onSelect: (node: DeptTreeNode) => void
}

function CascaderColumn(props: CascaderColumnProps) {
  const { t } = useTranslation()

  return (
    <div
      className={cn(
        'flex min-w-[160px] max-w-[220px] flex-col overflow-y-auto py-1',
        props.depth > 0 && 'border-l'
      )}
      style={{ maxHeight: 'min(480px, 60vh)' }}
    >
      {props.nodes.map((node) => {
        const isActive = props.activeNode?.value === node.value
        const isSelected = props.selectedValue === node.value
        const isChildrenLoading = props.loadingNodeValues?.has(node.value)
        const hasChildren = node.children.length > 0 || node.loading
        const isDisabled = isDepartmentNodeDisabled(node)
        const canNavigate = canNavigateDepartmentNode(node)
        const errorText = getDepartmentNodeErrorText(node, (key, options) =>
          t(key, options)
        )

        return (
          <div
            key={node.value}
            role='option'
            aria-selected={isSelected}
            aria-disabled={isDisabled}
            aria-expanded={canNavigate ? isActive : undefined}
            tabIndex={!isDisabled || canNavigate ? 0 : -1}
            title={errorText}
            className={cn(
              'mx-1 flex items-start gap-1.5 rounded-md px-2 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ring',
              isDisabled && 'text-muted-foreground opacity-50',
              isDisabled && !canNavigate && 'cursor-not-allowed',
              (!isDisabled || canNavigate) && 'cursor-pointer hover:bg-accent',
              isActive && (!isDisabled || canNavigate) && 'bg-accent',
              isSelected && !isDisabled && 'text-primary font-medium'
            )}
            onMouseEnter={() => {
              if (!isDisabled || canNavigate) {
                props.onHover(node, props.depth)
              }
            }}
            onClick={() => {
              if (isDisabled && canNavigate) {
                props.onHover(node, props.depth)
                return
              }
              props.onSelect(node)
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowRight' && canNavigate) {
                event.preventDefault()
                props.onHover(node, props.depth)
              } else if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                event.currentTarget.click()
              }
            }}
          >
            <span className='min-w-0 flex-1'>
              <span className='block truncate'>{node.label}</span>
              {errorText && (
                <span className='mt-0.5 flex items-start gap-1 text-[11px] leading-tight'>
                  <AlertCircle className='mt-px size-3 shrink-0' />
                  <span className='line-clamp-2'>{errorText}</span>
                </span>
              )}
            </span>
            {isSelected && <Check className='text-primary size-3.5 shrink-0' />}
            {!isSelected && isChildrenLoading && (
              <Loader2 className='text-muted-foreground size-3.5 shrink-0 animate-spin' />
            )}
            {!isSelected && !isChildrenLoading && hasChildren && (
              <ChevronRight className='text-muted-foreground size-3.5 shrink-0' />
            )}
          </div>
        )
      })}
    </div>
  )
}

function canNavigateDepartmentNode(node: DeptTreeNode): boolean {
  // Disabled ancestors still provide the path to authorized departments.
  return (
    !node.error &&
    (node.children.length > 0 ||
      (node.node_type === 'company' && Boolean(node.loading)))
  )
}

// ── Search Results ────────────────────────────────────────────────

interface SearchResultListProps {
  results: { node: DeptTreeNode; breadcrumb: string }[]
  selectedValue?: string
  onSelect: (node: DeptTreeNode) => void
  emptyText: string
}

function SearchResultList(props: SearchResultListProps) {
  const { t } = useTranslation()

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
          const isSelected = props.selectedValue === item.node.value
          const isDisabled = isDepartmentNodeDisabled(item.node)
          const errorText = getDepartmentNodeErrorText(
            item.node,
            (key, options) => t(key, options)
          )
          return (
            <div
              key={item.node.value}
              role='option'
              aria-selected={isSelected}
              aria-disabled={isDisabled}
              title={errorText}
              className={cn(
                'mx-1 flex cursor-pointer flex-col gap-0.5 rounded-md px-3 py-2 transition-colors',
                isDisabled
                  ? 'text-muted-foreground cursor-not-allowed opacity-50'
                  : 'hover:bg-accent',
                isSelected && 'bg-accent'
              )}
              onClick={() => props.onSelect(item.node)}
            >
              <div className='flex items-center gap-2'>
                <span
                  className={cn(
                    'truncate text-sm',
                    isSelected && 'text-primary font-medium'
                  )}
                >
                  {item.node.label}
                </span>
                {isSelected && (
                  <Check className='text-primary size-3.5 shrink-0' />
                )}
              </div>
              {item.breadcrumb && (
                <span className='text-muted-foreground truncate text-[11px]'>
                  {item.breadcrumb}
                </span>
              )}
              {errorText && (
                <span className='flex items-start gap-1 text-[11px] leading-tight'>
                  <AlertCircle className='mt-px size-3 shrink-0' />
                  <span>{errorText}</span>
                </span>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────────────

function findNodePath(
  nodes: DeptTreeNode[],
  targetValue: string
): DeptTreeNode[] {
  for (const node of nodes) {
    if (node.value === targetValue) return [node]
    if (node.children.length > 0) {
      const childPath = findNodePath(node.children, targetValue)
      if (childPath.length > 0) return [node, ...childPath]
    }
  }
  return []
}

// Find a node by value within an immediate list (no deep search).
function findNodeInList(
  nodes: DeptTreeNode[],
  value: string
): DeptTreeNode | undefined {
  return nodes.find((node) => node.value === value)
}

// Find a node anywhere in the tree recursively.
function findNodeByValueDeep(
  nodes: DeptTreeNode[],
  value: string
): DeptTreeNode | undefined {
  for (const node of nodes) {
    if (node.value === value) return node
    if (node.children.length > 0) {
      const found = findNodeByValueDeep(node.children, value)
      if (found) return found
    }
  }
  return undefined
}

function flatSearch(
  nodes: DeptTreeNode[],
  query: string,
  ancestors: string[] = []
): { node: DeptTreeNode; breadcrumb: string }[] {
  const results: { node: DeptTreeNode; breadcrumb: string }[] = []
  for (const node of nodes) {
    const currentPath = [...ancestors, node.label]
    if (node.label.toLowerCase().includes(query)) {
      results.push({ node, breadcrumb: ancestors.join(' / ') })
    }
    if (node.children.length > 0) {
      results.push(...flatSearch(node.children, query, currentPath))
    }
  }
  return results
}
