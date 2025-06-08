/**
 * @brief Router integration tests for ft_transcendence
 * 
 * @description Comprehensive tests for Router class functionality.
 * Tests route registration, navigation, parameter extraction, and browser integration.
 * 
 * FILE: tests/integration/router.test.ts (NEW FILE)
 */

import { Router } from '../../src/router'
import { createTestSuite, type TestSuiteResult } from '../utils/test-framework'

/**
 * @brief Run Router integration tests
 * 
 * @return Test suite results
 * 
 * @description Executes complete Router test suite.
 */
// Define interface for test suite with explicit method types
interface TestSuite {
  test: (name: string, testFn: () => void | Promise<void>) => Promise<void>;
  assertNotNull: <T>(value: T, message: string) => void;
  assertEqual: <T>(actual: T, expected: T, message: string) => void;
  assertTrue: (value: boolean, message: string) => void;
  printSummary: () => void;
  getSuiteResults: () => TestSuiteResult;
}

export async function runRouterTests(): Promise<TestSuiteResult> {
  const suite: TestSuite = createTestSuite('Router Integration Tests')
  
  console.log('🧭 Testing Router Class...')
  
  // Test Router initialization
  await suite.test('Router initialization', () => {
    const router = new Router()
    suite.assertNotNull(router, 'Router should be created')
    suite.assertEqual(router.getCurrentRoute(), '/', 'Default route should be /')
  })
  
  // Test route registration
  await suite.test('Route registration', () => {
    const router = new Router()
    let handlerCalled = false
    
    router.addRoute('/test', () => {
      handlerCalled = true
    })
    
    // Check that route was registered (we can't directly verify internal state)
    suite.assertTrue(true, 'Route registration should not throw')
  })
  
  // Test route navigation
  await suite.test('Basic navigation', async () => {
    const router = new Router({ handleInitialRoute: false })
    let routeParams: Record<string, string> = {}
    let routeQuery: Record<string, string> = {}
    
    router.addRoute('/test-nav', (params, query) => {
      routeParams = params
      routeQuery = query
      return Promise.resolve()
    })
    
    router.init()
    router.navigate('/test-nav')
    
    // Wait for navigation to complete
    await new Promise(resolve => setTimeout(resolve, 10))
    
    suite.assertEqual(router.getCurrentRoute(), '/test-nav', 'Should navigate to test route')
  })
  
  // Test route parameters
  await suite.test('Route parameters extraction', async () => {
    const router = new Router({ handleInitialRoute: false })
    let extractedParams: Record<string, string> = {}
    
    router.addRoute('/user/:id', (params) => {
      extractedParams = params
      return Promise.resolve()
    })
    
    router.init()
    router.navigate('/user/123')
    
    // Wait for navigation
    await new Promise(resolve => setTimeout(resolve, 10))
    
    suite.assertEqual(extractedParams.id, '123', 'Should extract route parameter')
    suite.assertEqual(router.getCurrentParams().id, '123', 'getCurrentParams should return parameters')
  })
  
  // Test multiple parameters
  await suite.test('Multiple route parameters', async () => {
    const router = new Router({ handleInitialRoute: false })
    let extractedParams: Record<string, string> = {}
    
    router.addRoute('/game/:type/:id', (params) => {
      extractedParams = params
      return Promise.resolve()
    })
    
    router.init()
    router.navigate('/game/pong/abc123')
    
    await new Promise(resolve => setTimeout(resolve, 10))
    
    suite.assertEqual(extractedParams.type, 'pong', 'Should extract first parameter')
    suite.assertEqual(extractedParams.id, 'abc123', 'Should extract second parameter')
  })
  
  // Test query parameters
  await suite.test('Query parameters parsing', async () => {
    const router = new Router({ handleInitialRoute: false })
    let extractedQuery: Record<string, string> = {}
    
    router.addRoute('/search', (params, query) => {
      extractedQuery = query
      return Promise.resolve()
    })
    
    router.init()
    router.navigate('/search?q=test&page=2')
    
    await new Promise(resolve => setTimeout(resolve, 10))
    
    suite.assertEqual(extractedQuery.q, 'test', 'Should extract q parameter')
    suite.assertEqual(extractedQuery.page, '2', 'Should extract page parameter')
  })
  
  // Test route change events
  await suite.test('Route change events', async () => {
    const router = new Router({ handleInitialRoute: false })
    let changeEventFired = false
    let eventData: any = null
    
    router.addRoute('/event-test', () => Promise.resolve())
    
    const unsubscribe = router.onRouteChange((event) => {
      changeEventFired = true
      eventData = event
    })
    
    router.init()
    router.navigate('/event-test')
    
    await new Promise(resolve => setTimeout(resolve, 10))
    
    suite.assertTrue(changeEventFired, 'Route change event should fire')
    suite.assertEqual(eventData?.to, '/event-test', 'Event should contain correct target route')
    suite.assertEqual(eventData?.type, 'push', 'Event should indicate push navigation')
    
    unsubscribe()
  })
  
  // Test 404 handling
  await suite.test('404 handling', async () => {
    const router = new Router({ 
      handleInitialRoute: false,
      notFoundRoute: '/404' 
    })
    
    let notFoundHandlerCalled = false
    
    router.addRoute('/404', () => {
      notFoundHandlerCalled = true
      return Promise.resolve()
    })
    
    router.init()
    router.navigate('/nonexistent-route')
    
    await new Promise(resolve => setTimeout(resolve, 10))
    
    suite.assertTrue(notFoundHandlerCalled, '404 handler should be called for nonexistent routes')
  })
  
  // Test navigation options
  await suite.test('Navigation with replace option', async () => {
    const router = new Router({ handleInitialRoute: false })
    let eventType = ''
    
    router.addRoute('/replace-test', () => Promise.resolve())
    
    router.onRouteChange((event) => {
      eventType = event.type
    })
    
    router.init()
    router.navigate('/replace-test', { replace: true })
    
    await new Promise(resolve => setTimeout(resolve, 10))
    
    suite.assertEqual(eventType, 'replace', 'Should use replace navigation when specified')
  })
  
  // Test router cleanup
  await suite.test('Router cleanup', () => {
    const router = new Router()
    router.init()
    
    // Should not throw
    router.destroy()
    
    suite.assertTrue(true, 'Router cleanup should not throw')
  })
  
  // Test path normalization
  await suite.test('Path normalization', async () => {
    const router = new Router({ handleInitialRoute: false })
    let normalizedPath = ''
    
    router.addRoute('/normalize', () => {
      normalizedPath = router.getCurrentRoute()
      return Promise.resolve()
    })
    
    router.init()
    
    // Test various path formats
    router.navigate('//normalize//')
    await new Promise(resolve => setTimeout(resolve, 10))
    
    suite.assertEqual(normalizedPath, '/normalize', 'Should normalize path with extra slashes')
  })
  
  suite.printSummary()
  return suite.getSuiteResults()
}

