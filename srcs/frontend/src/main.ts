/**
 * @brief Main application entry point for ft_transcendence
 * 
 * @description Production implementation - Application with integrated page routing.
 * Sets up core systems and page components.
 */

import './index.css'
import { router } from './router/router'
import { configureRoutes } from './router/routes'

/**
 * @brief Bootstrap ft_transcendence application
 * 
 * @description Initialize core systems in order:
 * 1. Router with page components
 * 2. Navigation system
 * 3. Initial page rendering
 */
async function bootstrap(): Promise<void> {
  try {
    console.log('🚀 Starting ft_transcendence')

    // Configure routes with page components
    configureRoutes(router)

    // Start the router
    router.start()

    // Add global styles for gaming theme
    addGlobalStyles()

    // Setup global keyboard navigation
    setupGlobalKeyboardNavigation()

    console.log('✅ ft_transcendence initialized successfully')
    console.log('📋 Available routes: /, /game, /profile')
    
  } catch (error) {
    console.error('🚨 Failed to initialize application:', error)
    
    // Show fallback error message
    document.body.innerHTML = `
      <div class="error-screen">
        <div class="error-content">
          <div style="font-size: 4rem; margin-bottom: 1rem;">💀</div>
          <h1 style="color: #ff4444; font-size: 2rem; margin-bottom: 1rem;">Application Error</h1>
          <p style="color: #ff8888; margin-bottom: 2rem;">Failed to load ft_transcendence. Please refresh the page.</p>
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
        </div>
      </div>
    `
  }
}

/**
 * @brief Add global gaming theme styles
 */
function addGlobalStyles(): void {
  const style = document.createElement('style')
  style.textContent = `
    .error-screen {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      font-family: monospace;
      background: black;
      color: #00ff41;
    }
    
    .error-content {
      text-align: center;
      padding: 2rem;
      border: 2px solid #ff4444;
      border-radius: 8px;
      background: rgba(255, 68, 68, 0.1);
    }
    
    .neon-glow {
      text-shadow: 0 0 10px currentColor, 0 0 20px currentColor, 0 0 30px currentColor;
    }
    
    .neon-border {
      box-shadow: 0 0 10px currentColor, 0 0 20px currentColor;
    }
    
    /* Scrollbar styling for gaming theme */
    ::-webkit-scrollbar {
      width: 8px;
    }
    
    ::-webkit-scrollbar-track {
      background: #000;
    }
    
    ::-webkit-scrollbar-thumb {
      background: #00ff41;
      border-radius: 4px;
    }
    
    ::-webkit-scrollbar-thumb:hover {
      background: #00cc33;
    }
  `
  document.head.appendChild(style)
}

/**
 * @brief Setup global keyboard navigation
 */
function setupGlobalKeyboardNavigation(): void {
  document.addEventListener('keydown', (event) => {
    // Quick navigation shortcuts (for development/testing)
    if (event.altKey) {
      switch (event.key) {
        case 'h':
          event.preventDefault()
          router.navigate('/')
          console.log('⌨️ Quick nav: Home')
          break
        case 'g':
          event.preventDefault()
          router.navigate('/game')
          console.log('⌨️ Quick nav: Game')
          break
        case 'p':
          event.preventDefault()
          router.navigate('/profile')
          console.log('⌨️ Quick nav: Profile')
          break
      }
    }
  })
  
  console.log('⌨️ Global keyboard navigation enabled (Alt+H/G/P)')
}

// Start application
console.log('🎮 Initializing ft_transcendence frontend...')
bootstrap()