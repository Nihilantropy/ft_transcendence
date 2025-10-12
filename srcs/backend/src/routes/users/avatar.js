/**
 * @file Avatar upload route - /users/me/avatar
 * @description Route for uploading and processing avatar images (multipart/form-data)
 */

import sharp from 'sharp'
import { fileTypeFromBuffer } from 'file-type'
import { logger } from '../../logger.js'
import { requireAuth } from '../../middleware/authentication.js'
import { userService } from '../../services/user.service.js'
import { formatOwnProfile } from '../../utils/user-formatters.js'

const uploadAvatarLogger = logger.child({ module: 'routes/users/upload-avatar' })

/**
 * @brief Process uploaded image (validate, resize, optimize, convert to base64)
 * @param {Buffer} buffer - Image buffer from multer
 * @return {Promise<string>} Base64 encoded image data with data URI prefix
 */
async function processAvatarImage(buffer) {
  try {
    // 1. Validate actual file type (prevents fake extensions)
    const fileType = await fileTypeFromBuffer(buffer)
    
    if (!fileType) {
      throw new Error('Could not determine file type')
    }
    
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!allowedTypes.includes(fileType.mime)) {
      throw new Error(`Invalid file type: ${fileType.mime}. Allowed: JPEG, PNG, GIF, WebP`)
    }
    
    uploadAvatarLogger.debug('File type validated', { 
      mime: fileType.mime, 
      ext: fileType.ext 
    })
    
    // 2. Process image with sharp (resize, optimize, convert to JPEG)
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
    
    uploadAvatarLogger.debug('Image processed', {
      originalSize: buffer.length,
      processedSize: processedBuffer.length,
      reduction: `${Math.round((1 - processedBuffer.length / buffer.length) * 100)}%`
    })
    
    // 3. Convert to base64 with data URI prefix
    const base64 = processedBuffer.toString('base64')
    const avatarBase64 = `data:image/jpeg;base64,${base64}`
    
    // Check final size (should be < 1MB after processing)
    const finalSizeKB = Math.round(avatarBase64.length / 1024)
    if (finalSizeKB > 1024) {
      throw new Error(`Processed image too large: ${finalSizeKB}KB (max 1024KB)`)
    }
    
    uploadAvatarLogger.debug('Base64 encoding complete', { 
      sizeKB: finalSizeKB 
    })
    
    return avatarBase64
    
  } catch (error) {
    uploadAvatarLogger.error('Image processing failed', { 
      error: error.message 
    })
    throw error
  }
}

/**
 * @brief Register /users/me/avatar route
 * @param {FastifyInstance} fastify - Fastify instance
 */
async function uploadAvatarRoute(fastify) {

  /**
   * @route POST /users/me/avatar
   * @description Upload and process avatar image (multipart/form-data)
   * @authentication Required (JWT cookie)
   * @body avatar - Image file (multipart, max 5MB, JPEG/PNG/GIF/WebP)
   */
  fastify.post('/me/avatar', {
    preHandler: requireAuth
  }, async (request, reply) => {
    try {
      const userId = request.user.id
      
      // Get the uploaded file using Fastify's multipart
      const data = await request.file()
      
      if (!data) {
        uploadAvatarLogger.warn('No file uploaded', { userId })
        return reply.code(400).send({
          success: false,
          message: 'No file uploaded',
          error: { code: 'NO_FILE', details: 'Avatar file is required' }
        })
      }
      
      // Validate file type
      if (!data.mimetype.startsWith('image/')) {
        uploadAvatarLogger.warn('Invalid file type', { 
          userId, 
          mimetype: data.mimetype 
        })
        return reply.code(400).send({
          success: false,
          message: 'Only image files are allowed',
          error: { code: 'INVALID_FILE_TYPE', details: `Received: ${data.mimetype}` }
        })
      }
      
      uploadAvatarLogger.info('Avatar upload started', {
        userId,
        filename: data.filename,
        mimetype: data.mimetype
      })
      
      // Read file buffer
      const buffer = await data.toBuffer()
      
      // Check file size (5MB max)
      if (buffer.length > 5 * 1024 * 1024) {
        uploadAvatarLogger.warn('File too large', { 
          userId, 
          size: buffer.length 
        })
        return reply.code(400).send({
          success: false,
          message: 'File too large (max 5MB)',
          error: { code: 'FILE_TOO_LARGE', details: `Size: ${buffer.length} bytes` }
        })
      }
      
      // Process image (validate, resize, optimize, convert to base64)
      const avatarBase64 = await processAvatarImage(buffer)
      
      // Update user avatar in database
      const updatedUser = userService.updateAvatar(userId, avatarBase64)
      
      // Format response
      const formattedUser = formatOwnProfile(updatedUser)
      
      uploadAvatarLogger.info('✅ Avatar uploaded successfully', { 
        userId,
        avatarSizeKB: Math.round(avatarBase64.length / 1024)
      })
      
      return reply.code(200).send({
        success: true,
        message: 'Avatar uploaded successfully',
        user: formattedUser
      })
      
    } catch (error) {
      uploadAvatarLogger.error('❌ Avatar upload failed', {
        userId: request.user?.id,
        error: error.message
      })
      
      // Handle specific error cases
      if (error.message.includes('file type')) {
        return reply.code(400).send({
          success: false,
          message: 'Invalid file type',
          error: {
            code: 'INVALID_FILE_TYPE',
            details: error.message
          }
        })
      }
      
      if (error.message.includes('too large')) {
        return reply.code(400).send({
          success: false,
          message: 'Image too large after processing',
          error: {
            code: 'IMAGE_TOO_LARGE',
            details: error.message
          }
        })
      }
      
      if (error.message.includes('not found')) {
        return reply.code(404).send({
          success: false,
          message: 'User not found',
          error: {
            code: 'USER_NOT_FOUND',
            details: error.message
          }
        })
      }
      
      // Generic error
      return reply.code(500).send({
        success: false,
        message: 'Failed to upload avatar',
        error: {
          code: 'UPLOAD_FAILED',
          details: error.message
        }
      })
    }
  })
}

export default uploadAvatarRoute
