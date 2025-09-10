/**
 * @brief Gaming-themed Navigation component for ft_transcendence
 * 
 * @description Reusable navigation component with responsive layouts, active states,
 * and gaming aesthetics. Extends base Component class with proper event handling.
 * 
 * Phase B3.4 implementation - Navigation Component
 * 
 * FILE: src/components/ui/Navigation.ts
 */

import { Component } from '../base/Component'

/**
 * @brief Navigation layout variants
 * 
 * @description Available layout options for navigation component.
 */
export type NavigationLayout = 'horizontal' | 'vertical'

/**
 * @brief Navigation item interface
 * 
 * @description Structure for individual navigation items.
 */
export interface NavigationItem {
  /** Unique identifier for the navigation item */
  id: string
  
  /** Display text for the navigation item */
  text: string
  
  /** URL path or route for the navigation item */
  path: string
  
  /** Optional icon identifier */
  icon?: string
  
  /** Whether the item is disabled */
  disabled?: boolean
  
  /** Additional CSS classes for the item */
  className?: string
}

/**
 * @brief Navigation component properties interface
 * 
 * @description Type-safe props for Navigation component configuration.
 */
export interface NavigationProps {
  /** Array of navigation items to display */
  items: NavigationItem[]
  
  /** Layout orientation (default: 'horizontal') */
  layout?: NavigationLayout
  
  /** Currently active item ID */
  activeItem?: string
  
  /** Click handler for navigation items */
  onItemClick?: (item: NavigationItem) => void
  
  /** Whether navigation is collapsible on mobile (default: true) */
  collapsible?: boolean
  
  /** Additional CSS classes for navigation container */
  className?: string
  
  /** Accessibility label for navigation */
  ariaLabel?: string
}

/**
 * @brief Navigation component internal state
 * 
 * @description Internal state for navigation interactions and mobile collapse.
 */
export interface NavigationState {
  /** Whether mobile navigation is currently expanded */
  isMobileExpanded: boolean
  
  /** Currently focused item ID for keyboard navigation */
  focusedItem: string | null
}

/**
 * @brief Gaming-themed Navigation component class
 * 
 * @description Implements responsive navigation with gaming aesthetics,
 * keyboard support, and mobile collapse functionality.
 */
export class Navigation extends Component<NavigationProps, NavigationState> {
  /**
   * @brief Initialize Navigation component
   * 
   * @param props - Navigation configuration properties
   * 
   * @description Creates navigation instance with default state and validates props.
   */
  constructor(props: NavigationProps) {
    super(props, {
      isMobileExpanded: false,
      focusedItem: null
    })
    
    // Validate required props
    if (!props.items || props.items.length === 0) {
      throw new Error('Navigation component requires at least one item')
    }
    
    // Validate item structure
    props.items.forEach((item, index) => {
      if (!item.id || !item.text || !item.path) {
        throw new Error(`Navigation item at index ${index} missing required properties (id, text, path)`)
      }
    })
  }

  /**
   * @brief Render navigation to HTML string
   * 
   * @return HTML string representation of navigation
   * 
   * @description Generates navigation HTML with proper accessibility and responsive design.
   */
  render(): string {
    const {
      items,
      layout = 'horizontal',
      activeItem,
      collapsible = true,
      className = '',
      ariaLabel = 'Main navigation'
    } = this.props

    const { isMobileExpanded } = this.state

    // Build CSS classes for navigation container
    const containerClasses = this.getContainerClasses(layout, className)
    
    // Build mobile toggle button if collapsible
    const mobileToggle = collapsible ? this.buildMobileToggle(isMobileExpanded) : ''
    
    // Build navigation items
    const navigationItems = this.buildNavigationItems(items, activeItem, layout)
    
    // Build navigation list with responsive classes
    const navListClasses = this.getNavListClasses(layout, isMobileExpanded, collapsible)

    return `
      <nav 
        class="${containerClasses}"
        role="navigation"
        aria-label="${ariaLabel}"
        data-navigation
      >
        ${mobileToggle}
        <ul 
          class="${navListClasses}"
          role="menubar"
          data-nav-list
        >
          ${navigationItems}
        </ul>
      </nav>
    `
  }

