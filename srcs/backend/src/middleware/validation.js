/**
 * @file validation.js
 * @brief Middleware for validating user input, including password strength and equality
 */

/**
 * @brief Validate password strength and equality
 * @param {string} password - Password to validate
 * @param {string} confirmPassword - Password to compare for equality
 * @return {boolean} - True if password is strong and matches confirmPassword, false otherwise
 */
export function validatePassword(password, confirmPassword) {
  const strengthValid = validatePasswordStrength(password).isValid
  const equalsValid = validatePasswordEquals(password, confirmPassword)
  return strengthValid && equalsValid
}

/**
 * @brief Validate if two passwords match
 * @param {string} password - First password
 * @param {string} confirmPassword - Second password to compare
 * @return {boolean} - True if passwords match, false otherwise
 */
function validatePasswordEquals(password, confirmPassword) {
  return password === confirmPassword
}

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

/**
 * @brief Validate email format
 * @param {string} email - Email to validate
 * @return {boolean} - True if email format is valid, false otherwise
 */
export function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}
