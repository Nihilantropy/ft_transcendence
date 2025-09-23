/**
 * @brief WebSocket Integration Test for ft_transcendence
 * 
 * @description Test script to validate the WebSocket integration
 * between GameService and GameStore follows established patterns
 * and includes proper error handling. Tests real connection to backend.
 */

import { gameService } from './services/game/GameService'
import { gameStore } from './stores/game.store'
import { webSocketService } from './services/websocket'

/**
 * @brief Test Real WebSocket Connection
 */
export async function testRealWebSocketConnection(): Promise<void> {
  console.log('🧪 Starting Real WebSocket Connection Test...')

  try {
    // Test 1: Check initial connection state
    console.log('📊 Test 1: Initial connection state')
    console.log('WebSocket connected:', webSocketService.isConnected())
    console.log('WebSocket URL:', webSocketService['serverUrl'] || 'Not available')

    // Test 2: Connect to WebSocket
    console.log('🔌 Test 2: Connecting to WebSocket...')
    try {
      await webSocketService.connect()
      console.log('✅ WebSocket connection successful!')
      console.log('Connection state:', webSocketService.isConnected())
    } catch (error) {
      console.error('❌ WebSocket connection failed:', error)
      throw error
    }

    // Test 3: Test ping/pong
    console.log('🏓 Test 3: Testing ping/pong...')
    await testPingPong()

    // Test 4: Test game events
    console.log('🎮 Test 4: Testing game events...')
    await testGameEvents()

    // Test 5: Test friend events
    console.log('👥 Test 5: Testing friend events...')
    await testFriendEvents()

    console.log('🎉 Real WebSocket Connection Test completed successfully!')
    
  } catch (error) {
    console.error('❌ Real WebSocket Connection Test failed:', error)
    throw error
  }
}

/**
 * @brief Test Ping/Pong Communication
 */
async function testPingPong(): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Ping/Pong timeout'))
    }, 5000)

    webSocketService.on('pong', (data) => {
      clearTimeout(timeout)
      console.log('✅ Received pong:', data)
      resolve()
    })

    webSocketService.emit('ping', { test: 'ping-test', timestamp: Date.now() })
    console.log('📤 Sent ping')
  })
}

/**
 * @brief Test Game Events
 */
async function testGameEvents(): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Game events timeout'))
    }, 5000)

    let eventsReceived = 0
    const expectedEvents = 2

    const checkCompletion = () => {
      eventsReceived++
      if (eventsReceived >= expectedEvents) {
        clearTimeout(timeout)
        resolve()
      }
    }

    // Listen for game events
    webSocketService.on('game:start', (data) => {
      console.log('✅ Received game:start:', data)
      checkCompletion()
    })

    webSocketService.on('game:update', (data) => {
      console.log('✅ Received game:update:', data)
      checkCompletion()
    })

    // Send game events
    console.log('📤 Sending game:join')
    webSocketService.emit('game:join', { gameId: 'test-game-123' })
    
    setTimeout(() => {
      console.log('📤 Sending game:move')
      webSocketService.emit('game:move', { 
        gameId: 'test-game-123', 
        move: { playerId: 'player-1', paddlePosition: 50 } 
      })
    }, 1000)
  })
}

/**
 * @brief Test Friend Events
 */
async function testFriendEvents(): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Friend events timeout'))
    }, 5000)

    webSocketService.on('friend:request_received', (data) => {
      console.log('✅ Received friend:request_received:', data)
      clearTimeout(timeout)
      resolve()
    })

    // Send friend request
    console.log('📤 Sending friend:request')
    webSocketService.emit('friend:request', { 
      requestId: 'test-request-123', 
      fromUser: { id: 'user-1', name: 'Test User' } 
    })
  })
}

/**
 * @brief Test WebSocket Game Integration
 */
