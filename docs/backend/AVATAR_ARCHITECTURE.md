# Avatar Handling Architecture

## Overview
This document describes how avatars are handled consistently across the application.

## Architecture Decision

**Storage Format**: All avatars are stored as **base64-encoded images** with data URI prefix in the `avatar_base64` field.

### Format Example
```
data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wCE...
```

## Why Base64 Instead of URLs?

### ✅ Advantages
1. **Consistency**: Single format for all users (uploaded or OAuth)
2. **Privacy**: No dependency on external services
3. **Performance**: No external HTTP requests needed
4. **Offline Support**: Avatars work without internet
5. **Control**: We control size, quality, and format
6. **Security**: No external image loading risks

### ❌ Disadvantages (Mitigated)
1. **Database Size**: ~300KB per avatar (mitigated by 256x256 size limit)
2. **Initial Load**: Larger response size (acceptable for single user profile)

## Implementation

### 1. User Upload Flow
```javascript
// routes/users/upload-avatar.js
1. User uploads image file (multipart/form-data)
2. Validate file type (JPEG, PNG, GIF, WebP)
3. Process with Sharp:
   - Resize to 256x256px
   - Convert to JPEG (quality 85)
   - Optimize
4. Convert to base64 with data URI prefix
5. Store in database avatar_base64 field
```

### 2. OAuth User Flow
```javascript
// routes/auth/oauth-callback.js
1. Receive Google profile with avatar URL
2. Download image from URL (utils/avatar-converter.js)
3. Process with Sharp (same as upload):
   - Resize to 256x256px
   - Convert to JPEG (quality 85)
   - Optimize
4. Convert to base64 with data URI prefix
5. Store in database avatar_base64 field
```

### 3. Avatar Converter Utility

```javascript
// utils/avatar-converter.js

/**
 * Downloads OAuth avatar URL and converts to base64
 * - Handles download failures gracefully (returns null)
 * - Uses same processing as uploaded avatars
 * - Ensures consistency across all avatar sources
 */
export async function convertAvatarUrlToBase64(avatarUrl)

/**
 * Checks if avatar data is URL or base64
 */
export function isAvatarUrl(avatarData)

/**
 * Ensures avatar is in base64 format
 * - Converts URL if needed
 * - Returns base64 as-is
 * - Useful for migrations
 */
export async function ensureAvatarBase64(avatarData)
```

## Image Processing Standards

All avatars (uploaded or OAuth) are processed identically:

| Property | Value | Reason |
|----------|-------|--------|
| **Size** | 256x256px | Optimal for profile display |
| **Format** | JPEG | Best compression/quality ratio |
| **Quality** | 85 | Good quality, reasonable size |
| **Fit** | Cover (centered) | Consistent cropping |
| **Max Size** | ~300KB | Database and performance |

## Database Schema

```sql
CREATE TABLE users (
  ...
  avatar_base64 TEXT,  -- Base64 encoded image with data URI prefix
  ...
);
```

## Frontend Usage

Avatars can be used directly in HTML/CSS:

```html
<!-- Direct in img tag -->
<img src="${user.avatar_base64}" alt="Avatar">

<!-- Direct in CSS -->
<div style="background-image: url('${user.avatar_base64}')"></div>
```

## Error Handling

### Upload Failures
- File too large: Return error, user retries
- Invalid format: Return error, user retries
- Processing error: Return error, user retries

### OAuth Avatar Failures
- Download fails: User created **without avatar** (graceful degradation)
- Processing fails: User created **without avatar**
- User can upload avatar later using standard flow

## Migration Strategy

If you have existing users with URL avatars:

```javascript
import { ensureAvatarBase64 } from './utils/avatar-converter.js'

// Migration script
const users = getAllUsers()
for (const user of users) {
  if (isAvatarUrl(user.avatar_base64)) {
    const base64Avatar = await ensureAvatarBase64(user.avatar_base64)
    updateUserAvatar(user.id, base64Avatar)
  }
}
```

## Performance Considerations

### Database Impact
- 256x256 JPEG @ quality 85 ≈ 30-50KB
- Base64 encoding adds ~33% overhead
- Final size: ~40-70KB per avatar
- 10,000 users ≈ 400-700MB database growth (acceptable)

### Network Impact
- Avatar included in user profile response
- One-time download per user
- Cached by browser
- No additional HTTP requests needed

## Security Considerations

1. **File Type Validation**: Double-checked with file-type package
2. **Size Limits**: 5MB upload, 1MB processed
3. **Processing**: All images re-processed (prevents malicious content)
4. **No External Loads**: No XSS risk from external images
5. **Data URI**: Properly prefixed and validated

## Testing

### Test Cases
- ✅ Upload JPEG avatar
- ✅ Upload PNG avatar
- ✅ Upload GIF avatar
- ✅ Upload WebP avatar
- ✅ Upload oversized image
- ✅ Upload invalid file type
- ✅ OAuth user with Google avatar
- ✅ OAuth user with unreachable avatar
- ✅ Display avatar in profile
- ✅ Update avatar
- ✅ Remove avatar (set to null)

## Future Enhancements

### Potential Improvements
1. **Multiple Sizes**: Store thumbnail + full size
2. **WebP Support**: Better compression
3. **Lazy Loading**: Load avatars on demand
4. **CDN Integration**: Move to CDN if database grows too large
5. **Avatar Placeholder**: Default avatar for users without one

### Not Recommended
❌ **Store URLs instead of base64**: Breaks consistency, adds external dependencies
❌ **Store on filesystem**: Complicates deployment, backups, and scaling
❌ **Skip processing**: Security risk, inconsistent quality

## Summary

**Decision**: Convert all avatars (uploaded or OAuth) to base64-encoded JPEG images.

**Benefits**:
- ✅ Consistent format
- ✅ No external dependencies
- ✅ Better privacy and security
- ✅ Simplified architecture

**Trade-offs**:
- Database size increase (manageable)
- Initial response size increase (acceptable)

**Result**: Clean, consistent, secure avatar handling across the application.
