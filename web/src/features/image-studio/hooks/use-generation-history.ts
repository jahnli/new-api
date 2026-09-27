import { useCallback, useEffect, useState } from 'react'

import { DEFAULT_HISTORY_DISPLAY_LIMIT } from '../constants'
import {
  clearGenerations,
  deleteGeneration,
  listGenerations,
  saveGeneration,
  updateGeneration,
} from '../lib/storage'
import type { GenerationRecord } from '../types'

export function useGenerationHistory() {
  const [history, setHistory] = useState<GenerationRecord[]>([])
  const [displayLimit, setDisplayLimit] = useState(
    DEFAULT_HISTORY_DISPLAY_LIMIT
  )
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)

  useEffect(() => {
    let cancelled = false
    listGenerations()
      .then((result) => {
        if (!cancelled) {
          setDisplayLimit(result.displayLimit)
          setHistory(result.records.slice(0, result.displayLimit))
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingHistory(false)
      })
      .catch(() => {
        /* unreadable history starts empty */
      })
    return () => {
      cancelled = true
    }
  }, [])

  const addRecord = useCallback(
    (record: GenerationRecord) => {
      setHistory((prev) =>
        [record, ...prev.filter((item) => !item.transient)].slice(
          0,
          displayLimit + (record.transient ? 1 : 0)
        )
      )
      void saveGeneration(record)
    },
    [displayLimit]
  )

  const patchRecordLocally = useCallback(
    (id: string, patch: Partial<GenerationRecord>) => {
      setHistory((previousHistory) =>
        previousHistory.map((record) =>
          record.id === id ? { ...record, ...patch } : record
        )
      )
    },
    []
  )

  const patchRecord = useCallback(
    (id: string, patch: Partial<GenerationRecord>) => {
      setHistory((previousHistory) => {
        const nextHistory = previousHistory.map((record) =>
          record.id === id ? { ...record, ...patch } : record
        )
        const updatedRecord = nextHistory.find((record) => record.id === id)
        if (
          updatedRecord &&
          !updatedRecord.transient &&
          updatedRecord.images.some((image) => image.storageId)
        ) {
          void updateGeneration(updatedRecord)
        }
        return nextHistory
      })
    },
    []
  )

  const removeRecord = useCallback((id: string) => {
    setHistory((prev) => prev.filter((record) => record.id !== id))
    void deleteGeneration(id)
  }, [])

  const clearHistory = useCallback(() => {
    setHistory([])
    void clearGenerations()
  }, [])

  const toggleFavorite = useCallback(
    (id: string) => {
      const record = history.find((r) => r.id === id)
      if (record && !record.transient) {
        patchRecord(id, { favorite: !record.favorite })
      }
    },
    [history, patchRecord]
  )

  return {
    history,
    isLoadingHistory,
    addRecord,
    patchRecordLocally,
    patchRecord,
    removeRecord,
    clearHistory,
    toggleFavorite,
  }
}
