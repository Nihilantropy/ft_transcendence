/**
 * @brief Validate password strength
 * @param {string} password - Password to validate
 * @return {object} - Validation result
 */
function validatePasswordStrength(password) {
  // Basic password strength validation
  const hasLength = password.length >= 8
  const hasUpper = /[A-Z]/.test(password)
  const hasLower = /[a-z]/.test(password)
  const hasNumber = /\d/.test(password)
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password)
  
  const score = [hasLength, hasUpper, hasLower, hasNumber, hasSpecial].filter(Boolean).length
  
  return {
    isValid: score >= 4,
    score,
    message: score < 4 ? 'Password must contain uppercase, lowercase, number, and special character' : 'Strong password'
  }
}