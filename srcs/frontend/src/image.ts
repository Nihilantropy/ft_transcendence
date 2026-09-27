import { ApiError } from './api'

// Long side 1600 px at JPEG 0.85 stays far below nginx's 8 MB vision body limit
// even after base64 (~1.33x).
export const MAX_SIDE = 1600
// Pet profile thumbnail: ~20-40 KB as a data URL, under user-service's 200 KB cap.
export const PHOTO_SIDE = 256

export function fitWithin(w: number, h: number, max = MAX_SIDE): [number, number] {
  const scale = Math.min(1, max / Math.max(w, h))
  return [Math.round(w * scale), Math.round(h * scale)]
}

export async function toJpegDataUrl(file: Blob, max = MAX_SIDE): Promise<string> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new ApiError('INVALID_IMAGE_FORMAT', 'Browser could not decode the file', 0)
  }
  const [w, h] = fitWithin(bitmap.width, bitmap.height, max)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#fff' // JPEG has no alpha: transparent PNGs would turn black
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()
  return canvas.toDataURL('image/jpeg', 0.85)
}
