# Avatar Upload - Recommended NPM Packages

## Architecture Change Summary
- **Old**: `avatar_url` (TEXT) - stored external URLs
- **New**: `avatar_base64` (TEXT) - stores base64 encoded image data directly in database

## Recommended NPM Packages

### 1. **multer** (Backend - File Upload Handling)
**Package**: `multer`  
**Version**: `^1.4.5-lts.1`  
**Purpose**: Middleware for handling `multipart/form-data` (file uploads)

#### Installation
```bash
npm install multer
```

#### Usage
```javascript
import multer from 'multer'

// Configure multer to store in memory (for base64 conversion)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
  },
  fileFilter: (req, file, cb) => {
    // Accept only images
    if (file.mimetype.startsWith('image/')) {
      cb(null, true)
    } else {
      cb(new Error('Only image files are allowed'), false)
    }
  }
})

// Use in route
app.post('/upload/avatar', upload.single('avatar'), (req, res) => {
  const buffer = req.file.buffer
  const base64 = buffer.toString('base64')
  const mimeType = req.file.mimetype
  const avatarBase64 = `data:${mimeType};base64,${base64}`
  
  // Save avatarBase64 to database
  res.json({ avatar: avatarBase64 })
})
```

---

### 2. **sharp** (Backend - Image Processing)
**Package**: `sharp`  
**Version**: `^0.33.5`  
**Purpose**: High-performance image resizing, format conversion, optimization

#### Installation
```bash
npm install sharp
```

#### Usage
```javascript
import sharp from 'sharp'

async function processAvatar(buffer) {
  // Resize, optimize, and convert to JPEG
  const processedBuffer = await sharp(buffer)
    .resize(256, 256, {
      fit: 'cover',
      position: 'center'
    })
    .jpeg({ quality: 85 })
    .toBuffer()
  
  return processedBuffer.toString('base64')
}

// In route
app.post('/upload/avatar', upload.single('avatar'), async (req, res) => {
  try {
    const base64 = await processAvatar(req.file.buffer)
    const avatarBase64 = `data:image/jpeg;base64,${base64}`
    
    // Save to database
    res.json({ avatar: avatarBase64 })
  } catch (error) {
    res.status(400).json({ error: 'Image processing failed' })
  }
})
```

**Features**:
- Automatic format detection
- Resize/crop images
- Optimize file size (reduce quality, compress)
- Convert between formats (PNG → JPEG, etc.)
- Extract metadata

---

### 3. **file-type** (Backend - MIME Type Validation)
**Package**: `file-type`  
**Version**: `^19.7.0`  
**Purpose**: Detect actual file type from buffer (prevents fake extensions)

#### Installation
```bash
npm install file-type
```

#### Usage
```javascript
import { fileTypeFromBuffer } from 'file-type'

async function validateImageType(buffer) {
  const type = await fileTypeFromBuffer(buffer)
  
  if (!type) {
    throw new Error('Unknown file type')
  }
  
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
  if (!allowedTypes.includes(type.mime)) {
    throw new Error(`Invalid file type: ${type.mime}`)
  }
  
  return type
}

// In route
app.post('/upload/avatar', upload.single('avatar'), async (req, res) => {
  try {
    await validateImageType(req.file.buffer)
    // Continue processing...
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})
```

---

### 4. **clamav.js** (Backend - Virus Scanning)
**Package**: `clamav.js`  
**Version**: `^0.14.0`  
**Purpose**: Scan files for viruses using ClamAV

#### Installation
```bash
npm install clamav.js
```

#### Prerequisites
```bash
# Install ClamAV daemon
sudo apt-get install clamav clamav-daemon
sudo systemctl start clamav-daemon
```

#### Usage
```javascript
import NodeClam from 'clamav.js'

const clam = new NodeClam().init({
  clamdscan: {
    socket: '/var/run/clamav/clamd.ctl', // Linux
    path: '/usr/bin/clamdscan',
  }
})

async function scanForVirus(buffer) {
  const { isInfected, viruses } = await clam.scanBuffer(buffer)
  
  if (isInfected) {
    throw new Error(`Virus detected: ${viruses.join(', ')}`)
  }
}

// In route
app.post('/upload/avatar', upload.single('avatar'), async (req, res) => {
  try {
    await scanForVirus(req.file.buffer)
    // Continue processing...
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})
```

