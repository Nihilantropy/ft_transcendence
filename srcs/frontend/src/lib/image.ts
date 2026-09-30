export type ImageValidationError = 'imageType' | 'imageTooLarge' | 'imageTooSmall'

export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_BYTES = 5 * 1024 * 1024
const MIN_EDGE = 224

export type ValidatedImage =
  | { ok: true; dataUri: string }
  | { ok: false; error: ImageValidationError }

// validates MIME type, byte size and pixel dimensions, then returns the image as a data URI
export async function validatePetImage(file: File): Promise<ValidatedImage> {
  if (!ACCEPTED_TYPES.includes(file.type)) return { ok: false, error: 'imageType' }
  if (file.size > MAX_BYTES) return { ok: false, error: 'imageTooLarge' }

  try {
    const bitmap = await createImageBitmap(file)
    const { width, height } = bitmap
    bitmap.close()
    if (width < MIN_EDGE || height < MIN_EDGE) return { ok: false, error: 'imageTooSmall' }
  } catch {
    // undecodable / corrupt file
    return { ok: false, error: 'imageType' }
  }

  const dataUri = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      resolve(reader.result as string)
    }
    reader.onerror = () => {
      reject(new Error('file read failed'))
    }
    reader.readAsDataURL(file)
  })

  return { ok: true, dataUri }
}

const PHOTO_EDGE = 256
const PHOTO_MAX_CHARS = 200_000
const PHOTO_QUALITIES = [0.85, 0.7, 0.5]

export async function toPetPhoto(source: Blob): Promise<string> {
  const bitmap = await createImageBitmap(source)
  const side = Math.min(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = PHOTO_EDGE
  canvas.height = PHOTO_EDGE
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close()
    throw new Error('canvas 2d context unavailable')
  }
  ctx.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    PHOTO_EDGE,
    PHOTO_EDGE,
  )
  bitmap.close()
  for (const quality of PHOTO_QUALITIES) {
    const dataUri = canvas.toDataURL('image/jpeg', quality)
    if (dataUri.length <= PHOTO_MAX_CHARS) return dataUri
  }
  throw new Error('photo too large')
}
