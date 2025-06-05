/**
 * @brief Basic unit tests for ft_transcendence stores
 * 
 * @description Simple test suite validating core functionality of all store implementations.
 * Tests initialization, state mutations, subscriptions, and cleanup.
 * 
 * Phase B2.2 - Basic testing for store implementations.
 */

import { AuthStore } from '../auth.store'
import { GameStore } from '../game.store'
import { UIStore } from '../ui.store'
import { AppStore } from '../app.store'
import type { AuthUser, GameSession } from '../../types/store.types'

/**
 * @brief Test runner interface
 * 
 * @description Simple test framework for store validation.
 */
interface TestResult {
  name: string
  passed: boolean
  error?: string
}

/**
 * @brief Basic test framework
 * 
 * @description Simple assertion and test running utilities.
 */
class SimpleTestFramework {
  private results: TestResult[] = []

  /**
   * @brief Run a test
   * 
   * @param name - Test name
   * @param testFn - Test function
   * 
   * @description Executes test and captures results.
   */
  test(name: string, testFn: () => void): void {
    try {
      testFn()
      this.results.push({ name, passed: true })
      console.log(`✅ ${name}`)
    } catch (error) {
      this.results.push({ 
        name, 
        passed: false, 
        error: error instanceof Error ? error.message : String(error)
      })
      console.log(`❌ ${name}: ${error}`)
    }
  }

  /**
   * @brief Assert equality
   * 
   * @param actual - Actual value
   * @param expected - Expected value
   * @param message - Optional error message
   * 
   * @description Basic equality assertion.
   */
  assertEqual<T>(actual: T, expected: T, message?: string): void {
    if (actual !== expected) {
      throw new Error(message || `Expected ${expected}, got ${actual}`)
    }
  }

  /**
   * @brief Assert truthiness
   * 
   * @param value - Value to check
   * @param message - Optional error message
   * 
   * @description Basic truthiness assertion.
   */
  assertTrue(value: any, message?: string): void {
    if (!value) {
      throw new Error(message || `Expected truthy value, got ${value}`)
    }
  }

  /**
   * @brief Assert falsiness
   * 
   * @param value - Value to check
   * @param message - Optional error message
   * 
   * @description Basic falsiness assertion.
   */
  assertFalse(value: any, message?: string): void {
    if (value) {
      throw new Error(message || `Expected falsy value, got ${value}`)
    }
  }

  /**
   * @brief Assert not null
   * 
   * @param value - Value to check
   * @param message - Optional error message
   * 
   * @description Assert value is not null or undefined.
   */
  assertNotNull<T>(value: T, message?: string): asserts value is NonNullable<T> {
    if (value === null || value === undefined) {
      throw new Error(message || `Expected non-null value, got ${value}`)
    }
  }

  /**
   * @brief Get test summary
   * 
   * @return Test results summary
   * 
   * @description Returns overall test results.
   */
  getSummary(): { total: number; passed: number; failed: number } {
    const total = this.results.length
    const passed = this.results.filter(r => r.passed).length
    const failed = total - passed
    
    return { total, passed, failed }
  }
}

/**
 * @brief Test AuthStore functionality
 * 
 * @param test - Test framework instance
 * 
 * @description Tests authentication store core features.
 */
