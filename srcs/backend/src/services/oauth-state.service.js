/**
 * @file OAuth State Manager Service
 * @description Manages CSRF protection tokens for OAuth flows
 */

import crypto from 'crypto'
import { logger } from '../logger.js'

const stateLogger = logger.child({ module: 'services/oauth-state' })

/**
 * @brief OAuth state management for CSRF protection
 * @description In production, replace Map with Redis for multi-instance support
 */
class OAuthStateManager {
  constructor() {
    // TODO: Replace with Redis in production for multi-instance support
    this.states = new Map()
    
    // Cleanup expired states every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000)
    
    stateLogger.info('✅ OAuth State Manager initialized')
  }

  /**
   * @brief Create new OAuth state token
   * @param {number} userId - Optional user ID for authenticated flows
   * @return {string} Secure random state token (64 hex characters)
   */
  create(userId = null) {
    const state = crypto.randomBytes(32).toString('hex')
    
    this.states.set(state, {
      userId,
      createdAt: Date.now(),
      expiresAt: Date.now() + 5 * 60 * 1000 // 5 minutes
    })
    
    stateLogger.debug('Created OAuth state', { 
      state: state.substring(0, 8) + '...', 
      userId,
      totalStates: this.states.size
    })
    
    return state
  }

  /**
   * @brief Validate and consume OAuth state token (one-time use)
   * @param {string} state - State token from OAuth callback
   * @return {Object|null} State data or null if invalid
   */
  validate(state) {
    if (!state || typeof state !== 'string') {
      stateLogger.warn('Invalid state format', { type: typeof state })
      return null
    }
    
    const data = this.states.get(state)
    
    if (!data) {
      stateLogger.warn('State not found', { 
        state: state.substring(0, 8) + '...',
        totalStates: this.states.size
      })
      return null
    }
    
    if (data.expiresAt < Date.now()) {
      stateLogger.warn('State expired', { 
        state: state.substring(0, 8) + '...',
        age: Math.floor((Date.now() - data.createdAt) / 1000) + 's'
      })
      this.states.delete(state)
      return null
    }
    
    // One-time use: delete immediately after validation
    this.states.delete(state)
    
    stateLogger.debug('✅ State validated and consumed', { 
      state: state.substring(0, 8) + '...',
      userId: data.userId,
      remainingStates: this.states.size
    })
    
    return data
  }

  /**
   * @brief Remove expired states
   */
  cleanup() {
    const now = Date.now()
    let cleaned = 0
    
    for (const [state, data] of this.states.entries()) {
      if (data.expiresAt < now) {
        this.states.delete(state)
        cleaned++
      }
    }
    
    if (cleaned > 0) {
      stateLogger.debug('Cleaned expired OAuth states', { 
        cleaned, 
        remaining: this.states.size 
      })
    }
  }

  /**
   * @brief Get current state count (for monitoring)
   * @return {number} Number of active states
   */
  getStateCount() {
    return this.states.size
  }

  /**
   * @brief Cleanup on shutdown
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    this.states.clear()
    stateLogger.info('OAuth State Manager destroyed')
  }
}

// Export singleton
export const oauthStateManager = new OAuthStateManager()
export default oauthStateManager