**Alternative**: `clamdjs` or use external virus scanning API (VirusTotal, MetaDefender)

---

### 5. **FilePond** (Frontend - User-Friendly Upload UI)
**Package**: `filepond` + `filepond-plugin-*`  
**Version**: `^4.32.9`  
**Purpose**: Beautiful drag-and-drop file upload component

#### Installation
```bash
npm install filepond filepond-plugin-image-preview filepond-plugin-image-validate-size filepond-plugin-file-validate-type
```

#### Usage (Vanilla JS)
```javascript
import * as FilePond from 'filepond'
import FilePondPluginImagePreview from 'filepond-plugin-image-preview'
import FilePondPluginImageValidateSize from 'filepond-plugin-image-validate-size'
import FilePondPluginFileValidateType from 'filepond-plugin-file-validate-type'

// Register plugins
FilePond.registerPlugin(
  FilePondPluginImagePreview,
  FilePondPluginImageValidateSize,
  FilePondPluginFileValidateType
)

// Create FilePond instance
const pond = FilePond.create(document.querySelector('input[type="file"]'), {
  acceptedFileTypes: ['image/jpeg', 'image/png', 'image/gif'],
  maxFileSize: '5MB',
  imagePreviewMaxHeight: 256,
  server: {
    process: {
      url: '/upload/avatar',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      onload: (response) => {
        const data = JSON.parse(response)
        console.log('Avatar uploaded:', data.avatar)
        return data.avatar
      }
    }
  }
})
```

**Features**:
- Drag & drop support
- Image preview before upload
- Progress indicator
- Client-side validation
- Beautiful UI out-of-the-box

---

### 6. **pica** (Frontend - Client-Side Image Resizing)
**Package**: `pica`  
**Version**: `^9.0.1`  
**Purpose**: Resize images in browser before upload (reduce bandwidth)

#### Installation
```bash
npm install pica
```

#### Usage
```javascript
import pica from 'pica'

async function resizeImageBeforeUpload(file) {
  const img = new Image()
  const reader = new FileReader()
  
  return new Promise((resolve, reject) => {
    reader.onload = async (e) => {
      img.src = e.target.result
      
      img.onload = async () => {
        // Create canvas for resized image
        const canvas = document.createElement('canvas')
        canvas.width = 256
        canvas.height = 256
        
        // Resize using pica (high quality)
        const picaInstance = pica()
        await picaInstance.resize(img, canvas)
        
        // Convert to blob
        canvas.toBlob((blob) => {
          resolve(blob)
        }, 'image/jpeg', 0.85)
      }
    }
    
    reader.readAsDataURL(file)
  })
}

// In upload handler
async function uploadAvatar(file) {
  const resizedBlob = await resizeImageBeforeUpload(file)
  
  // Convert to base64
  const reader = new FileReader()
  reader.readAsDataURL(resizedBlob)
  reader.onload = () => {
    const base64 = reader.result
    // Send to backend
    fetch('/upload/avatar', {
      method: 'POST',
      body: JSON.stringify({ avatar: base64 }),
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
```

---

## Complete Implementation Example

### Backend Route (`/routes/upload.js`)
```javascript
import multer from 'multer'
import sharp from 'sharp'
import { fileTypeFromBuffer } from 'file-type'
import NodeClam from 'clamav.js'

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
})

const clam = new NodeClam().init()

export async function uploadAvatarRoute(fastify) {
  fastify.post('/upload/avatar', {
    preHandler: [fastify.authenticate], // Require auth
    handler: async (request, reply) => {
      try {
        // 1. Get uploaded file (handled by multer)
        const file = request.file
        
        if (!file) {
          return reply.code(400).send({ error: 'No file uploaded' })
        }
        
        // 2. Validate file type
        const fileType = await fileTypeFromBuffer(file.buffer)
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
        
        if (!fileType || !allowedTypes.includes(fileType.mime)) {
          return reply.code(400).send({ error: 'Invalid file type' })
        }
        
        // 3. Scan for viruses (optional but recommended)
        const { isInfected } = await clam.scanBuffer(file.buffer)
        if (isInfected) {
          return reply.code(400).send({ error: 'File contains malware' })
        }
        
        // 4. Process image (resize, optimize)
        const processedBuffer = await sharp(file.buffer)
          .resize(256, 256, { fit: 'cover', position: 'center' })
          .jpeg({ quality: 85 })
          .toBuffer()
        
        // 5. Convert to base64
        const base64 = processedBuffer.toString('base64')
        const avatarBase64 = `data:image/jpeg;base64,${base64}`
        
        // 6. Update database
        const userId = request.user.id
        await userService.updateAvatar(userId, avatarBase64)
        
        // 7. Return success
        return reply.send({ 
          success: true,
          avatar: avatarBase64,
          message: 'Avatar updated successfully'
        })
        
      } catch (error) {
        fastify.log.error('Avatar upload failed:', error)
        return reply.code(500).send({ error: 'Avatar upload failed' })
      }
    }
  })
}
```