  /**
   * @brief Set up event listeners after component mount
   * 
   * @description Attaches click and keyboard event handlers for navigation interactions.
   */
  protected afterMount(): void {
    if (!this.element) return

    // Add event listeners for navigation items
    this.addEventListener(this.element, 'click', this.handleClick)
    this.addEventListener(this.element, 'keydown', this.handleKeyDown)

    // Add mobile toggle listener if collapsible
    const mobileToggle = this.element.querySelector('[data-mobile-toggle]') as HTMLElement
    if (mobileToggle) {
      this.addEventListener(mobileToggle, 'click', this.handleMobileToggle)
    }
  }

  /**
   * @brief Handle click events on navigation items
   * 
   * @param event - Mouse click event
   * 
   * @description Processes navigation item clicks and calls onItemClick handler.
   */
  private handleClick = (event: Event): void => {
    const target = event.target as HTMLElement
    const navItem = target.closest('[data-nav-item]') as HTMLElement
    
    if (!navItem) return

    const itemId = navItem.dataset.navItem
    const item = this.props.items.find(item => item.id === itemId)
    
    if (!item || item.disabled) {
      return
    }

    event.preventDefault()

    // Close mobile navigation on item click
    if (this.state.isMobileExpanded) {
      this.setState({ isMobileExpanded: false })
    }

    // Call onItemClick handler if provided
    if (this.props.onItemClick) {
      try {
        this.props.onItemClick(item)
      } catch (error) {
        console.error('Navigation onItemClick handler error:', error)
      }
    }
  }

  /**
   * @brief Handle keyboard navigation
   * 
   * @param event - Keyboard event
   * 
   * @description Implements keyboard navigation with arrow keys and Enter/Space.
   */
  private handleKeyDown = (event: Event): void => {
    const keyEvent = event as KeyboardEvent
    const target = event.target as HTMLElement

    // Handle mobile toggle keyboard events
    if (target.hasAttribute('data-mobile-toggle')) {
      if (keyEvent.key === 'Enter' || keyEvent.key === ' ') {
        event.preventDefault()
        this.handleMobileToggle(event)
      }
      return
    }

    // Handle navigation item keyboard events
    const navItem = target.closest('[data-nav-item]') as HTMLElement
    if (!navItem) return

    switch (keyEvent.key) {
      case 'Enter':
      case ' ':
        event.preventDefault()
        this.handleClick(event)
        break

      case 'ArrowDown':
      case 'ArrowRight':
        event.preventDefault()
        this.focusNextItem(navItem)
        break

      case 'ArrowUp':
      case 'ArrowLeft':
        event.preventDefault()
        this.focusPreviousItem(navItem)
        break

      case 'Home':
        event.preventDefault()
        this.focusFirstItem()
        break

      case 'End':
        event.preventDefault()
        this.focusLastItem()
        break
    }
  }

  /**
   * @brief Handle mobile navigation toggle
   * 
   * @param event - Click or keyboard event
   * 
   * @description Toggles mobile navigation expanded state.
   */
  private handleMobileToggle = (event: Event): void => {
    event.preventDefault()
    this.setState({ isMobileExpanded: !this.state.isMobileExpanded })
  }

  /**
   * @brief Focus next navigation item
   * 
   * @param currentItem - Currently focused navigation item
   * 
   * @description Moves focus to the next navigation item in sequence.
   */
  private focusNextItem(currentItem: HTMLElement): void {
    const allItems = Array.from(this.element?.querySelectorAll('[data-nav-item]') || [])
    const currentIndex = allItems.indexOf(currentItem)
    const nextIndex = (currentIndex + 1) % allItems.length
    const nextItem = allItems[nextIndex] as HTMLElement
    
    if (nextItem) {
      nextItem.focus()
    }
  }