function testAuthStore(test: SimpleTestFramework): void {
  console.log('\n--- Testing AuthStore ---')

  test.test('AuthStore initializes with correct default state', () => {
    const store = new AuthStore()
    const state = store.getState()
    
    test.assertFalse(state.isAuthenticated)
    test.assertEqual(state.user, null)
    test.assertEqual(state.token, null)
    test.assertFalse(state.loading)
    test.assertEqual(state.error, null)
  })

  test.test('AuthStore login updates state correctly', () => {
    const store = new AuthStore()
    
    const mockUser: AuthUser = {
      id: 'user1',
      username: 'testuser',
      email: 'test@example.com',
      displayName: 'Test User',
      createdAt: new Date(),
      lastSeen: new Date()
    }
    
    store.login(mockUser, 'fake-token', 3600)
    const state = store.getState()
    
    test.assertTrue(state.isAuthenticated)
    test.assertNotNull(state.user)
    test.assertEqual(state.user.username, 'testuser')
    test.assertEqual(state.token, 'fake-token')
    test.assertNotNull(state.expiresAt)
  })

  test.test('AuthStore logout clears state correctly', () => {
    const store = new AuthStore()
    
    // First login
    const mockUser: AuthUser = {
      id: 'user1',
      username: 'testuser',
      email: 'test@example.com',
      displayName: 'Test User',
      createdAt: new Date(),
      lastSeen: new Date()
    }
    
    store.login(mockUser, 'fake-token', 3600)
    
    // Then logout
    store.logout()
    const state = store.getState()
    
    test.assertFalse(state.isAuthenticated)
    test.assertEqual(state.user, null)
    test.assertEqual(state.token, null)
    test.assertEqual(state.expiresAt, null)
  })

  test.test('AuthStore subscription notifies on state changes', () => {
    const store = new AuthStore()
    let notificationCount = 0
    
    const unsubscribe = store.subscribe(() => {
      notificationCount++
    })
    
    store.setLoading(true)
    store.setLoading(false)
    
    test.assertTrue(notificationCount >= 2, 'Should receive multiple notifications')
    
    // Cleanup
    unsubscribe()
  })
}

/**
 * @brief Test GameStore functionality
 * 
 * @param test - Test framework instance
 * 
 * @description Tests game store core features.
 */
function testGameStore(test: SimpleTestFramework): void {
  console.log('\n--- Testing GameStore ---')

  test.test('GameStore initializes with correct default state', () => {
    const store = new GameStore()
    const state = store.getState()
    
    test.assertEqual(state.currentGame, null)
    test.assertEqual(state.gameMode, 'singleplayer')
    test.assertFalse(state.isPlaying)
    test.assertEqual(state.status, 'idle')
    test.assertFalse(state.loading)
  })

  test.test('GameStore setGameMode updates mode correctly', () => {
    const store = new GameStore()
    
    store.setGameMode('multiplayer')
    const state = store.getState()
    
    test.assertEqual(state.gameMode, 'multiplayer')
    test.assertEqual(state.status, 'idle')
  })

  test.test('GameStore createGame sets up game session', () => {
    const store = new GameStore()
    
    const mockGame: GameSession = {
      id: 'game1',
      type: 'classic',
      players: [],
      score: { player1: 0, player2: 0, maxScore: 11 },
      settings: { ballSpeed: 1, paddleSpeed: 1, powerUpsEnabled: false, difficulty: 'medium' },
      startedAt: new Date()
    }
    
    store.createGame(mockGame)
    const state = store.getState()
    
    test.assertNotNull(state.currentGame)
    test.assertEqual(state.currentGame?.id, 'game1')
    test.assertEqual(state.status, 'waiting')
  })

  test.test('GameStore startGame transitions to playing', () => {
    const store = new GameStore()
    
    const mockGame: GameSession = {
      id: 'game1',
      type: 'classic',
      players: [],
      score: { player1: 0, player2: 0, maxScore: 11 },
      settings: { ballSpeed: 1, paddleSpeed: 1, powerUpsEnabled: false, difficulty: 'medium' },
      startedAt: new Date()
    }
    
    store.createGame(mockGame)
    store.startGame()
    const state = store.getState()
    
    test.assertTrue(state.isPlaying)
    test.assertEqual(state.status, 'playing')
  })

  test.test('GameStore updateScore modifies game score', () => {
    const store = new GameStore()
    
    const mockGame: GameSession = {
      id: 'game1',
      type: 'classic',
      players: [],
      score: { player1: 0, player2: 0, maxScore: 11 },
      settings: { ballSpeed: 1, paddleSpeed: 1, powerUpsEnabled: false, difficulty: 'medium' },
      startedAt: new Date()
    }
    
    store.createGame(mockGame)
    store.updateScore({ player1: 2, player2: 1, maxScore: 11 })
    
    const currentGame = store.getCurrentGame()
    test.assertNotNull(currentGame)
    test.assertEqual(currentGame.score.player1, 2)
    test.assertEqual(currentGame.score.player2, 1)
  })
}

/**
 * @brief Test UIStore functionality
 * 
 * @param test - Test framework instance
 * 
 * @description Tests UI store core features.
 */