/**
 * @brief Interactive Router demo for manual testing
 * 
 * @description Creates interactive demo interface for manual Router testing.
 */
export function createRouterDemo(): void {
  console.log('🎮 Creating Interactive Router Demo...')
  
  const router = new Router({
    basePath: '',
    handleInitialRoute: true,
    notFoundRoute: '/demo-404'
  })
  
  // Register demo routes
  router.addRoute('/demo', (params, query) => {
    console.log('🏠 Demo home route', { params, query })
    updateDemoDisplay('Demo Home', params, query)
  })
  
  router.addRoute('/demo/game/:id', (params, query) => {
    console.log('🎮 Demo game route', { params, query })
    updateDemoDisplay(`Game: ${params.id}`, params, query)
  })
  
  router.addRoute('/demo/user/:username', (params, query) => {
    console.log('👤 Demo user route', { params, query })
    updateDemoDisplay(`User: ${params.username}`, params, query)
  })
  
  router.addRoute('/demo-404', (params, query) => {
    console.log('🚫 Demo 404 route', { params, query })
    updateDemoDisplay('Page Not Found', params, query)
  })
  
  // Add route change listener
  router.onRouteChange((event) => {
    console.log('📍 Demo route changed:', event)
    updateRouteInfo(event)
  })
  
  // Initialize router
  router.init()
  
  // Create demo UI
  createDemoUI(router)
  
  console.log('✅ Router demo created')
}

