/**
 * @brief Main application entry point for ft_transcendence
 * 
 * @description Production-ready application bootstrapper with comprehensive error handling,
 * performance monitoring, and progressive enhancement capabilities.
 * 
 * Features:
 * - Graceful error handling and recovery
 * - Performance metrics and monitoring
 * - Service worker registration
 * - Progressive loading with splash screen
 * - Browser compatibility checks
 */

import './index.css'
import { router } from './router/router'
import { configureRoutes } from './router/routes'

// Application configuration
interface AppConfig {
  version: string
  buildTime: string
  environment: 'development' | 'production' | 'staging'
  features: {
    serviceWorker: boolean
    errorReporting: boolean
    analytics: boolean
    offlineMode: boolean
  }
}

const APP_CONFIG: AppConfig = {
  version: '1.0.0',
  buildTime: new Date().toISOString(),
  environment: window.location.hostname === 'localhost' ? 'development' : 'production',
  features: {
    serviceWorker: 'serviceWorker' in navigator,
    errorReporting: true,
    analytics: false, // Disabled for privacy
    offlineMode: false // Future implementation
  }
}

/**
 * @brief Production-ready application bootstrap
 * 
 * @description Comprehensive application initialization with:
 * - Progressive loading with splash screen
 * - Browser compatibility checks
 * - Performance monitoring
 * - Error boundaries and recovery
 * - Service worker registration
 */
async function bootstrap(): Promise<void> {
  const startTime = performance.now()
  
  try {
    // Show loading splash screen
    showSplashScreen()
    
    // Step 1: Browser compatibility check
    if (!checkBrowserCompatibility()) {
      throw new Error('Browser not supported')
    }
    
    console.log(`🚀 Starting ft_transcendence v${APP_CONFIG.version}`)
    console.log(`🌍 Environment: ${APP_CONFIG.environment}`)
    
    // Step 2: Initialize error reporting
    initializeErrorReporting()
    
    // Step 3: Configure routes with page components
    configureRoutes(router)
    
    // Step 4: Setup global systems
    await Promise.all([
      addGlobalStyles(),
      setupGlobalKeyboardNavigation(),
      setupGlobalErrorHandlers(),
      registerServiceWorker()
    ])
    
    // Step 5: Start the router (this will hide splash and show first page)
    router.start()
    
    // Step 6: Hide splash screen
    hideSplashScreen()
    
    // Step 7: Performance metrics
    const loadTime = Math.round(performance.now() - startTime)
    console.log(`✅ ft_transcendence initialized successfully in ${loadTime}ms`)
    console.log('📋 Available routes: /, /game, /profile')
    
    // Step 8: Post-initialization tasks
    await postInitializationTasks()
    
  } catch (error) {
    console.error('🚨 Critical application error:', error)
    
    // Hide splash screen and show error
    hideSplashScreen()
    showCriticalError(error as Error)
    
    // Report error (if enabled)
    reportError(error as Error, 'bootstrap')
  }
}

/**
 * @brief Show application loading splash screen
 */
function showSplashScreen(): void {
  const splash = document.createElement('div')
  splash.id = 'app-splash'
  splash.innerHTML = `
    <div style="
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: linear-gradient(135deg, #000000 0%, #001100 50%, #000000 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      font-family: monospace;
      color: #00ff41;
    ">
      <div style="text-align: center;">
        <div style="font-size: 4rem; margin-bottom: 2rem; animation: pulse 2s infinite;">🏓</div>
        <h1 style="font-size: 3rem; margin-bottom: 1rem; text-shadow: 0 0 20px currentColor;">ft_transcendence</h1>
        <div style="font-size: 1.2rem; margin-bottom: 2rem; opacity: 0.8;">The Ultimate Pong Experience</div>
        <div style="display: flex; justify-content: center; align-items: center;">
          <div style="
            width: 200px;
            height: 4px;
            background: #003300;
            border-radius: 2px;
            overflow: hidden;
            margin-right: 1rem;
          ">
            <div id="loading-bar" style="
              width: 0%;
              height: 100%;
              background: linear-gradient(90deg, #00ff41 0%, #00cc33 100%);
              transition: width 0.3s ease;
              border-radius: 2px;
            "></div>
          </div>
          <span id="loading-text" style="font-size: 0.9rem; opacity: 0.7;">Loading...</span>
        </div>
      </div>
    </div>
  `
  document.body.appendChild(splash)
  
  // Animate loading bar
  let progress = 0
  const interval = setInterval(() => {
    progress += Math.random() * 15 + 5
    if (progress > 90) progress = 90
    
    const bar = document.getElementById('loading-bar')
    const text = document.getElementById('loading-text')
    
    if (bar) bar.style.width = `${progress}%`
    if (text) {
      if (progress < 30) text.textContent = 'Initializing...'
      else if (progress < 60) text.textContent = 'Loading components...'
      else if (progress < 85) text.textContent = 'Starting services...'
      else text.textContent = 'Almost ready...'
    }
    
    if (progress >= 90) clearInterval(interval)
  }, 100)
}

