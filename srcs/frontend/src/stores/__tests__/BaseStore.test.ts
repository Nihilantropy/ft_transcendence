/**
 * @brief BaseStore<T> usage demonstration
 * 
 * @description Example showing how to use the BaseStore<T> class
 * for state management in ft_transcendence frontend.
 * 
 * This example can be used for testing the implementation.
 */

import { BaseStore } from '@/stores'

// Example state interface for a counter application
interface CounterState {
  count: number
  isLoading: boolean
  lastUpdated: Date
}

// Example state interface for user state
interface UserState {
  isAuthenticated: boolean
  username: string | null
  preferences: {
    theme: 'dark' | 'light'
    language: string
  }
}

/**
 * @brief Example counter store extending BaseStore
 * 
 * @description Demonstrates how to create concrete store implementations
 * by extending BaseStore<T> with specific state types.
 */
class CounterStore extends BaseStore<CounterState> {
  constructor() {
    super({
      count: 0,
      isLoading: false,
      lastUpdated: new Date()
    }, 'CounterStore')
  }

  /**
   * @brief Increment counter value
   * 
   * @description Public method to increment counter and update timestamp.
   * Demonstrates how to expose state mutations through methods.
   */
  increment(): void {
    const currentState = this.getState()
    this.setState({
      count: currentState.count + 1,
      lastUpdated: new Date()
    })
  }

  /**
   * @brief Decrement counter value
   * 
   * @description Public method to decrement counter and update timestamp.
   */
  decrement(): void {
    const currentState = this.getState()
    this.setState({
      count: currentState.count - 1,
      lastUpdated: new Date()
    })
  }

  /**
   * @brief Reset counter to zero
   * 
   * @description Resets counter to initial state.
   */
  reset(): void {
    this.setState({
      count: 0,
      lastUpdated: new Date()
    })
  }

  /**
   * @brief Set loading state
   * 
   * @param isLoading - Loading state
   */
  setLoading(isLoading: boolean): void {
    this.setState({ isLoading })
  }
}

/**
 * @brief Example user store extending BaseStore
 * 
 * @description Demonstrates complex state management for user authentication.
 */
class UserStore extends BaseStore<UserState> {
  constructor() {
    super({
      isAuthenticated: false,
      username: null,
      preferences: {
        theme: 'dark',
        language: 'en'
      }
    }, 'UserStore')
  }

  /**
   * @brief Log in user
   * 
   * @param username - User's username
   */
  login(username: string): void {
    this.setState({
      isAuthenticated: true,
      username
    })
  }

  /**
   * @brief Log out user
   * 
   * @description Resets user state to logged out.
   */
  logout(): void {
    this.setState({
      isAuthenticated: false,
      username: null
    })
  }

  /**
   * @brief Update user preferences
   * 
   * @param preferences - Partial preferences to update
   */
  updatePreferences(preferences: Partial<UserState['preferences']>): void {
    const currentState = this.getState()
    this.setState({
      preferences: {
        ...currentState.preferences,
        ...preferences
      }
    })
  }
}

// Example usage and testing
export function runBaseStore(): void {
  console.log('🧪 BaseStore<T> Demonstration Starting...')

  // Create store instances
  const counterStore = new CounterStore()
  const userStore = new UserStore()

  // Subscribe to counter changes
  const unsubscribeCounter = counterStore.subscribe((state) => {
    console.log('📊 Counter state updated:', state)
  })

  // Subscribe to user changes
  const unsubscribeUser = userStore.subscribe((state) => {
    console.log('👤 User state updated:', state)
  })

  // Test counter operations
  console.log('\n--- Testing Counter Store ---')
  console.log('Initial state:', counterStore.getState())
  
  counterStore.increment()
  counterStore.increment()
  counterStore.decrement()
  counterStore.setLoading(true)
  counterStore.reset()

  // Test user operations
  console.log('\n--- Testing User Store ---')
  console.log('Initial state:', userStore.getState())
  
  userStore.login('alice')
  userStore.updatePreferences({ theme: 'light', language: 'fr' })
  userStore.logout()

  // Test multiple listeners
  console.log('\n--- Testing Multiple Listeners ---')
  const unsubscribe2 = counterStore.subscribe((state) => {
    console.log('📈 Second listener - count is now:', state.count)
  })

  counterStore.increment()
  console.log('Listener count:', counterStore.getListenerCount())

  // Cleanup
  console.log('\n--- Cleanup ---')
  unsubscribeCounter()
  unsubscribeUser()
  unsubscribe2()
  
  console.log('Final listener count:', counterStore.getListenerCount())
  console.log('✅ BaseStore<T> demonstration complete!')
}

// Export store instances for use in components
export const counterStore = new CounterStore()
export const userStore = new UserStore()