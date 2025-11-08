/**
 * @file Image Processing Utility
 * @description Process avatar images (validate, resize, optimize, convert to base64)
 */

import sharp from 'sharp'
import { fileTypeFromBuffer } from 'file-type'
import { logger } from '../logger.js'

const imageLogger = logger.child({ module: 'utils/imageProcessing' })

/**
 * Process uploaded avatar image
 * @param {Buffer} buffer - Image buffer
 * @returns {Promise<string>} Base64 encoded image with data URI prefix
 */
export async function processAvatarImage(buffer) {
  try {
    // 1. Validate file type
    const fileType = await fileTypeFromBuffer(buffer)

    if (!fileType) {
      throw new Error('Could not determine file type')
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!allowedTypes.includes(fileType.mime)) {
      throw new Error(`Invalid file type: ${fileType.mime}. Allowed: JPEG, PNG, GIF, WebP`)
    }

    imageLogger.debug('File type validated', { mime: fileType.mime, ext: fileType.ext })

    // 2. Process image with sharp
    const processedBuffer = await sharp(buffer)
      .resize(256, 256, {
        fit: 'cover',
        position: 'center'
      })
      .jpeg({
        quality: 85,
        progressive: true,
        mozjpeg: true
      })
      .toBuffer()

    imageLogger.debug('Image processed', {
      originalSize: buffer.length,
      processedSize: processedBuffer.length,
      reduction: `${Math.round((1 - processedBuffer.length / buffer.length) * 100)}%`
    })

    // 3. Convert to base64
    const base64 = processedBuffer.toString('base64')
    const avatarBase64 = `data:image/jpeg;base64,${base64}`

    // Check final size (should be < 1MB after processing)
    const finalSizeKB = Math.round(avatarBase64.length / 1024)
    if (finalSizeKB > 1024) {
      throw new Error(`Processed image too large: ${finalSizeKB}KB (max 1024KB)`)
    }

    imageLogger.debug('Base64 encoding complete', { sizeKB: finalSizeKB })

    return avatarBase64
  } catch (error) {
    imageLogger.error('Image processing failed', { error: error.message })
    throw error
  }
}

export default { processAvatarImage }
