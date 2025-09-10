/**
 * @brief Route configurations for ft_transcendence
 * 
 * @description Route setup with page component integration.
 * Phase 3.2 implementation - Pages connected to router.
 */

import { Router } from './router'
import { HomePage } from '../pages/home/HomePage'
import { GamePage } from '../pages/game/GamePage'
import { ProfilePage } from '../pages/profile/ProfilePage'

// Global page container reference
let currentPageComponent: any = null

/**
 * @brief Get or create app container element
 */
function getAppContainer(): HTMLElement {
  let container = document.getElementById('app')
  if (!container) {
    container = document.createElement('div')
    container.id = 'app'
    document.body.appendChild(container)
  }
  return container
}

/**
 * @brief Load page component and mount it
 * 
 * @param ComponentClass - Page component class to instantiate
 * @param props - Props to pass to component
 */
function loadPage(ComponentClass: any, props: any = {}): void {
  const container = getAppContainer()
  
  // Cleanup previous component
  if (currentPageComponent && typeof currentPageComponent.unmount === 'function') {
    currentPageComponent.unmount()
  }
  
  // Create and mount new component
  currentPageComponent = new ComponentClass(props)
  container.innerHTML = currentPageComponent.render()
  
  // Mount component for event handling
  if (typeof currentPageComponent.mount === 'function') {
    currentPageComponent.mount(container)
  }
  
  console.log(`📄 Page loaded: ${ComponentClass.name}`)
}

/**
 * @brief Configure routes with page components
 * 
 * @param router - Router instance to configure
 */
export function configureRoutes(router: Router): void {
  // Public routes
  router.register('/', async () => {
    console.log('🏠 Loading HomePage')
    loadPage(HomePage)
    document.title = 'ft_transcendence - Home'
  })

  router.register('/login', async () => {
    console.log('🔓 Loading Login page')
    const container = getAppContainer()
    
    // Simple test login interface
    container.innerHTML = `
      <div class="min-h-screen bg-black text-green-400 font-mono flex items-center justify-center">
        <div class="text-center p-8 border border-green-600 rounded-lg bg-green-900/10">
          <h1 class="text-4xl font-bold mb-6 neon-glow">🔓 Test Login</h1>
          <p class="text-green-500 mb-8">Simple authentication for testing Phase 3</p>
          
          <div class="space-y-4 mb-8">
            <button 
              id="test-login-btn"
              class="w-full px-6 py-3 bg-green-600 hover:bg-green-500 text-black font-bold rounded-lg transition-all transform hover:scale-105"
            >
              ✅ Enable Test Auth
            </button>
            
            <button 
              id="test-logout-btn"
              class="w-full px-6 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg transition-all transform hover:scale-105"
            >
              ❌ Disable Test Auth
            </button>
          </div>
          
          <p class="text-green-600 text-sm mb-4">Current status: <span id="auth-status">Checking...</span></p>
          
          <button 
            onclick="import('./router').then(({router}) => router.navigate('/'))" 
            class="px-6 py-3 bg-gray-600 hover:bg-gray-500 text-white font-bold rounded-lg transition-colors"
          >
            🏠 Back to Home
          </button>
        </div>
      </div>
    `
    
    // Update auth status display
    function updateAuthStatus() {
      const statusEl = document.getElementById('auth-status')
      const isAuth = localStorage.getItem('ft_test_auth') === 'true'
      if (statusEl) {
        statusEl.textContent = isAuth ? '🟢 Authenticated' : '🔴 Not Authenticated'
        statusEl.className = isAuth ? 'text-green-400 font-bold' : 'text-red-400 font-bold'
      }
    }
    
    // Initial status update
    updateAuthStatus()
    
    // Add event listeners
    const loginBtn = document.getElementById('test-login-btn')
    const logoutBtn = document.getElementById('test-logout-btn')
    
    if (loginBtn) {
      loginBtn.addEventListener('click', () => {
        localStorage.setItem('ft_test_auth', 'true')
        updateAuthStatus()
        console.log('✅ Test authentication enabled')
        
        // Show success feedback
        loginBtn.textContent = '✅ Auth Enabled!'
        setTimeout(() => {
          loginBtn.textContent = '✅ Enable Test Auth'
        }, 2000)
      })
    }
    
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('ft_test_auth')
        updateAuthStatus()
        console.log('❌ Test authentication disabled')
        
        // Show success feedback
        logoutBtn.textContent = '❌ Auth Disabled!'
        setTimeout(() => {
          logoutBtn.textContent = '❌ Disable Test Auth'
        }, 2000)
      })
    }
    
    document.title = 'Test Login - ft_transcendence'
  })

  // Protected routes (simple auth requirement)
  router.register('/game', async () => {
    console.log('🎮 Loading GamePage')
    loadPage(GamePage, { mode: 'lobby' })
    document.title = 'Game Lobby - ft_transcendence'
  }, { 
    requiresAuth: true,
    redirect: '/login'
  })

  router.register('/profile', async () => {
    console.log('👤 Loading ProfilePage')
    loadPage(ProfilePage)
    document.title = 'Profile - ft_transcendence'
  }, { 
    requiresAuth: true,
    redirect: '/login'
  })

  router.register('/game/:id', async (params) => {
    console.log('🎮 Loading GamePage with ID:', params.id)
    loadPage(GamePage, { mode: 'playing', gameId: params.id })
    document.title = 'Playing Pong - ft_transcendence'
  }, { 
    requiresAuth: true,
    redirect: '/login'
  })

  // 404 fallback
  router.register('/404', async () => {
    console.log('❌ Loading 404 page')
    const container = getAppContainer()
    container.innerHTML = `
      <div class="min-h-screen bg-black text-green-400 font-mono flex items-center justify-center">
        <div class="text-center">
          <div class="text-6xl mb-6">🚫</div>
          <h1 class="text-4xl font-bold mb-6">Page Not Found</h1>
          <p class="text-green-500 mb-8">The page you're looking for doesn't exist.</p>
          <button onclick="import('./router').then(({router}) => router.navigate('/'))" class="px-6 py-3 bg-green-600 hover:bg-green-500 text-black font-bold rounded-lg transition-colors">
            🏠 Back to Home
          </button>
        </div>
      </div>
    `
    document.title = 'Page Not Found - ft_transcendence'
  })

  console.log('✅ Routes configured with page components')
}