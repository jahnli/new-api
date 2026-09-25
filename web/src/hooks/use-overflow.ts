import { useLayoutEffect, useState } from 'react'

// All truncated labels share one resize observer instead of window listeners.
const resizeCallbacks = new Map<Element, () => void>()
let resizeObserver: ResizeObserver | undefined

function measureObservedOverflow() {
  for (const measure of resizeCallbacks.values()) measure()
}

export function useOverflow(enabled = true) {
  const [element, ref] = useState<HTMLElement | null>(null)
  const [isOverflowing, setIsOverflowing] = useState(false)

  useLayoutEffect(() => {
    if (!enabled || !element) return

    const measure = () => {
      setIsOverflowing(
        element.clientWidth > 0 &&
          (element.scrollWidth > element.clientWidth ||
            element.scrollHeight > element.clientHeight)
      )
    }
    measure()

    if (resizeCallbacks.size === 0) {
      document.fonts?.addEventListener('loadingdone', measureObservedOverflow)
    }
    resizeCallbacks.set(element, measure)
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver ??= new ResizeObserver((entries) => {
        for (const entry of entries) resizeCallbacks.get(entry.target)?.()
      })
      resizeObserver.observe(element)
    }

    // Text can change without changing the container's dimensions.
    const mutationObserver = new MutationObserver(measure)
    mutationObserver.observe(element, {
      childList: true,
      characterData: true,
      subtree: true,
    })

    return () => {
      resizeCallbacks.delete(element)
      resizeObserver?.unobserve(element)
      if (resizeCallbacks.size === 0) {
        resizeObserver?.disconnect()
        resizeObserver = undefined
        document.fonts?.removeEventListener(
          'loadingdone',
          measureObservedOverflow
        )
      }
      mutationObserver.disconnect()
    }
  }, [element, enabled])

  return { ref, isOverflowing: enabled && isOverflowing }
}