### Frontend Upload (`UserService.ts`)
```typescript
async uploadAvatar(file: File): Promise<string> {
  // 1. Validate file size client-side
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('File too large (max 5MB)')
  }
  
  // 2. Validate file type
  if (!file.type.startsWith('image/')) {
    throw new Error('File must be an image')
  }
  
  // 3. Optional: Resize on client side (saves bandwidth)
  const resizedBlob = await this.resizeImage(file)
  
  // 4. Convert to base64
  const base64 = await this.fileToBase64(resizedBlob)
  
  // 5. Send to backend
  const response = await this.api.post('/upload/avatar', { avatar: base64 })
  
  return response.avatar
}

private fileToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
```

---

## Recommended Package Combination

### Minimal Setup (Quick Implementation)
- **Backend**: `multer` + base64 conversion
- **Frontend**: HTML `<input type="file">` + FileReader API

### Production Setup (Recommended)
- **Backend**: `multer` + `sharp` + `file-type`
- **Frontend**: `filepond` + `pica`
- **Security**: `clamav.js` (if handling user uploads at scale)

### Enterprise Setup (Maximum Security)
- **Backend**: `multer` + `sharp` + `file-type` + `clamav.js`
- **Frontend**: `filepond` + `pica`
- **Additional**: Rate limiting, CDN delivery, separate avatar service

---

## Database Size Considerations

### Base64 Storage Size
- Original image: 2MB
- Base64 encoded: ~2.7MB (33% overhead)
- After JPEG compression (quality 85): ~150KB → ~200KB base64

### SQLite Limitations
- SQLite TEXT field: No practical limit (up to 1GB per field)
- Recommended max: 5MB raw image → ~500KB after processing → ~670KB base64

### Optimization Tips
1. **Always resize images** to 256x256 or 512x512
2. **Use JPEG format** (smaller than PNG for photos)
3. **Set quality to 80-85%** (good balance)
4. **Consider WebP format** (better compression, modern browsers)

---

## Migration Script

If you need to migrate existing `avatar_url` data:

```javascript
// migration.js
import fetch from 'node-fetch'
import sharp from 'sharp'

async function migrateAvatarUrls() {
  const users = await db.all('SELECT id, avatar_url FROM users WHERE avatar_url IS NOT NULL')
  
  for (const user of users) {
    try {
      // Download image from URL
      const response = await fetch(user.avatar_url)
      const buffer = await response.buffer()
      
      // Process and convert to base64
      const processedBuffer = await sharp(buffer)
        .resize(256, 256)
        .jpeg({ quality: 85 })
        .toBuffer()
      
      const base64 = processedBuffer.toString('base64')
      const avatarBase64 = `data:image/jpeg;base64,${base64}`
      
      // Update database
      await db.run(
        'UPDATE users SET avatar_base64 = ? WHERE id = ?',
        [avatarBase64, user.id]
      )
      
      console.log(`✅ Migrated avatar for user ${user.id}`)
      
    } catch (error) {
      console.error(`❌ Failed to migrate user ${user.id}:`, error.message)
    }
  }
}
```

---

## Summary

### Best Packages for Your Use Case
1. **multer**: File upload handling ✅
2. **sharp**: Image processing (resize, optimize) ✅
3. **file-type**: MIME type validation ✅
4. **filepond**: Beautiful frontend UI (optional) ✅
5. **clamav.js**: Virus scanning (optional, production) ⚠️

### Implementation Priority
1. ✅ Update database schema (`avatar_url` → `avatar_base64`)
2. ✅ Install `multer` + `sharp` backend packages
3. ✅ Create upload route with validation
4. ✅ Add frontend file upload UI
5. ⚠️ Add virus scanning if handling public uploads