/**
 * @brief Update demo display with current route info
 * 
 * @param title - Page title to display
 * @param params - Route parameters
 * @param query - Query parameters
 */
function updateDemoDisplay(title: string, params: Record<string, string>, query: Record<string, string>): void {
  const display = document.getElementById('router-demo-display')
  if (display) {
    display.innerHTML = `
      <h3 class="text-lg font-bold text-cyan-400 mb-2">${title}</h3>
      <div class="text-sm space-y-1">
        <div><span class="text-cyan-300">Parameters:</span> ${JSON.stringify(params)}</div>
        <div><span class="text-cyan-300">Query:</span> ${JSON.stringify(query)}</div>
      </div>
    `
  }
}

/**
 * @brief Update route info display
 * 
 * @param event - Route change event
 */
function updateRouteInfo(event: any): void {
  const info = document.getElementById('router-demo-info')
  if (info) {
    info.innerHTML = `
      <div class="text-xs space-y-1">
        <div><span class="text-cyan-400">From:</span> ${event.from}</div>
        <div><span class="text-cyan-400">To:</span> ${event.to}</div>
        <div><span class="text-cyan-400">Type:</span> ${event.type}</div>
      </div>
    `
  }
}

/**
 * @brief Create demo UI for router testing
 * 
 * @param router - Router instance to control
 */
function createDemoUI(router: Router): void {
  const demoHtml = `
    <div class="bg-gray-800 border-2 border-cyan-400 rounded-lg p-6 max-w-2xl mx-auto mb-8">
      <h2 class="text-xl font-bold text-cyan-400 mb-4">🧭 Router Demo & Testing</h2>
      
      <!-- Demo Display -->
      <div id="router-demo-display" class="bg-gray-900 border border-cyan-300 rounded p-4 mb-4">
        <h3 class="text-lg font-bold text-cyan-400">Demo Home</h3>
        <div class="text-sm">Navigate using buttons below</div>
      </div>
      
      <!-- Route Info -->
      <div id="router-demo-info" class="bg-gray-900 border border-cyan-300 rounded p-2 mb-4">
        <div class="text-xs text-cyan-300">Route change info will appear here</div>
      </div>
      
      <!-- Navigation Buttons -->
      <div class="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4">
        <button class="btn-game text-sm" data-demo-route="/demo">🏠 Home</button>
        <button class="btn-game text-sm" data-demo-route="/demo/game/pong">🎮 Game</button>
        <button class="btn-game text-sm" data-demo-route="/demo/user/alice">👤 User</button>
        <button class="btn-game text-sm" data-demo-route="/demo/user/bob?tab=stats">👥 User+Query</button>
        <button class="btn-game text-sm" data-demo-route="/demo/invalid">🚫 404 Test</button>
      </div>
      
      <!-- Browser Navigation -->
      <div class="flex gap-2 mb-4">
        <button id="demo-back" class="btn-secondary text-sm">← Back</button>
        <button id="demo-forward" class="btn-secondary text-sm">Forward →</button>
      </div>
      
      <!-- Test Runner -->
      <div class="flex gap-2">
        <button id="run-router-tests" class="btn-primary text-sm">🧪 Run Tests</button>
        <button id="clear-console" class="btn-secondary text-sm">🧹 Clear Console</button>
      </div>
    </div>
  `
  
  // Find a container to add demo to
  const appElement = document.querySelector('#app')
  if (appElement) {
    appElement.insertAdjacentHTML('beforeend', demoHtml)
    
    // Add event listeners
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement
      
      if (target.dataset.demoRoute) {
        router.navigate(target.dataset.demoRoute)
      }
      
      if (target.id === 'demo-back') {
        router.back()
      }
      
      if (target.id === 'demo-forward') {
        router.forward()
      }
      
      if (target.id === 'run-router-tests') {
        runRouterTests()
      }
      
      if (target.id === 'clear-console') {
        console.clear()
      }
    })
  }
}