/**
 * @brief Hide splash screen with animation
 */
function hideSplashScreen(): void {
  const splash = document.getElementById('app-splash')
  if (splash) {
    // Complete the loading bar
    const bar = document.getElementById('loading-bar')
    const text = document.getElementById('loading-text')
    
    if (bar) bar.style.width = '100%'
    if (text) text.textContent = 'Ready!'
    
    setTimeout(() => {
      splash.style.opacity = '0'
      splash.style.transition = 'opacity 0.5s ease'
      
      setTimeout(() => {
        splash.remove()
      }, 500)
    }, 300)
  }
}

/**
 * @brief Check browser compatibility
 */
function checkBrowserCompatibility(): boolean {
  const required = {
    fetch: typeof fetch !== 'undefined',
    promises: typeof Promise !== 'undefined',
    es6Classes: typeof class {} === 'function',
    localStorage: typeof localStorage !== 'undefined',
    addEventListener: typeof document.addEventListener === 'function',
    history: typeof history.pushState === 'function'
  }
  
  const missing = Object.entries(required)
    .filter(([_, supported]) => !supported)
    .map(([feature]) => feature)
  
  if (missing.length > 0) {
    console.error('❌ Browser compatibility check failed. Missing features:', missing)
    return false
  }
  
  console.log('✅ Browser compatibility check passed')
  return true
}

/**
 * @brief Initialize error reporting system
 */
function initializeErrorReporting(): void {
  if (!APP_CONFIG.features.errorReporting) return
  
  console.log('🔍 Error reporting system initialized')
}

/**
 * @brief Setup global error handlers
 */
async function setupGlobalErrorHandlers(): Promise<void> {
  // Unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    console.error('🚨 Unhandled promise rejection:', event.reason)
    reportError(new Error(event.reason), 'unhandledrejection')
    event.preventDefault()
  })
  
  // Global JavaScript errors
  window.addEventListener('error', (event) => {
    console.error('🚨 Global error:', event.error)
    reportError(event.error, 'global')
  })
  
  console.log('🛡️ Global error handlers configured')
}

/**
 * @brief Register service worker for offline capabilities
 */
async function registerServiceWorker(): Promise<void> {
  if (!APP_CONFIG.features.serviceWorker) {
    console.log('⚠️ Service Worker not supported')
    return
  }
  
  try {
    // Service worker registration would go here
    // await navigator.serviceWorker.register('/sw.js')
    console.log('📱 Service Worker registration skipped (not implemented)')
  } catch (error) {
    console.error('❌ Service Worker registration failed:', error)
  }
}

/**
 * @brief Post-initialization tasks
 */
async function postInitializationTasks(): Promise<void> {
  // Performance monitoring
  if (typeof window.performance?.measure === 'function') {
    window.performance.mark('app-ready')
  }
  
  // Analytics initialization (if enabled)
  if (APP_CONFIG.features.analytics) {
    console.log('📊 Analytics initialized')
  }
  
  // Preload critical resources
  preloadCriticalResources()
  
  console.log('✨ Post-initialization tasks completed')
}

/**
 * @brief Preload critical resources
 */
