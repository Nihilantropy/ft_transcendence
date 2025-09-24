// /**
//  * @brief Simple Google OAuth 2.0 Service
//  * 
//  * @description Clean, reliable OAuth implementation following Google's official example.
//  * Focused on core functionality without over-engineering.
//  * 
//  * @param googleapis - Google APIs client library
//  * @param URLSearchParams - Browser's native URL handling
//  * 
//  * @return Simple, maintainable OAuth flow for frontend applications
//  */

// import { google } from 'googleapis'

// // Simple type definitions
// export interface OAuthConfig {
//   clientId: string
//   clientSecret?: string
//   redirectUri: string
//   scopes: string[]
// }

// export interface OAuthCallbackResult {
//   code: string | null
//   error: string | null
//   state?: string | null
// }

// export interface OAuthError {
//   error: string
//   error_description?: string
// }

// /**
//  * @brief Simple Google OAuth 2.0 service
//  * 
//  * @description Lightweight implementation following official Google patterns.
//  * Handles auth URL generation, callback validation, and token exchange.
//  */
// export class GoogleOAuthService {
//   private readonly config: OAuthConfig
//   private readonly oauth2Client: any

//   constructor() {
//     // Get configuration from environment
//     const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
//     const clientSecret = import.meta.env.VITE_GOOGLE_CLIENT_SECRET
//     const baseUri = import.meta.env.VITE_APP_BASE_URL || window.location.origin
    
//     if (!clientId) {
//       throw new Error('VITE_GOOGLE_CLIENT_ID is required')
//     }

//     this.config = {
//       clientId,
//       clientSecret, // Optional for frontend-only flows
//       redirectUri: `${baseUri}/auth/oauth/google/callback`,
//       scopes: [
//         'https://www.googleapis.com/auth/userinfo.email',
//         'https://www.googleapis.com/auth/userinfo.profile'
//       ]
//     }

//     // Initialize OAuth2 client
//     this.oauth2Client = new google.auth.OAuth2(
//       this.config.clientId,
//       this.config.clientSecret,
//       this.config.redirectUri
//     )

//     console.log('🔐 Google OAuth Service initialized', {
//       redirectUri: this.config.redirectUri,
//       scopes: this.config.scopes.length
//     })
//   }

//   /**
//    * @brief Check if OAuth is properly configured
//    * 
//    * @return boolean - True if client ID and redirect URI are available
//    */
//   public isAvailable(): boolean {
//     return !!(this.config.clientId && this.config.redirectUri)
//   }

//   /**
//    * @brief Generate OAuth authorization URL
//    * 
//    * @param options - Optional state parameter for redirect handling
//    * @return string - Authorization URL to redirect user to
//    */
//   public getAuthorizationUrl(state?: string): string {
//     if (!this.isAvailable()) {
//       throw new Error('Google OAuth is not properly configured')
//     }

//     const authUrl = this.oauth2Client.generateAuthUrl({
//       access_type: 'offline',
//       scope: this.config.scopes,
//       state: state || undefined,
//       prompt: 'select_account' // Allow user to choose account
//     })

//     return authUrl
//   }

//   /**
//    * @brief Start OAuth flow by redirecting to Google
//    * 
//    * @param returnTo - Optional URL to return to after OAuth completion
//    */
//   public startOAuth(returnTo?: string): void {
//     try {
//       const state = returnTo ? btoa(JSON.stringify({ returnTo })) : undefined
//       const authUrl = this.getAuthorizationUrl(state)
      
//       console.log('🔗 Starting OAuth flow', { 
//         returnTo: returnTo || 'none' 
//       })
      
//       window.location.href = authUrl
//     } catch (error) {
//       console.error('❌ Failed to start OAuth:', error)
//       throw error
//     }
//   }

//   /**
//    * @brief Validate OAuth callback parameters
//    * 
//    * @param params - URLSearchParams from the callback URL
//    * @return OAuthCallbackResult - Parsed callback data with validation
//    */
//   public validateCallback(params: URLSearchParams): OAuthCallbackResult {
//     const code = params.get('code')
//     const error = params.get('error')
//     const errorDescription = params.get('error_description')
//     const state = params.get('state')

//     // Handle OAuth errors from Google
//     if (error) {
//       console.error('❌ OAuth error:', error, errorDescription)
//       return {
//         code: null,
//         error: `${error}: ${errorDescription || 'Unknown error'}`,
//         state
//       }
//     }

//     // Validate authorization code presence
//     if (!code) {
//       console.error('❌ No authorization code received')
//       return {
//         code: null,
//         error: 'No authorization code received from Google'
//       }
//     }

//     console.log('✅ OAuth callback validated')
//     return {
//       code,
//       error: null,
//       state
//     }
//   }

//   /**
//    * @brief Exchange authorization code for access token
//    * 
//    * @param code - Authorization code from OAuth callback
//    * @return Promise<any> - Token response from Google
//    */
//   public async exchangeCodeForTokens(code: string): Promise<any> {
//     try {
//       const { tokens } = await this.oauth2Client.getToken(code)
      
//       console.log('✅ Tokens exchanged successfully')
//       return tokens
//     } catch (error) {
//       console.error('❌ Token exchange failed:', error)
//       throw new Error('Failed to exchange authorization code for tokens')
//     }
//   }

//   /**
//    * @brief Parse return URL from state parameter
//    * 
//    * @param state - State parameter from OAuth callback
//    * @return string | undefined - Return URL if valid state
//    */
//   public parseReturnUrl(state?: string | null): string | undefined {
//     if (!state) return undefined

//     try {
//       const decoded = JSON.parse(atob(state))
//       return decoded.returnTo
//     } catch (error) {
//       console.warn('⚠️ Failed to parse state parameter:', error)
//       return undefined
//     }
//   }

//   /**
//    * @brief Get OAuth configuration (safe for logging)
//    * 
//    * @return Partial config without sensitive data
//    */
//   public getConfig(): Omit<OAuthConfig, 'clientSecret'> {
//     const { clientSecret, ...safeConfig } = this.config
//     return safeConfig
//   }

//   /**
//    * @brief Set OAuth credentials for API calls
//    * 
//    * @param tokens - Token object from Google OAuth
//    */
//   public setCredentials(tokens: any): void {
//     this.oauth2Client.setCredentials(tokens)
//     console.log('✅ OAuth credentials set for API calls')
//   }

//   /**
//    * @brief Get authenticated OAuth client for API calls
//    * 
//    * @return OAuth2 client with credentials set
//    */
//   public getAuthenticatedClient(): any {
//     return this.oauth2Client
//   }
// }

// /**
//  * @brief Export singleton instance
//  * 
//  * @description Single instance for consistent OAuth state management
//  */
// export const googleOAuthService = new GoogleOAuthService()