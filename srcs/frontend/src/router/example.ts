/**
 * @brief Router integration example for Phase 3
 * 
 * @description Shows how to use the router with page components
 * following Phase 3.2 implementation.
 */

import { router } from './router'
import { configureRoutes } from './routes'

/**
 * @brief Initialize the application router with page integration
 * 
 * @description Complete setup for Phase 3.2 - Pages connected to router
 */
export function initializeApp(): void {
  console.log('🚀 Phase 3: Initializing app with page components...')

  // Configure routes with page components
  configureRoutes(router)

  // Add route change listener for enhanced navigation feedback
  router.addListener((event) => {
    console.log(`🧭 Route changed: ${event.from} → ${event.to}`)
    
    // Add navigation effects
    addNavigationEffects(event.to)
  })

  // Start the router
  router.start()

  console.log('✅ Phase 3: App initialized with integrated routing!')
}

/**
 * @brief Navigation helper functions for Phase 3
 * 
 * @description Clean API for programmatic navigation
 */
export const navigation = {
  
  /** Navigate to home page */
  goHome: () => {
    console.log('🏠 Navigating to HomePage')
    router.navigate('/')
  },
  
  /** Navigate to login page */
  goLogin: () => {
    console.log('🔓 Navigating to Login')
    router.navigate('/login')
  },
  
  /** Navigate to game lobby */
  goGame: () => {
    console.log('🎮 Navigating to GamePage')
    router.navigate('/game')
  },
  
  /** Navigate to user profile */
  goProfile: () => {
    console.log('👤 Navigating to ProfilePage')
    router.navigate('/profile')
  },
  
  /** Navigate to specific game by ID */
  goGameById: (gameId: string) => {
    console.log(`🎮 Navigating to Game: ${gameId}`)
    router.navigate(`/game/${gameId}`)
  },
  
  /** Navigate and replace current history entry */
  redirectTo: (path: string) => {
    console.log(`🔄 Redirecting to: ${path}`)
    router.navigate(path, { replace: true })
  }
}

/**
 * @brief Add visual effects during navigation
 * 
 * @param path - Target path being navigated to
 */
function addNavigationEffects(path: string): void {
  // Add loading effect to body
  document.body.style.transition = 'opacity 0.2s ease'
  document.body.style.opacity = '0.8'
  
  // Remove effect after short delay
  setTimeout(() => {
    document.body.style.opacity = '1'
  }, 100)
  
  // Update URL info in console
  console.log(`📍 Current location: ${path}`)
}

/**
 * @brief Get current route information
 */
export function getCurrentRouteInfo() {
  const currentPath = router.getCurrentPath()
  
  return {
    path: currentPath,
    isHome: currentPath === '/',
    isGame: currentPath.startsWith('/game'),
    isProfile: currentPath === '/profile',
    timestamp: new Date().toISOString()
  }
}

/**
 * @brief Test all routes (for development)
 */
export function testAllRoutes(): void {
  console.log('🧪 Testing all Phase 3 routes...')
  
  const routes = ['/', '/game', '/profile', '/game/test123', '/404']
  let index = 0
  
  const testNext = () => {
    if (index < routes.length) {
      const route = routes[index]
      console.log(`Testing route ${index + 1}/${routes.length}: ${route}`)
      router.navigate(route)
      index++
      setTimeout(testNext, 2000) // Wait 2 seconds between tests
    } else {
      console.log('✅ All routes tested! Returning to home...')
      router.navigate('/')
    }
  }
  
  testNext()
}