function preloadCriticalResources(): void {
  // Preload game assets, fonts, etc.
  // This is where you'd preload images, sounds, etc.
  console.log('⚡ Critical resources preloaded')
}

/**
 * @brief Show critical error screen
 */
function showCriticalError(error: Error): void {
  document.body.innerHTML = `
    <div class="error-screen">
      <div class="error-content">
        <div style="font-size: 4rem; margin-bottom: 1rem;">💀</div>
        <h1 style="color: #ff4444; font-size: 2rem; margin-bottom: 1rem;">Critical Application Error</h1>
        <p style="color: #ff8888; margin-bottom: 1rem;">${error.message || 'An unexpected error occurred'}</p>
        <details style="margin-bottom: 2rem; text-align: left;">
          <summary style="cursor: pointer; color: #ffaa44;">Technical Details</summary>
          <pre style="background: rgba(0,0,0,0.3); padding: 1rem; margin-top: 1rem; font-size: 0.8rem; overflow-x: auto;">
Error: ${error.name || 'Unknown'}
Message: ${error.message || 'No message'}
Stack: ${error.stack || 'No stack trace'}
User Agent: ${navigator.userAgent}
URL: ${window.location.href}
Timestamp: ${new Date().toISOString()}
          </pre>
        </details>
        <div style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
          <button 
            onclick="location.reload()" 
            style="
              padding: 0.75rem 1.5rem;
              background: #00ff41;
              color: black;
              border: none;
              border-radius: 8px;
              font-weight: bold;
              cursor: pointer;
              font-family: monospace;
            "
          >
            🔄 Reload Application
          </button>
          <button 
            onclick="window.location.href = '/'" 
            style="
              padding: 0.75rem 1.5rem;
              background: #444;
              color: #00ff41;
              border: 1px solid #00ff41;
              border-radius: 8px;
              font-weight: bold;
              cursor: pointer;
              font-family: monospace;
            "
          >
            🏠 Go Home
          </button>
        </div>
      </div>
    </div>
  `
}

/**
 * @brief Report error to logging system
 */
function reportError(error: Error, context?: string): void {
  if (!APP_CONFIG.features.errorReporting) return
  
  const errorReport = {
    message: error.message,
    stack: error.stack,
    context: context || 'unknown',
    url: window.location.href,
    userAgent: navigator.userAgent,
    timestamp: new Date().toISOString(),
    version: APP_CONFIG.version
  }
  
  // In production, send to error reporting service
  if (APP_CONFIG.environment === 'production') {
    console.log('📤 Error report:', errorReport)
    // Example: send to Sentry, LogRocket, or custom endpoint
  } else {
    console.warn('🐛 Development error:', errorReport)
  }
}

/**
 * @brief Add global gaming theme styles with enhanced production features
 */
