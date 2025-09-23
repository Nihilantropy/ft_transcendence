/**
 * @brief Services module exports for ft_transcendence backend
 * 
 * @description Central export point for all service modules
 */

// User service
export { default as userService, UserService } from './user.service.js'

// Email service
export { default as emailService, EmailService } from './email.service.js'