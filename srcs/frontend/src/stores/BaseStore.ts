/**
 * @brief Base store class with subscription mechanism for ft_transcendence
 * 
 * @description Lightweight state management system providing centralized state storage
 * with reactive subscriptions. Implements observer pattern for component reactivity
 * with type safety and immutable state updates.
 * 
 * @template T - State object type
 * 
 * Phase B2.1 implementation following architecture specifications from
 * /docs/frontend/architecture.md
 */

/**
 * @brief State change listener function type
 * 
 * @template T - State object type
 * @param state - Current state after update
 */
export type StateListener<T> = (state: T) => void

/**
 * @brief Unsubscribe function type
 * 
 * @return Function to call for removing the subscription
 */
export type UnsubscribeFunction = () => void

/**
 * @brief Base store class providing centralized state management
 * 
 * @template T - State object type
 * 
 * @description Implements observer pattern for reactive state management.
 * Provides type-safe state updates with automatic listener notifications.
 * Ensures immutable state updates and prevents direct state mutation.
 */
export class BaseStore<T> {
  /** Current state object (immutable) */
  private state: T
  
  /** Set of registered state change listeners */
  private listeners: Set<StateListener<T>> = new Set()
  
  /** Store instance name for debugging */
  private readonly storeName: string

  /**
   * @brief Initialize store with initial state
   * 
   * @param initialState - Initial state object
   * @param storeName - Optional store name for debugging (default: "BaseStore")
   * 
   * @description Creates new store instance with immutable initial state.
   * State is frozen to prevent direct mutation and ensure immutability.
   */
  constructor(initialState: T, storeName: string = 'BaseStore') {
    // Deep freeze initial state to prevent mutation
    this.state = this.deepFreeze(structuredClone(initialState))
    this.storeName = storeName
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`📦 ${this.storeName} initialized with state:`, this.state)
    }
  }

  /**
   * @brief Subscribe to state changes with automatic cleanup
   * 
   * @param listener - Callback function for state updates
   * @return Unsubscribe function to remove the listener
   * 
   * @description Registers a listener for state changes. Returns unsubscribe
   * function that should be called to prevent memory leaks. Listener receives
   * the new state object whenever setState is called.
   */
  subscribe(listener: StateListener<T>): UnsubscribeFunction {
    if (typeof listener !== 'function') {
      throw new Error(`${this.storeName}: Listener must be a function`)
    }

    this.listeners.add(listener)
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`📦 ${this.storeName}: Listener subscribed (total: ${this.listeners.size})`)
    }

    // Return unsubscribe function
    return () => {
      const removed = this.listeners.delete(listener)
      
      if (process.env.NODE_ENV === 'development' && removed) {
        console.log(`📦 ${this.storeName}: Listener unsubscribed (total: ${this.listeners.size})`)
      }
      
      return removed
    }
  }

  /**
   * @brief Get current state (read-only)
   * 
   * @return Immutable copy of current state
   * 
   * @description Returns frozen copy of current state to prevent direct mutation.
   * Components should never modify the returned state object directly.
   */
  getState(): Readonly<T> {
    return this.state
  }

  /**
   * @brief Update state and notify all listeners
   * 
   * @param updates - Partial state updates to apply
   * 
   * @description Merges updates with current state, creates new immutable state object,
   * and notifies all subscribed listeners. Uses shallow merge for performance.
   * All updates are applied atomically.
   */
  protected setState(updates: Partial<T>): void {
    if (!updates || typeof updates !== 'object') {
      throw new Error(`${this.storeName}: State updates must be an object`)
    }

    // Create new state by merging updates (shallow merge)
    const newState = { ...this.state, ...updates }
    
    // Check if state actually changed
    if (this.stateChanged(this.state, newState)) {
      // Freeze new state to prevent mutation
      this.state = this.deepFreeze(newState)
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`📦 ${this.storeName}: State updated`, {
          updates,
          newState: this.state,
          listenerCount: this.listeners.size
        })
      }
      
      // Notify all listeners asynchronously to prevent blocking
      this.notifyListeners()
    }
  }

  /**
   * @brief Force state replacement (use with caution)
   * 
   * @param newState - Complete new state object
   * 
   * @description Replaces entire state object. Should be used sparingly,
   * prefer setState for partial updates. Useful for resets or hydration.
   */
  protected replaceState(newState: T): void {
    if (!newState || typeof newState !== 'object') {
      throw new Error(`${this.storeName}: New state must be an object`)
    }

    this.state = this.deepFreeze(structuredClone(newState))
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`📦 ${this.storeName}: State replaced`, this.state)
    }
    
    this.notifyListeners()
  }

  /**
   * @brief Get current listener count (for debugging)
   * 
   * @return Number of active listeners
   */
  public getListenerCount(): number {
    return this.listeners.size
  }

  /**
   * @brief Remove all listeners (cleanup)
   * 
   * @description Removes all subscribed listeners. Useful for cleanup
   * during application shutdown or store disposal.
   */
  public clearListeners(): void {
    const count = this.listeners.size
    this.listeners.clear()
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`📦 ${this.storeName}: Cleared ${count} listeners`)
    }
  }

  /**
   * @brief Notify all listeners of state change
   * 
   * @description Calls all registered listeners with current state.
   * Uses setTimeout to ensure async execution and prevent blocking.
   */
  private notifyListeners(): void {
    if (this.listeners.size === 0) {
      return
    }

    // Use setTimeout to make notifications async and prevent blocking
    setTimeout(() => {
      this.listeners.forEach(listener => {
        try {
          listener(this.state)
        } catch (error) {
          console.error(`📦 ${this.storeName}: Listener error:`, error)
        }
      })
    }, 0)
  }

  /**
   * @brief Deep freeze object to prevent mutation
   * 
   * @param obj - Object to freeze
   * @return Frozen object
   * 
   * @description Recursively freezes object and all nested objects
   * to ensure complete immutability.
   */
  private deepFreeze<U>(obj: U): U {
    // Get property names
    Object.getOwnPropertyNames(obj).forEach(prop => {
      const value = (obj as any)[prop]
      
      // Freeze nested objects
      if (value && typeof value === 'object') {
        this.deepFreeze(value)
      }
    })
    
    return Object.freeze(obj)
  }

  /**
   * @brief Check if state has changed (shallow comparison)
   * 
   * @param oldState - Previous state
   * @param newState - New state
   * @return True if state has changed
   * 
   * @description Performs shallow comparison to determine if state update
   * is necessary. Prevents unnecessary listener notifications.
   */
  private stateChanged(oldState: T, newState: T): boolean {
    // Quick reference check
    if (oldState === newState) {
      return false
    }

    // Shallow comparison of properties
    const oldKeys = Object.keys(oldState as object)
    const newKeys = Object.keys(newState as object)
    
    if (oldKeys.length !== newKeys.length) {
      return true
    }
    
    for (const key of oldKeys) {
      if ((oldState as any)[key] !== (newState as any)[key]) {
        return true
      }
    }
    
    return false
  }

  /**
   * @brief Get store name for debugging
   * 
   * @return Store instance name
   */
  public getStoreName(): string {
    return this.storeName
  }
}