/**
 * @brief Password Utility Service for ft_transcendence
 * 
 * @description Handles password validation and strength checking on the client-side.
 * Password hashing is handled securely on the backend server.
 * 
 * NOTE: We DO NOT hash passwords on the frontend for security reasons.
 * This service only validates password strength and provides UI feedback.
 */

// No bcryptjs import - password hashing happens on the backend!

/**
 * @brief Password strength levels
 */
export type PasswordStrength = 'weak' | 'fair' | 'good' | 'strong' | 'very-strong'

/**
 * @brief Password validation result
 */
export interface PasswordValidation {
  isValid: boolean
  strength: PasswordStrength
  score: number // 0-100
  feedback: string[]
  requirements: {
    minLength: boolean
    hasUppercase: boolean
    hasLowercase: boolean
    hasNumbers: boolean
    hasSpecialChars: boolean
    noCommonPatterns: boolean
  }
}

/**
 * @brief Password utility class
 * 
 * @description Provides password validation and strength checking for the frontend.
 * Password hashing is handled securely on the backend server.
 */
export class PasswordUtils {
  private static readonly MIN_PASSWORD_LENGTH = 8
  private static readonly MAX_PASSWORD_LENGTH = 128
  
  // Common weak passwords to check against
  private static readonly COMMON_PASSWORDS = [
    'password', '123456', '123456789', 'qwerty', 'abc123', 
    'password123', 'admin', 'letmein', 'welcome', 'monkey',
    'dragon', 'master', 'sunshine', 'princess', 'football'
  ]

  // Common patterns to avoid
  private static readonly WEAK_PATTERNS = [
    /^(.)\1+$/, // All same character (aaaa)
    /^(012|123|234|345|456|567|678|789|890)+/, // Sequential numbers
    /^(abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz)+/i, // Sequential letters
    /^(.{1,3})\1+$/, // Repeated short patterns (123123123)
  ]

  /**
   * @brief Validate password and check strength
   * 
   * @param password - Password to validate
   * @returns Password validation result
   */
  public static validatePassword(password: string): PasswordValidation {
    const requirements = {
      minLength: password.length >= this.MIN_PASSWORD_LENGTH,
      hasUppercase: /[A-Z]/.test(password),
      hasLowercase: /[a-z]/.test(password),
      hasNumbers: /[0-9]/.test(password),
      hasSpecialChars: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\?]/.test(password),
      noCommonPatterns: !this.hasCommonPatterns(password)
    }

    const feedback: string[] = []
    let score = 0

    // Length validation
    if (!requirements.minLength) {
      feedback.push(`Password must be at least ${this.MIN_PASSWORD_LENGTH} characters long`)
    } else {
      score += 20
      if (password.length >= 12) score += 10
      if (password.length >= 16) score += 10
    }

    if (password.length > this.MAX_PASSWORD_LENGTH) {
      feedback.push(`Password must not exceed ${this.MAX_PASSWORD_LENGTH} characters`)
      return {
        isValid: false,
        strength: 'weak',
        score: 0,
        feedback,
        requirements
      }
    }

    // Character type requirements
    if (!requirements.hasUppercase) {
      feedback.push('Include at least one uppercase letter (A-Z)')
    } else {
      score += 15
    }

    if (!requirements.hasLowercase) {
      feedback.push('Include at least one lowercase letter (a-z)')
    } else {
      score += 15
    }

    if (!requirements.hasNumbers) {
      feedback.push('Include at least one number (0-9)')
    } else {
      score += 15
    }

    if (!requirements.hasSpecialChars) {
      feedback.push('Include at least one special character (!@#$%^&*)')
    } else {
      score += 15
    }

    // Pattern validation
    if (!requirements.noCommonPatterns) {
      feedback.push('Avoid common patterns, repeated characters, or sequential characters')
      score -= 20
    } else {
      score += 10
    }

    // Check against common passwords
    if (this.isCommonPassword(password)) {
      feedback.push('This password is too common. Choose a more unique password.')
      score -= 30
    }

    // Additional complexity bonus
    const uniqueChars = new Set(password).size
    if (uniqueChars >= password.length * 0.7) {
      score += 10 // Good character diversity
    }

    // Calculate final score and strength
    score = Math.max(0, Math.min(100, score))
    const strength = this.calculateStrength(score)
    const isValid = Object.values(requirements).every(req => req) && 
                   score >= 60 && 
                   feedback.length === 0

    if (feedback.length === 0 && score >= 80) {
      feedback.push('Strong password! ✅')
    } else if (feedback.length === 0 && score >= 60) {
      feedback.push('Good password. Consider making it stronger.')
    }

    return {
      isValid,
      strength,
      score,
      feedback,
      requirements
    }
  }

  /**
   * @brief Calculate password strength based on score
   */
  private static calculateStrength(score: number): PasswordStrength {
    if (score >= 90) return 'very-strong'
    if (score >= 75) return 'strong'
    if (score >= 60) return 'good'
    if (score >= 40) return 'fair'
    return 'weak'
  }

  /**
   * @brief Check if password contains common patterns
   */
  private static hasCommonPatterns(password: string): boolean {
    return this.WEAK_PATTERNS.some(pattern => pattern.test(password))
  }

  /**
   * @brief Check if password is in common passwords list
   */
  private static isCommonPassword(password: string): boolean {
    const lowerPassword = password.toLowerCase()
    return this.COMMON_PASSWORDS.includes(lowerPassword)
  }

  /**
   * @brief Generate a secure random password
   * 
   * @param length - Desired password length (default: 16)
   * @returns Generated secure password
   */
  public static generateSecurePassword(length: number = 16): string {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    const lowercase = 'abcdefghijklmnopqrstuvwxyz'
    const numbers = '0123456789'
    const specialChars = '!@#$%^&*()_+-=[]{}|;:,.<>?'
    
    const allChars = uppercase + lowercase + numbers + specialChars
    
    let password = ''
    
    // Ensure at least one character from each type
    password += uppercase[Math.floor(Math.random() * uppercase.length)]
    password += lowercase[Math.floor(Math.random() * lowercase.length)]
    password += numbers[Math.floor(Math.random() * numbers.length)]
    password += specialChars[Math.floor(Math.random() * specialChars.length)]
    
    // Fill the rest randomly
    for (let i = 4; i < length; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)]
    }
    
    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('')
  }

  /**
   * @brief Get strength color for UI display
   */
  public static getStrengthColor(strength: PasswordStrength): string {
    switch (strength) {
      case 'very-strong': return '#22c55e' // green-500
      case 'strong': return '#65a30d' // lime-600
      case 'good': return '#eab308' // yellow-500
      case 'fair': return '#f97316' // orange-500
      case 'weak': return '#ef4444' // red-500
      default: return '#6b7280' // gray-500
    }
  }

  /**
   * @brief Get strength text for UI display
   */
  public static getStrengthText(strength: PasswordStrength): string {
    switch (strength) {
      case 'very-strong': return 'Very Strong 🛡️'
      case 'strong': return 'Strong 💪'
      case 'good': return 'Good ✅'
      case 'fair': return 'Fair ⚠️'
      case 'weak': return 'Weak ❌'
      default: return 'Unknown'
    }
  }
}