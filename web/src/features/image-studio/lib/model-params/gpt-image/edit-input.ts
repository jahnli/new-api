import { t } from 'i18next'

import type { ReferenceImage } from '../../../types'

export const GPT_IMAGE_INPUT_ACCEPT = 'image/png,image/jpeg,image/webp'
export const GPT_IMAGE_MAX_INPUT_BYTES = 50 * 1024 * 1024

export function supportsGptImageMarkup(model: string): boolean {
  return /^gpt-image-2\.[56]-(?:sunburst|flare)(?:-2026-09-08)?$/.test(model)
}

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

export async function validateGptImageEditLayer(
  layer: ReferenceImage,
  reference: ReferenceImage,
  kind: 'mask' | 'markup'
): Promise<void> {
  if (!layer.dataUrl.startsWith('data:image/png;base64,')) {
    throw new Error(
      t(
        'The edit layer must be a PNG with transparency and match the first reference image dimensions.'
      )
    )
  }
  validateGptImageReference(layer)
  const [layerBlob, referenceBlob] = await Promise.all([
    fetch(layer.dataUrl).then((response) => response.blob()),
    fetch(reference.dataUrl).then((response) => response.blob()),
  ])
  if (kind === 'mask' && referenceBlob.type !== 'image/png') {
    throw new Error(
      t('Use a PNG first reference image when editing with a mask.')
    )
  }
  const layerBitmap = await createImageBitmap(layerBlob)
  try {
    const referenceBitmap = await createImageBitmap(referenceBlob)
    try {
      if (
        layerBitmap.width !== referenceBitmap.width ||
        layerBitmap.height !== referenceBitmap.height
      ) {
        throw new Error(
          t(
            'The edit layer must be a PNG with transparency and match the first reference image dimensions.'
          )
        )
      }
      if (
        kind === 'markup' &&
        layerBitmap.width * layerBitmap.height > 16_777_216
      ) {
        throw new Error(
          t(
            'Markup and the first reference image must not exceed 16,777,216 pixels.'
          )
        )
      }
      const bytes = new Uint8Array(await layerBlob.arrayBuffer())
      const view = new DataView(bytes.buffer)
      let hasAlpha = bytes[25] === 4 || bytes[25] === 6
      for (let offset = 8; !hasAlpha && offset + 12 <= bytes.length;) {
        const length = view.getUint32(offset)
        hasAlpha =
          String.fromCharCode(...bytes.subarray(offset + 4, offset + 8)) ===
          'tRNS'
        offset += length + 12
      }
      if (!hasAlpha) {
        throw new Error(
          t(
            'The edit layer must be a PNG with transparency and match the first reference image dimensions.'
          )
        )
      }
      if (kind === 'markup') {
        const canvas = document.createElement('canvas')
        canvas.width = layerBitmap.width
        canvas.height = layerBitmap.height
        const context = canvas.getContext('2d')
        if (!context) {
          throw new Error(t('Unable to load this image for editing'))
        }
        context.drawImage(layerBitmap, 0, 0)
        const pixels = context.getImageData(
          0,
          0,
          canvas.width,
          canvas.height
        ).data
        let transparent = false
        for (let offset = 3; offset < pixels.length; offset += 4) {
          if (pixels[offset] < 255) {
            transparent = true
            break
          }
        }
        if (!transparent) {
          throw new Error(
            t(
              'The edit layer must be a PNG with transparency and match the first reference image dimensions.'
            )
          )
        }
      }
    } finally {
      referenceBitmap.close()
    }
  } finally {
    layerBitmap.close()
  }
}