  /**
   * @brief Focus previous navigation item
   * 
   * @param currentItem - Currently focused navigation item
   * 
   * @description Moves focus to the previous navigation item in sequence.
   */
  private focusPreviousItem(currentItem: HTMLElement): void {
    const allItems = Array.from(this.element?.querySelectorAll('[data-nav-item]') || [])
    const currentIndex = allItems.indexOf(currentItem)
    const prevIndex = currentIndex === 0 ? allItems.length - 1 : currentIndex - 1
    const prevItem = allItems[prevIndex] as HTMLElement
    
    if (prevItem) {
      prevItem.focus()
    }
  }

  /**
   * @brief Focus first navigation item
   * 
   * @description Moves focus to the first navigation item.
   */
  private focusFirstItem(): void {
    const firstItem = this.element?.querySelector('[data-nav-item]') as HTMLElement
    if (firstItem) {
      firstItem.focus()
    }
  }

  /**
   * @brief Focus last navigation item
   * 
   * @description Moves focus to the last navigation item.
   */
  private focusLastItem(): void {
    const allItems = this.element?.querySelectorAll('[data-nav-item]')
    const lastItem = allItems?.[allItems.length - 1] as HTMLElement
    if (lastItem) {
      lastItem.focus()
    }
  }

  /**
   * @brief Get container CSS classes
   * 
   * @param layout - Navigation layout
   * @param className - Additional custom classes
   * @return Container CSS classes string
   * 
   * @description Returns navigation container classes based on layout and custom classes.
   */
  private getContainerClasses(layout: NavigationLayout, className: string): string {
    const baseClasses = 'navigation-container'
    const layoutClasses = layout === 'vertical' ? 'flex-col' : 'flex-row'
    
    return `${baseClasses} ${layoutClasses} ${className}`.trim()
  }

  /**
   * @brief Get navigation list CSS classes
   * 
   * @param layout - Navigation layout
   * @param isMobileExpanded - Whether mobile nav is expanded
   * @param collapsible - Whether navigation is collapsible
   * @return Navigation list CSS classes string
   * 
   * @description Returns navigation list classes with responsive behavior.
   */
  private getNavListClasses(
    layout: NavigationLayout, 
    isMobileExpanded: boolean, 
    collapsible: boolean
  ): string {
    const baseClasses = 'navigation-list'
    
    if (layout === 'vertical') {
      return `${baseClasses} flex flex-col space-y-1`
    }

    // Horizontal layout with responsive behavior
    const horizontalClasses = 'flex space-x-1'
    
    if (collapsible) {
      const mobileClasses = isMobileExpanded 
        ? 'flex-col space-x-0 space-y-1 md:flex-row md:space-x-1 md:space-y-0'
        : 'hidden md:flex'
      
      return `${baseClasses} ${horizontalClasses} ${mobileClasses}`
    }

    return `${baseClasses} ${horizontalClasses}`
  }

  /**
   * @brief Build mobile toggle button HTML
   * 
   * @param isMobileExpanded - Whether mobile nav is currently expanded
   * @return Mobile toggle button HTML string
   * 
   * @description Creates mobile hamburger menu toggle button.
   */
  private buildMobileToggle(isMobileExpanded: boolean): string {
    const toggleClasses = 'md:hidden btn-game p-2'
    const ariaExpanded = isMobileExpanded ? 'true' : 'false'
    
    return `
      <button
        type="button"
        class="${toggleClasses}"
        aria-expanded="${ariaExpanded}"
        aria-controls="navigation-menu"
        aria-label="Toggle navigation menu"
        data-mobile-toggle
      >
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path>
        </svg>
      </button>
    `
  }

  /**
   * @brief Build navigation items HTML
   * 
   * @param items - Array of navigation items
   * @param activeItem - Currently active item ID
   * @param layout - Navigation layout
   * @return Navigation items HTML string
   * 
   * @description Creates HTML for all navigation items with proper states and accessibility.
   */
  private buildNavigationItems(
    items: NavigationItem[], 
    activeItem?: string, 
    layout: NavigationLayout = 'horizontal'
  ): string {
    return items.map(item => this.buildNavigationItem(item, activeItem, layout)).join('')
  }

