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
    console.log('🔓 Loading Login page (placeholder)')
    // TODO Phase 4: Create LoginPage component
    const container = getAppContainer()
    container.innerHTML = `
      <div class="min-h-screen bg-black text-green-400 font-mono flex items-center justify-center">
        <div class="text-center">
          <h1 class="text-4xl font-bold mb-6">🔓 Login</h1>
          <p class="text-green-500 mb-8">Login functionality coming in Phase 4</p>
          <button onclick="window.location.href='/'" class="px-6 py-3 bg-green-600 hover:bg-green-500 text-black font-bold rounded-lg transition-colors">
            🏠 Back to Home
          </button>
        </div>
      </div>
    `
    document.title = 'Login - ft_transcendence'
  })

  // Protected routes (simple auth requirement)
  router.register('/game', async () => {
    console.log('🎮 Loading GamePage')
    loadPage(GamePage, { mode: 'lobby' })
    document.title = 'Game Lobby - ft_transcendence'
  }, { 
    requiresAuth: false, // Temporarily disabled for testing
    redirect: '/login'
  })

  router.register('/profile', async () => {
    console.log('👤 Loading ProfilePage')
    loadPage(ProfilePage)
    document.title = 'Profile - ft_transcendence'
  }, { 
    requiresAuth: false, // Temporarily disabled for testing
    redirect: '/login'
  })

  router.register('/game/:id', async (params) => {
    console.log('🎮 Loading GamePage with ID:', params.id)
    loadPage(GamePage, { mode: 'playing', gameId: params.id })
    document.title = 'Playing Pong - ft_transcendence'
  }, { 
    requiresAuth: false, // Temporarily disabled for testing
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
          <button onclick="window.location.href='/'" class="px-6 py-3 bg-green-600 hover:bg-green-500 text-black font-bold rounded-lg transition-colors">
            🏠 Back to Home
          </button>
        </div>
      </div>
    `
    document.title = 'Page Not Found - ft_transcendence'
  })

  console.log('✅ Routes configured with page components')
}