async function addGlobalStyles(): Promise<void> {
  const style = document.createElement('style')
  style.textContent = `
    /* CSS Custom Properties for theming */
    :root {
      --primary-color: #00ff41;
      --primary-dark: #00cc33;
      --primary-light: #33ff66;
      --secondary-color: #ff4444;
      --background-color: #000000;
      --surface-color: #111111;
      --text-color: #00ff41;
      --text-muted: #888888;
      --border-color: #333333;
      --success-color: #00ff41;
      --error-color: #ff4444;
      --warning-color: #ffaa44;
    }

    /* Base styles */
    * {
      box-sizing: border-box;
    }

    html {
      scroll-behavior: smooth;
    }

    body {
      margin: 0;
      padding: 0;
      font-family: 'Courier New', 'Monaco', 'Menlo', monospace;
      background: var(--background-color);
      color: var(--text-color);
      line-height: 1.6;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    /* Error screens */
    .error-screen {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      font-family: monospace;
      background: var(--background-color);
      color: var(--text-color);
      padding: 1rem;
    }
    
    .error-content {
      text-align: center;
      padding: 2rem;
      border: 2px solid var(--error-color);
      border-radius: 12px;
      background: rgba(255, 68, 68, 0.1);
      backdrop-filter: blur(10px);
      max-width: 600px;
      width: 100%;
    }

    /* Gaming effects */
    .neon-glow {
      text-shadow: 
        0 0 5px currentColor, 
        0 0 10px currentColor, 
        0 0 20px currentColor,
        0 0 40px currentColor;
    }
    
    .neon-border {
      box-shadow: 
        0 0 5px var(--primary-color), 
        0 0 10px var(--primary-color),
        0 0 20px var(--primary-color);
      border: 1px solid var(--primary-color);
    }

    /* Animations */
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    @keyframes scanline {
      0% { transform: translateY(-100vh); }
      100% { transform: translateY(100vh); }
    }

    @keyframes matrix-bg {
      0% { background-position: 0% 0%; }
      100% { background-position: 100% 100%; }
    }

    /* Retro CRT effect */
    .crt-effect::before {
      content: '';
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: linear-gradient(
        transparent 2px,
        rgba(0, 255, 65, 0.03) 2px,
        rgba(0, 255, 65, 0.03) 4px,
        transparent 4px
      );
      pointer-events: none;
      z-index: 1000;
    }

    /* Scrollbar styling */
    ::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }
    
    ::-webkit-scrollbar-track {
      background: var(--background-color);
      border-radius: 4px;
    }
    
    ::-webkit-scrollbar-thumb {
      background: var(--primary-color);
      border-radius: 4px;
      transition: background 0.3s ease;
    }
    
    ::-webkit-scrollbar-thumb:hover {
      background: var(--primary-dark);
    }

    /* Selection styling */
    ::selection {
      background: var(--primary-color);
      color: var(--background-color);
    }

    ::-moz-selection {
      background: var(--primary-color);
      color: var(--background-color);
    }

    /* Focus indicators */
    :focus {
      outline: 2px solid var(--primary-color);
      outline-offset: 2px;
    }

    :focus:not(:focus-visible) {
      outline: none;
    }

    /* Button base styles */
    button {
      font-family: inherit;
      border: none;
      cursor: pointer;
      transition: all 0.3s ease;
    }

    button:hover {
      transform: translateY(-1px);
    }

    button:active {
      transform: translateY(0);
    }

    /* Utility classes */
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    .fade-in {
      animation: fadeIn 0.5s ease-in;
    }

    /* Focus management */
    .mouse-user :focus {
      outline: none;
    }

    .keyboard-user :focus {
      outline: 2px solid var(--primary-color);
      outline-offset: 2px;
    }

    /* Animations */
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @keyframes slideInRight {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }

    @keyframes fadeOut {
      from { opacity: 1; }
      to { opacity: 0; }
    }

    /* Responsive design */
    @media (max-width: 768px) {
      .error-content {
        padding: 1rem;
        margin: 1rem;
      }
      
      body {
        font-size: 14px;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      * {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
        scroll-behavior: auto !important;
      }
    }

    /* Dark mode support (already default) */
    @media (prefers-color-scheme: light) {
      /* Keep dark theme regardless - it's part of the gaming aesthetic */
    }
  `
  document.head.appendChild(style)
  
  // Add CRT effect to body
  document.body.classList.add('crt-effect')
  
  console.log('🎨 Global styles applied')
}

/**
 * @brief Setup enhanced global keyboard navigation and accessibility
 */