function testUIStore(test: SimpleTestFramework): void {
  console.log('\n--- Testing UIStore ---')

  test.test('UIStore initializes with responsive state', () => {
    const store = new UIStore()
    const state = store.getState()
    
    test.assertFalse(state.sidebarOpen)
    test.assertEqual(state.activeModal, null)
    test.assertEqual(state.notifications.length, 0)
    test.assertEqual(state.theme, 'dark')
  })

  test.test('UIStore toggleSidebar changes sidebar state', () => {
    const store = new UIStore()
    
    test.assertFalse(store.getState().sidebarOpen)
    
    store.toggleSidebar()
    test.assertTrue(store.getState().sidebarOpen)
    
    store.toggleSidebar()
    test.assertFalse(store.getState().sidebarOpen)
  })

  test.test('UIStore openModal sets active modal', () => {
    const store = new UIStore()
    
    store.openModal('test-modal')
    test.assertEqual(store.getState().activeModal, 'test-modal')
    
    store.closeModal()
    test.assertEqual(store.getState().activeModal, null)
  })

  test.test('UIStore addNotification creates notification', () => {
    const store = new UIStore()
    
    const notificationId = store.addNotification('info', 'Test', 'Test message', false)
    const state = store.getState()
    
    test.assertEqual(state.notifications.length, 1)
    test.assertEqual(state.notifications[0].title, 'Test')
    test.assertEqual(state.notifications[0].type, 'info')
    
    store.removeNotification(notificationId)
    test.assertEqual(store.getState().notifications.length, 0)
  })

  test.test('UIStore setTheme updates theme preference', () => {
    const store = new UIStore()
    
    store.setTheme('light')
    test.assertEqual(store.getState().theme, 'light')
    
    store.setTheme('dark')
    test.assertEqual(store.getState().theme, 'dark')
  })
}

/**
 * @brief Test AppStore functionality
 * 
 * @param test - Test framework instance
 * 
 * @description Tests application store core features.
 */
function testAppStore(test: SimpleTestFramework): void {
  console.log('\n--- Testing AppStore ---')

  test.test('AppStore initializes with correct default state', () => {
    const store = new AppStore()
    const state = store.getState()
    
    test.assertEqual(state.theme, 'dark')
    test.assertFalse(state.loading)
    test.assertEqual(state.error, null)
    test.assertFalse(state.initialized)
  })

  test.test('AppStore setLoading updates loading state', () => {
    const store = new AppStore()
    
    store.setLoading(true)
    test.assertTrue(store.getState().loading)
    
    store.setLoading(false)
    test.assertFalse(store.getState().loading)
  })

  test.test('AppStore setError updates error state', () => {
    const store = new AppStore()
    
    store.setError('Test error')
    const state = store.getState()
    
    test.assertEqual(state.error, 'Test error')
    test.assertFalse(state.loading) // Should stop loading on error
    
    store.clearError()
    test.assertEqual(store.getState().error, null)
  })

  test.test('AppStore setInitialized marks app as ready', () => {
    const store = new AppStore()
    
    test.assertFalse(store.isReady())
    
    store.setInitialized()
    test.assertTrue(store.isReady())
    test.assertTrue(store.getState().initialized)
  })

  test.test('AppStore resetApplication clears state', () => {
    const store = new AppStore()
    
    store.setLoading(true)
    store.setError('Some error')
    store.setInitialized()
    
    store.resetApplication()
    const state = store.getState()
    
    test.assertFalse(state.loading)
    test.assertEqual(state.error, null)
    test.assertFalse(state.initialized)
  })
}

/**
 * @brief Run all store tests
 * 
 * @description Executes complete test suite for all stores.
 */
export function runStoreTests(): void {
  console.log('🧪 Running Store Tests...')
  
  const test = new SimpleTestFramework()
  
  // Run all tests
  testAuthStore(test)
  testGameStore(test)
  testUIStore(test)
  testAppStore(test)
  
  // Print summary
  const summary = test.getSummary()
  console.log(`\n📊 Test Summary:`)
  console.log(`Total: ${summary.total}`)
  console.log(`✅ Passed: ${summary.passed}`)
  console.log(`❌ Failed: ${summary.failed}`)
  
  if (summary.failed === 0) {
    console.log('🎉 All tests passed!')
  } else {
    console.log('⚠️  Some tests failed. Check output above.')
  }
}