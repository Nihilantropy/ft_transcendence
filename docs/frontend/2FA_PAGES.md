# Two-Factor Authentication (2FA) Pages Documentation

This document provides an overview of the 2FA pages and how to integrate them into your application flow.

## 📋 Available Pages

### 1. TwoFactorSetupPage
**Purpose**: Initial 2FA setup for users who don't have 2FA enabled
**Route**: `/setup-2fa`
**Requirements**: User must be authenticated

**Features**:
- QR code generation for authenticator apps
- Manual secret key entry as fallback
- TOTP token verification
- Backup codes generation and display
- Step-by-step guided setup process

**Usage**:
```typescript
import { TwoFactorSetupPage } from '@/pages/auth'

const setupPage = new TwoFactorSetupPage({
  onComplete: () => {
    // Handle setup completion
    router.navigate('/profile')
  }
})
```

### 2. TwoFactorAuthPage
**Purpose**: 2FA verification during login process
**Route**: `/auth/2fa?tempToken=<token>`
**Requirements**: Temporary token from initial login

**Features**:
- TOTP token input
- Backup code support
- Toggle between TOTP and backup code modes
- Attempt limiting (3 attempts)
- Auto-redirect on success

**Usage**:
```typescript
import { TwoFactorAuthPage } from '@/pages/auth'

const authPage = new TwoFactorAuthPage({
  tempToken: 'temporary_login_token',
  onSuccess: (user) => {
    // Handle successful 2FA verification
    console.log('User logged in:', user)
  },
  onCancel: () => {
    // Handle cancellation
    router.navigate('/login')
  }
})
```

### 3. TwoFactorManagePage
**Purpose**: Manage existing 2FA settings
**Route**: `/manage-2fa`
**Requirements**: User must be authenticated with 2FA enabled

**Features**:
- View current 2FA status
- Disable 2FA with password confirmation
- Optional 2FA token verification for extra security
- Security warnings and confirmations

**Usage**:
```typescript
import { TwoFactorManagePage } from '@/pages/auth'

const managePage = new TwoFactorManagePage({
  onNavigate: (path) => {
    // Handle navigation
    router.navigate(path)
  }
})
```

## 🔄 Integration Flow

### Complete Login Flow with 2FA

```typescript
// 1. Initial login attempt
const loginResult = await authService.login({
  identifier: 'user@example.com',
  password: 'password123'
})

if (loginResult.success) {
  if (loginResult.requiresTwoFactor) {
    // 2. Redirect to 2FA verification
    router.navigate(`/auth/2fa?tempToken=${loginResult.tempToken}`)
  } else {
    // 3. Login complete, redirect to app
    router.navigate('/home')
  }
}
```

### 2FA Setup Flow

```typescript
// 1. User wants to enable 2FA
router.navigate('/setup-2fa')

// 2. Setup page handles the entire process:
//    - Generate QR code and secret
//    - User scans QR code
//    - Verify TOTP token
//    - Show backup codes
//    - Enable 2FA

// 3. Redirect to profile on completion
```

### 2FA Management Flow

```typescript
// 1. User accesses 2FA settings
router.navigate('/manage-2fa')

// 2. Management page shows current status and options:
//    - View 2FA status
//    - Disable 2FA option

// 3. Disable process:
//    - Enter password
//    - Optional 2FA token for extra security
//    - Confirm and disable
```

## 🧩 Components

### TwoFactorSettingsComponent
**Purpose**: Reusable component for profile/settings pages
**Usage**: Display 2FA status and provide quick access to management

```typescript
import { TwoFactorSettingsComponent } from '@/components/auth'

// In your profile page
const settingsComponent = new TwoFactorSettingsComponent({
  onNavigate: (path) => router.navigate(path)
})

// Mount in profile page
const container = document.querySelector('#2fa-settings')
settingsComponent.mount(container)
```

## 🛡️ Security Features

### Authentication Requirements
- **Setup**: User must be logged in
- **Management**: User must be logged in with 2FA enabled
- **Verification**: Uses temporary token from initial login

### Password Protection
- 2FA disable requires current password confirmation
- Optional 2FA token for extra security during disable

### Attempt Limiting
- 2FA verification limited to 3 attempts
- Auto-redirect to login on too many failures

### Error Handling
- Comprehensive error messages
- Graceful degradation on failures
- Clear user feedback

## 🎨 UI/UX Features

### Responsive Design
- Mobile-friendly input fields
- Large, easy-to-read QR codes
- Touch-friendly buttons

### Accessibility
- Clear labels and instructions
- Keyboard navigation support
- Screen reader friendly

### Visual Feedback
- Loading states
- Success/error animations
- Progress indicators

### User Guidance
- Step-by-step instructions
- Help sections
- Recommended authenticator apps list

## 🔧 Customization

### Styling
All pages use consistent styling with the rest of the application:
- Dark theme with green accents
- Neon glow effects
- Monospace font for codes
- Consistent button styling

### Callbacks
Most pages accept callback functions for custom navigation and handling:
- `onComplete`: Setup completion
- `onSuccess`: Verification success
- `onCancel`: User cancellation
- `onNavigate`: Custom navigation

### Configuration
Pages automatically adapt based on:
- Current user authentication status
- 2FA enabled/disabled state
- Available authentication methods

## 📱 Mobile Considerations

### QR Code Scanning
- Large QR codes for easy scanning
- Manual entry fallback option
- Clear scanning instructions

### Input Handling
- Numeric input mode for TOTP codes
- Auto-focus on code inputs
- Enter key support for quick submission

### Touch Interactions
- Large touch targets
- Swipe-friendly interfaces
- Haptic feedback considerations

## 🔮 Future Enhancements

### Planned Features
- Backup code regeneration
- Multiple authenticator device support
- SMS fallback option
- Recovery email verification

### Integration Points
- WebAuthn/FIDO2 support
- Hardware token support
- Biometric authentication
- OAuth provider 2FA delegation

This documentation provides a comprehensive guide for implementing and using the 2FA pages in your application. Each page is designed to work independently while maintaining consistency with the overall application architecture.