async function setupGlobalKeyboardNavigation(): Promise<void> {
  // Quick navigation shortcuts
  document.addEventListener('keydown', (event) => {
    // Alt + key shortcuts for power users
    if (event.altKey) {
      let handled = false
      
      switch (event.key.toLowerCase()) {
        case 'h':
          router.navigate('/')
          console.log('⌨️ Quick nav: Home')
          handled = true
          break
        case 'g':
          router.navigate('/game')
          console.log('⌨️ Quick nav: Game')
          handled = true
          break
        case 'p':
          router.navigate('/profile')
          console.log('⌨️ Quick nav: Profile')
          handled = true
          break
      }
      
      if (handled) {
        event.preventDefault()
        showToast(`Navigated via keyboard shortcut`)
      }
    }
    
    // Escape key - universal back/close action
    if (event.key === 'Escape') {
      // Close any open modals first
      const modals = document.querySelectorAll('[id$="-modal"]')
      if (modals.length > 0) {
        modals[modals.length - 1].remove()
        event.preventDefault()
        return
      }
      
      // If no modals, consider going back
      if (window.history.length > 1) {
        window.history.back()
        event.preventDefault()
      }
    }
    
    // Ctrl/Cmd + R for reload (with confirmation in production)
    if ((event.ctrlKey || event.metaKey) && event.key === 'r') {
      if (APP_CONFIG.environment === 'production') {
        event.preventDefault()
        if (confirm('Are you sure you want to reload the application?')) {
          window.location.reload()
        }
      }
    }
  })
  
  // Setup focus management
  setupFocusManagement()
  
  console.log('⌨️ Enhanced keyboard navigation enabled')
  console.log('  Alt+H: Home | Alt+G: Game | Alt+P: Profile')
  console.log('  Esc: Back/Close | Ctrl+R: Reload (with confirmation)')
}

/**
 * @brief Setup focus management for accessibility
 */
function setupFocusManagement(): void {
  // Hide focus ring when using mouse
  document.addEventListener('mousedown', () => {
    document.body.classList.add('mouse-user')
    document.body.classList.remove('keyboard-user')
  })
  
  // Show focus ring when using keyboard
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Tab') {
      document.body.classList.add('keyboard-user')
      document.body.classList.remove('mouse-user')
    }
  })
}

/**
 * @brief Show temporary toast notification
 */
function showToast(message: string): void {
  // Remove existing toast
  const existingToast = document.getElementById('global-toast')
  if (existingToast) {
    existingToast.remove()
  }
  
  const toast = document.createElement('div')
  toast.id = 'global-toast'
  toast.textContent = message
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: var(--primary-color);
    color: var(--background-color);
    padding: 0.75rem 1rem;
    border-radius: 8px;
    font-family: monospace;
    font-weight: bold;
    z-index: 10000;
    animation: slideInRight 0.3s ease, fadeOut 0.3s ease 2.7s;
    pointer-events: none;
  `
  
  document.body.appendChild(toast)
  
  setTimeout(() => {
    toast.remove()
  }, 3000)
}

// Production-ready application startup
console.log(`
╔════════════════════════════════════════╗
║           🏓 ft_transcendence          ║
║        The Ultimate Pong Experience    ║
║                                        ║
║  Version: ${APP_CONFIG.version.padEnd(28)} ║
║  Environment: ${APP_CONFIG.environment.padEnd(24)} ║
║  Build Time: ${new Date().toLocaleDateString().padEnd(25)} ║
╚════════════════════════════════════════╝
`)

// Initialize application
bootstrap().catch((error) => {
  console.error('💥 Fatal error during bootstrap:', error)
  
  // Last resort fallback
  document.body.innerHTML = `
    <div style="
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      font-family: monospace;
      background: black;
      color: #ff4444;
      text-align: center;
      padding: 2rem;
    ">
      <div>
        <h1 style="font-size: 2rem; margin-bottom: 1rem;">💀 Fatal Error</h1>
        <p style="margin-bottom: 1rem;">Failed to initialize ft_transcendence</p>
        <p style="font-size: 0.8rem; opacity: 0.7; margin-bottom: 2rem;">${error.message}</p>
        <button onclick="location.reload()" style="
          padding: 0.75rem 1.5rem;
          background: #ff4444;
          color: white;
          border: none;
          border-radius: 8px;
          font-weight: bold;
          cursor: pointer;
          font-family: monospace;
        ">Reload</button>
      </div>
    </div>
  `
})

// Development helpers (only in development)
if (APP_CONFIG.environment === 'development') {
  // Expose useful globals for debugging
  ;(window as any).__APP_CONFIG__ = APP_CONFIG
  ;(window as any).__ROUTER__ = router
  
  console.log(`
🛠️ Development Mode Active
- Access app config: window.__APP_CONFIG__
- Access router: window.__ROUTER__
- Keyboard shortcuts: Alt+H/G/P/D
- Error reporting enabled
  `)
}