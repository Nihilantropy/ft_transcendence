/**
 * @brief Gaming-themed Button component for ft_transcendence
 * 
 * @description Reusable button component with multiple variants, sizes, and states.
 * Extends base Component class with proper TypeScript typing and gaming aesthetics.
 * 
 * Phase B3.1 implementation - Basic UI Components
 * 
 * FILE: src/components/ui/Button.ts
 */

import { Component } from '../base/Component'

/**
 * @brief Button style variants
 * 
 * @description Available button styling options matching gaming theme.
 */
export type ButtonVariant = 'primary' | 'game' | 'secondary' | 'danger'

/**
 * @brief Button size variants
 * 
 * @description Available button sizes for different UI contexts.
 */
export type ButtonSize = 'sm' | 'md' | 'lg'

/**
 * @brief Button component properties interface
 * 
 * @description Type-safe props for Button component configuration.
 */
export interface ButtonProps {
  /** Button text content */
  text: string
  
  /** Click event handler function */
  onClick: () => void
  
  /** Visual style variant (default: 'primary') */
  variant?: ButtonVariant
  
  /** Size variant (default: 'md') */
  size?: ButtonSize
  
  /** Whether button is disabled (default: false) */
  disabled?: boolean
  
  /** Whether button is in loading state (default: false) */
  loading?: boolean
  
  /** Optional icon identifier */
  icon?: string
  
  /** Icon position relative to text (default: 'left') */
  iconPosition?: 'left' | 'right'
  
  /** Accessibility label for screen readers */
  ariaLabel?: string
  
  /** HTML button type (default: 'button') */
  type?: 'button' | 'submit' | 'reset'
  
  /** Additional CSS classes */
  className?: string
}

/**
 * @brief Button component internal state
 * 
 * @description Internal state for button interaction feedback.
 */
export interface ButtonState {
  /** Whether button is currently being pressed */
  isPressed: boolean
}

/**
 * @brief Gaming-themed Button component class
 * 
 * @description Implements interactive button with gaming aesthetics,
 * proper accessibility, and multiple visual variants.
 */
export class Button extends Component<ButtonProps, ButtonState> {
  /**
   * @brief Initialize Button component
   * 
   * @param props - Button configuration properties
   * 
   * @description Creates button instance with default state and validates props.
   */
  constructor(props: ButtonProps) {
    super(props, { isPressed: false })
    
    // Validate required props
    if (!props.text) {
      throw new Error('Button component requires text prop')
    }
    
    if (typeof props.onClick !== 'function') {
      throw new Error('Button component requires onClick function')
    }
  }

  /**
   * @brief Render button to HTML string
   * 
   * @return HTML string representation of button
   * 
   * @description Generates button HTML with proper classes, attributes, and content.
   */
  render(): string {
    const {
      text,
      variant = 'primary',
      size = 'md',
      disabled = false,
      loading = false,
      icon,
      iconPosition = 'left',
      ariaLabel,
      type = 'button',
      className = ''
    } = this.props

    const { isPressed } = this.state

    // Build CSS classes
    const baseClasses = this.getBaseClasses()
    const variantClasses = this.getVariantClasses(variant)
    const sizeClasses = this.getSizeClasses(size)
    const stateClasses = this.getStateClasses(disabled, loading, isPressed)
    
    const allClasses = [
      baseClasses,
      variantClasses,
      sizeClasses,
      stateClasses,
      className
    ].filter(Boolean).join(' ')

    // Build content with optional icon and loading spinner
    const content = this.buildButtonContent(text, icon, iconPosition, loading)

    // Build attributes
    const attributes = this.buildAttributes(disabled, loading, ariaLabel, type)

    return `
      <button 
        class="${allClasses}"
        ${attributes}
        data-variant="${variant}"
        data-size="${size}"
      >
        ${content}
      </button>
    `
  }

  /**
   * @brief Set up event listeners after component mount
   * 
   * @description Attaches click and keyboard event handlers with proper cleanup tracking.
   */
  protected afterMount(): void {
    if (!this.element) return

    // Add event listeners with cleanup tracking
    this.addEventListener(this.element, 'click', this.handleClick)
    this.addEventListener(this.element, 'keydown', this.handleKeyDown)
    this.addEventListener(this.element, 'mousedown', this.handleMouseDown)
    this.addEventListener(this.element, 'mouseup', this.handleMouseUp)
    this.addEventListener(this.element, 'mouseleave', this.handleMouseLeave)
  }

  /**
   * @brief Handle button click events
   * 
   * @param event - Mouse click event
   * 
   * @description Processes click events and calls onClick handler if button is enabled.
   */
  private handleClick = (event: Event): void => {
    event.preventDefault()
    
    const { disabled, loading, onClick } = this.props
    
    if (disabled || loading) {
      return
    }

    try {
      onClick()
    } catch (error) {
      console.error('Button onClick handler error:', error)
    }
  }

