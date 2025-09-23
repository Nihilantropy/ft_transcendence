/**
 * @brief Google OAuth 2.0 Service for ft_transcendence
 * 
 * @description Minimal, essential OAuth 2.0 implementation for Google authentication.
 * Handles authorization URL generation, token exchange, and user profile fetching.
 */

import type { GoogleProfile, OAuthState } from '../../types/store.types'

/**
 * @brief OAuth configuration interface
 */
export interface OAuthConfig {
  clientId: string
  redirectUri: string
  scope: string[]
}

/**
 * @brief OAuth token response from Google
 */
export interface OAuthTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
  refresh_token?: string
  scope: string
  id_token?: string
}

/**
 * @brief OAuth error response
 */
export interface OAuthError {
  error: string
  error_description?: string
  error_uri?: string
}

/**
 * @brief Google OAuth 2.0 service class
 * 
 * @description Essential OAuth implementation with security best practices.
 */
export class GoogleOAuthService {
  private readonly config: OAuthConfig
  private readonly GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
  private readonly GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
  private readonly GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo'

  constructor() {
    // Load configuration from environment variables
    this.config = {
      clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
      redirectUri: window.location.origin + import.meta.env.VITE_GOOGLE_REDIRECT_URI,
      scope: [
        'openid',
        'email', 
        'profile'
      ]
    }

    if (!this.config.clientId) {
      console.warn('⚠️ Google OAuth client ID not configured')
    }
  }

  /**
   * @brief Generate secure OAuth state parameter
   */
  private generateState(returnTo?: string): OAuthState {
    // Generate cryptographically secure random state
    const array = new Uint8Array(32)
    crypto.getRandomValues(array)
    const state = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')

    return {
      state,
      returnTo,
      createdAt: new Date()
    }
  }

  /**
   * @brief Store OAuth state securely
   */
  private storeOAuthState(oauthState: OAuthState): void {
    try {
      // Store in sessionStorage (more secure than localStorage for temporary data)
      sessionStorage.setItem('oauth_state', JSON.stringify(oauthState))
    } catch (error) {
      console.error('Failed to store OAuth state:', error)
      throw new Error('OAuth state storage failed')
    }
  }

  /**
   * @brief Retrieve and validate OAuth state
   */
  private getStoredOAuthState(stateParam: string): OAuthState | null {
    try {
      const storedJson = sessionStorage.getItem('oauth_state')
      if (!storedJson) {
        console.error('No OAuth state found in storage')
        return null
      }

      const stored: OAuthState = JSON.parse(storedJson)
      
      // Validate state parameter matches
      if (stored.state !== stateParam) {
        console.error('OAuth state mismatch - possible CSRF attack')
        return null
      }

      // Check if state is not too old (max 10 minutes)
      const maxAge = 10 * 60 * 1000 // 10 minutes
      if (Date.now() - new Date(stored.createdAt).getTime() > maxAge) {
        console.error('OAuth state expired')
        return null
      }

      return stored
    } catch (error) {
      console.error('Failed to retrieve OAuth state:', error)
      return null
    } finally {
      // Clean up stored state
      sessionStorage.removeItem('oauth_state')
    }
  }

  /**
   * @brief Check if OAuth is properly configured
   */
  public isConfigured(): boolean {
    return Boolean(this.config.clientId && this.config.redirectUri)
  }

  /**
   * @brief Generate Google OAuth authorization URL
   */
  public generateAuthUrl(returnTo?: string): string {
    if (!this.isConfigured()) {
      throw new Error('Google OAuth not configured')
    }

    // Generate secure state parameter
    const oauthState = this.generateState(returnTo)
    this.storeOAuthState(oauthState)

    // Build authorization URL
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      scope: this.config.scope.join(' '),
      state: oauthState.state,
      access_type: 'offline', // Get refresh token
      prompt: 'consent' // Force consent screen to get refresh token
    })

    const authUrl = `${this.GOOGLE_AUTH_URL}?${params.toString()}`
    console.log('🔐 Generated OAuth URL:', authUrl)
    
    return authUrl
  }

  /**
   * @brief Exchange authorization code for access token
   */
  public async exchangeCodeForToken(code: string, state: string): Promise<OAuthTokenResponse> {
    // Validate state parameter
    const storedState = this.getStoredOAuthState(state)
    if (!storedState) {
      throw new Error('Invalid or expired OAuth state')
    }

    try {
      const response = await fetch(this.GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: this.config.clientId,
          client_secret: '', // Note: In production, this should be handled by backend
          code,
          grant_type: 'authorization_code',
          redirect_uri: this.config.redirectUri,
        }),
      })

      if (!response.ok) {
        const errorData: OAuthError = await response.json()
        throw new Error(`Token exchange failed: ${errorData.error_description || errorData.error}`)
      }

      const tokenData: OAuthTokenResponse = await response.json()
      console.log('🔐 OAuth token exchange successful')
      
      return tokenData
    } catch (error) {
      console.error('OAuth token exchange failed:', error)
      throw error
    }
  }

  /**
   * @brief Fetch Google user profile
   */
  public async fetchUserProfile(accessToken: string): Promise<GoogleProfile> {
    try {
      const response = await fetch(`${this.GOOGLE_USERINFO_URL}?access_token=${accessToken}`)

      if (!response.ok) {
        throw new Error(`Failed to fetch user profile: ${response.statusText}`)
      }

      const profile: GoogleProfile = await response.json()
      console.log('🔐 Google profile fetched for:', profile.email)
      
      return profile
    } catch (error) {
      console.error('Failed to fetch Google profile:', error)
      throw error
    }
  }

  /**
   * @brief Initiate OAuth flow
   */
  public startOAuthFlow(returnTo?: string): void {
    if (!this.isConfigured()) {
      throw new Error('Google OAuth not configured. Please set VITE_GOOGLE_CLIENT_ID.')
    }

    const authUrl = this.generateAuthUrl(returnTo)
    window.location.href = authUrl
  }

  /**
   * @brief Complete OAuth flow (to be called on callback page)
   */
  public async completeOAuthFlow(searchParams: URLSearchParams): Promise<{
    profile: GoogleProfile
    tokens: OAuthTokenResponse
    returnTo?: string
  }> {
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    // Handle OAuth errors
    if (error) {
      const errorDescription = searchParams.get('error_description')
      throw new Error(`OAuth error: ${errorDescription || error}`)
    }

    // Validate required parameters
    if (!code || !state) {
      throw new Error('Missing authorization code or state parameter')
    }

    try {
      // Exchange code for tokens
      const tokens = await this.exchangeCodeForToken(code, state)
      
      // Fetch user profile
      const profile = await this.fetchUserProfile(tokens.access_token)

      // Get return URL from stored state
      const storedState = this.getStoredOAuthState(state)
      
      return {
        profile,
        tokens,
        returnTo: storedState?.returnTo
      }
    } catch (error) {
      console.error('OAuth flow completion failed:', error)
      throw error
    }
  }

  /**
   * @brief Parse OAuth callback URL
   */
  public parseCallbackUrl(url: string = window.location.href): URLSearchParams {
    const urlObj = new URL(url)
    return urlObj.searchParams
  }
}

// Export singleton instance
export const googleOAuthService = new GoogleOAuthService()