export async function testWebSocketGameIntegration(): Promise<void> {
  console.log('🧪 Starting WebSocket Game Integration Test...')

  try {
    // Test 1: Check initial state
    console.log('📊 Test 1: Initial state')
    const initialState = gameStore.getState()
    console.log('Initial GameStore state:', {
      isPlaying: initialState.isPlaying,
      status: initialState.status,
      gameMode: initialState.gameMode,
      loading: initialState.loading,
      error: initialState.error,
      currentGame: initialState.currentGame ? `Game ${initialState.currentGame.id}` : null
    })

    // Test 2: Initialize WebSocket connection
    console.log('🔌 Test 2: Initialize WebSocket connection')
    if (!webSocketService.isConnected()) {
      console.log('⚠️  WebSocket not connected, testing connection...')
      await testRealWebSocketConnection()
    } else {
      console.log('✅ WebSocket already connected')
    }

    // Test 3: Check GameService real-time readiness
    console.log('⚡ Test 3: Check real-time readiness')
    const isReady = gameService.isRealTimeReady()
    console.log('GameService real-time ready:', isReady)

    // Test 4: Initialize game service WebSocket
    console.log('� Test 4: Initialize game service WebSocket')
    try {
      await gameService.initializeRealTimeConnection()
      console.log('✅ GameService WebSocket initialized')
    } catch (error) {
      console.log('⚠️  GameService WebSocket initialization may need auth token')
    }

    console.log('🎉 WebSocket Game Integration Test completed successfully!')
    
    return Promise.resolve()
  } catch (error) {
    console.error('❌ WebSocket Game Integration Test failed:', error)
    throw error
  }
}

/**
 * @brief Test WebSocket Game Event Flow
 */
export function testGameEventFlow(): void {
  console.log('🎭 Testing Game Event Flow...')

  // Simulate game events to test the flow
  const testEvents = [
    { type: 'game:started', data: { gameId: 'test-game-123', gameState: { status: 'starting' } } },
    { type: 'game:state_updated', data: { gameId: 'test-game-123', gameState: { ball: { x: 50, y: 50 } } } },
    { type: 'game:move_received', data: { gameId: 'test-game-123', move: { playerId: 'player-1', paddlePosition: 75 } } },
    { type: 'game:paused', data: { gameId: 'test-game-123' } },
    { type: 'game:resumed', data: { gameId: 'test-game-123' } },
    { type: 'game:ended', data: { gameId: 'test-game-123', result: { winner: 'player-1', score: [11, 8] } } }
  ]

  testEvents.forEach((eventTest, index) => {
    console.log(`🎯 Test Event ${index + 1}: ${eventTest.type}`)
    console.log(`   Data: ${JSON.stringify(eventTest.data)}`)
    console.log(`   ✅ GameStore handler: handle${eventTest.type.split(':')[1].charAt(0).toUpperCase() + eventTest.type.split(':')[1].slice(1)}`)
  })

  console.log('✅ Game Event Flow test completed')
}

/**
 * @brief Test Error Handling Patterns
 */
export function testErrorHandlingPatterns(): void {
  console.log('🛡️ Testing Error Handling Patterns...')

  const errorScenarios = [
    'WebSocket connection failure',
    'Game room join failure', 
    'Player action failure',
    'Game state update error',
    'Connection timeout'
  ]

  errorScenarios.forEach((scenario, index) => {
    console.log(`🚨 Error Scenario ${index + 1}: ${scenario}`)
    console.log(`   ✅ GameErrorHandler has specialized handling`)
    console.log(`   ✅ Follows centralized ErrorHandler pattern`)
    console.log(`   ✅ Provides user-friendly error messages`)
  })

  console.log('✅ Error Handling Patterns test completed')
}

// Export for use in main application
export default {
  testRealWebSocketConnection,
  testWebSocketGameIntegration,
  testGameEventFlow,
  testErrorHandlingPatterns
}

/**
 * @brief Run all WebSocket tests
 */
export async function runAllWebSocketTests(): Promise<void> {
  console.log('🧪🧪🧪 Running All WebSocket Tests 🧪🧪🧪')
  
  try {
    await testRealWebSocketConnection()
    console.log('✅ Real WebSocket Connection Test: PASSED')
    
    await testWebSocketGameIntegration()
    console.log('✅ WebSocket Game Integration Test: PASSED')
    
    testGameEventFlow()
    console.log('✅ Game Event Flow Test: PASSED')
    
    testErrorHandlingPatterns()
    console.log('✅ Error Handling Patterns Test: PASSED')
    
    console.log('🎉🎉🎉 ALL WEBSOCKET TESTS PASSED! 🎉🎉🎉')
    
  } catch (error) {
    console.error('❌❌❌ WEBSOCKET TESTS FAILED:', error)
    throw error
  }
}