  /**
   * @brief Build individual navigation item HTML
   * 
   * @param item - Navigation item data
   * @param activeItem - Currently active item ID
   * @param layout - Navigation layout
   * @return Navigation item HTML string
   * 
   * @description Creates HTML for a single navigation item with proper accessibility.
   */
  private buildNavigationItem(
    item: NavigationItem, 
    activeItem?: string, 
    layout: NavigationLayout = 'horizontal'
  ): string {
    const isActive = item.id === activeItem
    const isDisabled = item.disabled ?? false

    // Build item classes using existing nav-link styles
    const itemClasses = this.getItemClasses(isActive, isDisabled, item.className)
    
    // Build icon if provided
    const iconHtml = item.icon 
      ? `<span class="icon icon-${item.icon} mr-2" aria-hidden="true"></span>`
      : ''

    // Build attributes
    const attributes = this.buildItemAttributes(item, isActive, isDisabled)

    return `
      <li role="none">
        <a
          class="${itemClasses}"
          ${attributes}
          data-nav-item="${item.id}"
          role="menuitem"
          tabindex="${isDisabled ? '-1' : '0'}"
        >
          ${iconHtml}${this.escapeHtml(item.text)}
        </a>
      </li>
    `
  }

  /**
   * @brief Get navigation item CSS classes
   * 
   * @param isActive - Whether item is currently active
   * @param isDisabled - Whether item is disabled
   * @param className - Additional custom classes
   * @return Item CSS classes string
   * 
   * @description Maps item state to appropriate CSS classes using existing nav-link styles.
   */
  private getItemClasses(isActive: boolean, isDisabled: boolean, className?: string): string {
    let classes = 'nav-link' // Uses existing CSS class from components.css

    if (isActive) {
      classes += ' active' // Uses existing .nav-link.active CSS
    }

    if (isDisabled) {
      classes += ' opacity-50 cursor-not-allowed pointer-events-none'
    }

    if (className) {
      classes += ` ${className}`
    }

    return classes
  }

  /**
   * @brief Build navigation item attributes
   * 
   * @param item - Navigation item data
   * @param isActive - Whether item is currently active
   * @param isDisabled - Whether item is disabled
   * @return Attributes string
   * 
   * @description Creates proper HTML attributes for accessibility and functionality.
   */
  private buildItemAttributes(item: NavigationItem, isActive: boolean, isDisabled: boolean): string {
    const attributes: string[] = []

    attributes.push(`href="${item.path}"`)

    if (isActive) {
      attributes.push('aria-current="page"')
    }

    if (isDisabled) {
      attributes.push('aria-disabled="true"')
    }

    return attributes.join(' ')
  }

  /**
   * @brief Escape HTML characters for security
   * 
   * @param str - String to escape
   * @return Escaped string
   * 
   * @description Prevents XSS by escaping HTML characters.
   */
  private escapeHtml(str: string): string {
    const div = document.createElement('div')
    div.textContent = str
    return div.innerHTML
  }

  /**
   * @brief Set active navigation item
   * 
   * @param itemId - ID of item to set as active
   * 
   * @description Updates the active item and re-renders navigation.
   */
  public setActiveItem(itemId: string): void {
    this.updateProps({ activeItem: itemId })
  }

  /**
   * @brief Get currently active item (convenience method)
   * 
   * @return Currently active navigation item or null
   * 
   * @description Helper to get current active item.
   */
  public getActiveItem(): NavigationItem | null {
    const activeId = this.props.activeItem
    return activeId ? this.props.items.find(item => item.id === activeId) || null : null
  }

  /**
   * @brief Toggle mobile navigation expansion
   * 
   * @description Programmatically toggles mobile navigation state.
   */
  public toggleMobileNavigation(): void {
    this.setState({ isMobileExpanded: !this.state.isMobileExpanded })
  }
}