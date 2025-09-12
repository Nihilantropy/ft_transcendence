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
import { LoginPage } from '../pages/auth/LoginPage'

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
 * @brief Add navigation event listeners to container
 * 
 * @param container - Container element to add listeners to
 */
function addNavigationListeners(container: HTMLElement): void {
  const navButtons = container.querySelectorAll('[data-navigate]')
  navButtons.forEach(button => {
    button.addEventListener('click', (event) => {
      event.preventDefault()
      const path = button.getAttribute('data-navigate')
      if (path) {
        import('./router').then(({ router }) => {
          router.navigate(path)
        }).catch(error => {
          console.error('Navigation failed:', error)
        })
      }
    })
  })
}

/**
 * @brief Load page component and mount it properly
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
  
  // Clear container first
  container.innerHTML = ''
  
  // Create and properly mount new component
  currentPageComponent = new ComponentClass(props)
  
  // Use the component's mount method instead of manual innerHTML
  if (typeof currentPageComponent.mount === 'function') {
    currentPageComponent.mount(container)
  } else {
    // Fallback for components without mount method
    container.innerHTML = currentPageComponent.render()
    // Add navigation listeners for components without mount method
    addNavigationListeners(container)
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
    loadPage(LoginPage, { mode: 'login' })
    document.title = 'Login - ft_transcendence'
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

  router.register('/game/play', async () => {
    console.log('🎮 Loading GamePage in play mode')
    loadPage(GamePage, { mode: 'playing' })
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
          <button data-navigate="/" class="px-6 py-3 bg-green-600 hover:bg-green-500 text-black font-bold rounded-lg transition-colors">
            🏠 Back to Home
          </button>
        </div>
      </div>
    `
    
    // Add navigation listeners
    addNavigationListeners(container)
    
    document.title = 'Page Not Found - ft_transcendence'
  })

  console.log('✅ Routes configured with page components')
}