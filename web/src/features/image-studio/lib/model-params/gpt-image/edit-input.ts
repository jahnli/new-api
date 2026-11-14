import { t } from 'i18next'

import type { ReferenceImage } from '../../../types'

export const GPT_IMAGE_INPUT_ACCEPT = 'image/png,image/jpeg,image/webp'
export const GPT_IMAGE_MAX_INPUT_BYTES = 50 * 1024 * 1024

export function validateGptImageReference(image: ReferenceImage): void {
  const match =
    /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=\r\n]+)$/.exec(
      image.dataUrl
    )
  if (
    !match ||
    (match[2].replaceAll(/\s/g, '').length * 3) / 4 >= GPT_IMAGE_MAX_INPUT_BYTES
  ) {
    throw new Error(
      t('Reference images must be PNG, JPEG, or WebP files smaller than 50 MB.')
    )
  }
}