  /**
   * @brief Handle keyboard events for accessibility
   * 
   * @param event - Keyboard event
   * 
   * @description Handles Enter and Space key presses for keyboard accessibility.
   */
  private handleKeyDown = (event: Event): void => {
    const { disabled, loading } = this.props
    
    if (disabled || loading) {
      return
    }

    // Cast to KeyboardEvent to access keyboard-specific properties
    const keyEvent = event as KeyboardEvent

    // Activate button on Enter or Space
    if (keyEvent.key === 'Enter' || keyEvent.key === ' ') {
      event.preventDefault()
      this.handleClick(event)
    }
  }

  /**
   * @brief Handle mouse down for visual feedback
   *
   * @param _event - Mouse down event (unused)
   *
   * @description Provides visual feedback during button press.
   */
  private handleMouseDown = (_event: Event): void => {
    const { disabled, loading } = this.props

    if (disabled || loading) {
      return
    }

    this.setState({ isPressed: true })
  }

  /**
   * @brief Handle mouse up to reset visual feedback
   *
   * @param _event - Mouse up event (unused)
   *
   * @description Resets visual feedback when button is released.
   */
  private handleMouseUp = (_event: Event): void => {
    this.setState({ isPressed: false })
  }

  /**
   * @brief Handle mouse leave to reset state
   *
   * @param _event - Mouse leave event (unused)
   *
   * @description Resets pressed state when mouse leaves button area.
   */
  private handleMouseLeave = (_event: Event): void => {
    this.setState({ isPressed: false })
  }

  /**
   * @brief Get base CSS classes for all buttons
   * 
   * @return Base CSS classes string
   * 
   * @description Returns common classes used by all button variants.
   */
  private getBaseClasses(): string {
    return 'inline-flex items-center justify-center font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black select-none cursor-pointer'
  }

  /**
   * @brief Get variant-specific CSS classes
   * 
   * @param variant - Button variant type
   * @return Variant CSS classes string
   * 
   * @description Maps button variants to their corresponding Tailwind classes.
   */
  private getVariantClasses(variant: ButtonVariant): string {
    const variants = {
      primary: 'btn-primary',
      game: 'btn-game', 
      secondary: 'btn-secondary',
      danger: 'bg-red-600 text-white border border-red-600 hover:bg-red-700 hover:border-red-700 focus:ring-red-500'
    }

    return variants[variant] || variants.primary
  }

  /**
   * @brief Get size-specific CSS classes
   * 
   * @param size - Button size variant
   * @return Size CSS classes string
   * 
   * @description Maps button sizes to their corresponding spacing and font classes.
   */
  private getSizeClasses(size: ButtonSize): string {
    const sizes = {
      sm: 'px-3 py-1.5 text-sm rounded',
      md: 'px-4 py-2 text-base rounded-md',
      lg: 'px-6 py-3 text-lg rounded-lg'
    }

    return sizes[size] || sizes.md
  }

  /**
   * @brief Get state-specific CSS classes
   * 
   * @param disabled - Whether button is disabled
   * @param loading - Whether button is loading
   * @param isPressed - Whether button is currently pressed
   * @return State CSS classes string
   * 
   * @description Applies visual state modifications based on button state.
   */
  private getStateClasses(disabled: boolean, loading: boolean, isPressed: boolean): string {
    const classes: string[] = []

    if (disabled || loading) {
      classes.push('opacity-50 cursor-not-allowed')
    }

    if (isPressed && !disabled && !loading) {
      classes.push('transform scale-95')
    }

    return classes.join(' ')
  }

  /**
   * @brief Build button content with icon and loading spinner
   * 
   * @param text - Button text
   * @param icon - Optional icon identifier
   * @param iconPosition - Icon position relative to text
   * @param loading - Whether to show loading spinner
   * @return Button content HTML string
   * 
   * @description Constructs button inner content with proper icon and loading state handling.
   */
  private buildButtonContent(
    text: string,
    icon?: string,
    iconPosition: 'left' | 'right' = 'left',
    loading: boolean = false
  ): string {
    // Loading spinner
    if (loading) {
      return `
        <svg class="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        Loading...
      `
    }

    // Icon handling (placeholder for future icon system)
    const iconHtml = icon ? `<span class="icon icon-${icon} ${iconPosition === 'right' ? 'ml-2' : 'mr-2'}" aria-hidden="true"></span>` : ''

    // Arrange content based on icon position
    if (iconPosition === 'left') {
      return `${iconHtml}${text}`
    } else {
      return `${text}${iconHtml}`
    }
  }

  /**
   * @brief Build button HTML attributes
   * 
   * @param disabled - Whether button is disabled
   * @param loading - Whether button is loading
   * @param ariaLabel - Accessibility label
   * @param type - HTML button type
   * @return Attributes string
   * 
   * @description Constructs proper HTML attributes for accessibility and functionality.
   */
  private buildAttributes(
    disabled: boolean,
    loading: boolean,
    ariaLabel?: string,
    type: string = 'button'
  ): string {
    const attributes: string[] = []

    attributes.push(`type="${type}"`)

    if (disabled || loading) {
      attributes.push('disabled')
      attributes.push('aria-disabled="true"')
    }

    if (ariaLabel) {
      attributes.push(`aria-label="${ariaLabel}"`)
    }

    if (loading) {
      attributes.push('aria-busy="true"')
    }

    return attributes.join(' ')
  }
}