import type { GenerationRecord, ImageGenerationError } from '../types'

/** Give legacy/history failures identities before they enter the retry lifecycle. */
export function getImageFailures(
  record: Pick<
    GenerationRecord,
    'id' | 'imageFailures' | 'imageErrors' | 'failedImageCount'
  >
): ImageGenerationError[] {
  if (record.imageFailures) return record.imageFailures

  const messages =
    record.imageErrors ??
    Array.from({ length: record.failedImageCount ?? 0 }, () => '')
  return messages.map((message, retryIndex) => ({
    id: `${record.id}-failure-${retryIndex}`,
    retryIndex,
    message,
  }))
}
