/**
 * @brief Base component class for ft_transcendence frontend
 * 
 * @description Abstract base class that all components extend.
 * Provides lifecycle methods, event handling, state management, and type safety.
 * Phase A3 Point 1 implementation following project architecture specifications.
 */

/**
 * @brief Base component class with props and state management
 * 
 * @template TProps - Component props type (default: empty object)
 * @template TState - Component state type (default: empty object)
 * 
 * @description Provides foundation functionality for all UI components including:
 * - DOM element lifecycle (mount/unmount)
 * - State management with automatic re-rendering
 * - Props updates and change handling
 * - Event handling utilities
 * - Type-safe component architecture
 */
export abstract class Component<TProps = {}, TState = {}> {
  /** DOM element reference once mounted */
  protected element: HTMLElement | null = null
  
  /** Component properties passed from parent */
  protected props: TProps
  
  /** Internal component state */
  protected state: TState
  
  /** Mount status flag */
  protected mounted: boolean = false
  
  /** Event listeners registry for cleanup */
  private eventListeners: Map<string, EventListener[]> = new Map()

  /**
   * @brief Initialize component with props and initial state
   * 
   * @param props - Component properties
   * @param initialState - Initial state object
   */
  constructor(props: TProps, initialState: TState) {
    this.props = props
    this.state = initialState
  }

  /**
   * @brief Render component to HTML string
   * 
   * @return HTML string representation of the component
   * 
   * @description Abstract method that must be implemented by subclasses.
   * Should return a valid HTML string that represents the component's current state.
   */
  abstract render(): string

  /**
   * @brief Mount component to DOM element
   * 
   * @param parent - Parent DOM element to mount to
   * 
   * @description Creates DOM element from render output and appends to parent.
   * Sets up event listeners and calls afterMount lifecycle method.
   */
  mount(parent: HTMLElement): void {
    if (this.mounted) {
      console.warn('Component is already mounted')
      return
    }

    const html = this.render()
    const template = document.createElement('template')
    template.innerHTML = html.trim()
    
    this.element = template.content.firstElementChild as HTMLElement
    
    if (!this.element) {
      throw new Error('Component render() must return valid HTML with a root element')
    }

    parent.appendChild(this.element)
    this.mounted = true
    this.afterMount()
  }

  /**
   * @brief Unmount component from DOM
   * 
   * @description Removes component from DOM, cleans up event listeners,
   * and calls beforeUnmount lifecycle method.
   */
  unmount(): void {
    if (!this.mounted || !this.element) {
      return
    }

    this.beforeUnmount()
    this.cleanup()
    
    if (this.element.parentNode) {
      this.element.parentNode.removeChild(this.element)
    }
    
    this.element = null
    this.mounted = false
  }

  /**
   * @brief Update component props and trigger re-render
   * 
   * @param newProps - Partial props object with updates
   * 
   * @description Merges new props with existing props and triggers re-render
   * if component is mounted.
   */
  updateProps(newProps: Partial<TProps>): void {
    this.props = { ...this.props, ...newProps }
    if (this.mounted) {
      this.rerender()
    }
  }

  /**
   * @brief Update component state and trigger re-render
   * 
   * @param stateUpdates - Partial state object with updates
   * 
   * @description Merges state updates with current state and triggers re-render
   * if component is mounted. Protected method for internal use by subclasses.
   */
  protected setState(stateUpdates: Partial<TState>): void {
    this.state = { ...this.state, ...stateUpdates }
    if (this.mounted) {
      this.rerender()
    }
  }

  /**
   * @brief Re-render component in place
   * 
   * @description Generates new HTML and replaces current element while
   * preserving event listeners and component state.
   */
  protected rerender(): void {
    if (!this.mounted || !this.element) {
      return
    }

    const newHtml = this.render()
    const template = document.createElement('template')
    template.innerHTML = newHtml.trim()
    const newElement = template.content.firstElementChild as HTMLElement

    if (!newElement) {
      throw new Error('Component render() must return valid HTML with a root element')
    }

    // Preserve parent reference
    const parent = this.element.parentNode
    if (parent) {
      // Clean up current element
      this.cleanup()
      
      // Replace element
      parent.replaceChild(newElement, this.element)
      this.element = newElement
      
      // Re-setup after render
      this.afterMount()
    }
  }

  /**
   * @brief Add event listener with automatic cleanup tracking
   * 
   * @param element - Target element for event listener
   * @param event - Event type (e.g., 'click', 'change')
   * @param handler - Event handler function
   * 
   * @description Adds event listener and tracks it for automatic cleanup
   * when component is unmounted.
   */
  protected addEventListener(element: HTMLElement, event: string, handler: EventListener): void {
    element.addEventListener(event, handler)
    
    // Track for cleanup
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, [])
    }
    this.eventListeners.get(event)!.push(handler)
  }

  /**
   * @brief Remove specific event listener
   * 
   * @param element - Target element
   * @param event - Event type
   * @param handler - Event handler function to remove
   */
  protected removeEventListener(element: HTMLElement, event: string, handler: EventListener): void {
    element.removeEventListener(event, handler)
    
    // Remove from tracking
    const handlers = this.eventListeners.get(event)
    if (handlers) {
      const index = handlers.indexOf(handler)
      if (index > -1) {
        handlers.splice(index, 1)
      }
    }
  }

  /**
   * @brief Lifecycle method called after component is mounted
   * 
   * @description Override in subclasses to perform post-mount setup
   * such as adding event listeners, initializing third-party libraries,
   * or triggering initial data fetches.
   */
  protected afterMount(): void {
    // Override in subclasses
  }

  /**
   * @brief Lifecycle method called before component is unmounted
   * 
   * @description Override in subclasses to perform cleanup tasks
   * such as canceling timers, removing global event listeners,
   * or cleaning up third-party library instances.
   */
  protected beforeUnmount(): void {
    // Override in subclasses
  }

  /**
   * @brief Clean up event listeners and resources
   * 
   * @description Internal cleanup method that removes all tracked
   * event listeners and resets the tracking registry.
   */
  private cleanup(): void {
    // Clean up tracked event listeners
    if (this.element) {
      this.eventListeners.forEach((handlers, event) => {
        handlers.forEach(handler => {
          this.element!.removeEventListener(event, handler)
        })
      })
    }
    
    this.eventListeners.clear()
  }

  /**
   * @brief Get current mounted status
   * 
   * @return True if component is currently mounted to DOM
   */
  public isMounted(): boolean {
    return this.mounted
  }

  /**
   * @brief Get component's DOM element
   * 
   * @return DOM element reference or null if not mounted
   */
  public getElement(): HTMLElement | null {
    return this.element
  }

  /**
   * @brief Get current component props (read-only)
   * 
   * @return Current props object
   */
  public getProps(): Readonly<TProps> {
    return this.props
  }

  /**
   * @brief Get current component state (read-only)
   * 
   * @return Current state object
   */
  public getState(): Readonly<TState> {
    return this.state
  }
}