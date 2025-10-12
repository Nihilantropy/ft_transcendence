/**
 * @file Avatar converter utility
 * @description Utilities for converting avatar URLs to base64 format
 */

import sharp from 'sharp'
import { logger } from '../logger.js'

const avatarLogger = logger.child({ module: 'utils/avatar-converter' })

/**
 * @brief Download and convert avatar URL to base64
 * @param {string} avatarUrl - URL of avatar image
 * @return {Promise<string>} Base64 encoded image with data URI prefix
 * @throws {Error} If download or conversion fails
 * 
 * @description Downloads avatar from URL, processes it (resize, optimize),
 * and converts to base64 format matching the standard used for uploaded avatars.
 */
export async function convertAvatarUrlToBase64(avatarUrl) {
  try {
    avatarLogger.debug('Converting avatar URL to base64', { url: avatarUrl })

    // 1. Download image from URL
    const response = await fetch(avatarUrl, {
      headers: {
        'User-Agent': 'ft_transcendence/1.0'
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to download avatar: ${response.status} ${response.statusText}`)
    }

    // Get image buffer
    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    avatarLogger.debug('Avatar downloaded', { 
      size: buffer.length,
      contentType: response.headers.get('content-type')
    })

    // 2. Process image with sharp (same as upload-avatar.js)
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

    avatarLogger.debug('Avatar processed', {
      originalSize: buffer.length,
      processedSize: processedBuffer.length,
      reduction: `${Math.round((1 - processedBuffer.length / buffer.length) * 100)}%`
    })

    // 3. Convert to base64 with data URI prefix
    const base64 = processedBuffer.toString('base64')
    const avatarBase64 = `data:image/jpeg;base64,${base64}`

    // Check final size
    const finalSizeKB = Math.round(avatarBase64.length / 1024)
    avatarLogger.debug('Base64 conversion complete', { 
      sizeKB: finalSizeKB 
    })

    return avatarBase64

  } catch (error) {
    avatarLogger.error('Avatar URL conversion failed', { 
      url: avatarUrl,
      error: error.message 
    })
    
    // Return null instead of throwing - we don't want to fail user creation
    // just because avatar download failed
    return null
  }
}

/**
 * @brief Check if avatar data is a URL or base64
 * @param {string} avatarData - Avatar data (URL or base64)
 * @return {boolean} True if URL, false if base64 or null
 */
export function isAvatarUrl(avatarData) {
  if (!avatarData) return false
  return avatarData.startsWith('http://') || avatarData.startsWith('https://')
}

/**
 * @brief Ensure avatar is in base64 format
 * @param {string|null} avatarData - Avatar data (URL or base64 or null)
 * @return {Promise<string|null>} Base64 avatar or null
 * 
 * @description Converts URL to base64 if needed, or returns base64 as-is.
 * Useful for migrations or data consistency checks.
 */
export async function ensureAvatarBase64(avatarData) {
  if (!avatarData) return null
  
  if (isAvatarUrl(avatarData)) {
    avatarLogger.info('Converting avatar URL to base64 for consistency')
    return await convertAvatarUrlToBase64(avatarData)
  }
  
  return avatarData
}
