/**
 * @brief Gaming-themed Input component for ft_transcendence
 * 
 * @description Reusable form input component with validation states, accessibility,
 * and multiple input types. Extends base Component class with controlled component pattern.
 * 
 * Phase B3.3 implementation - Input Component
 * 
 * FILE: src/components/ui/Input.ts
 */

import { Component } from '../base/Component'

/**
 * @brief Input type variants
 * 
 * @description Available HTML input types for different data entry needs.
 */
export type InputType = 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'search'

/**
 * @brief Input validation states
 * 
 * @description Visual states for form validation feedback.
 */
export type ValidationState = 'default' | 'error' | 'success'

/**
 * @brief Input component properties interface
 * 
 * @description Type-safe props for Input component configuration.
 */
export interface InputProps {
  /** HTML input type (default: 'text') */
  type?: InputType
  
  /** Current input value (controlled component) */
  value: string
  
  /** Change handler function */
  onChange: (value: string) => void
  
  /** Placeholder text */
  placeholder?: string
  
  /** Whether input is disabled (default: false) */
  disabled?: boolean
  
  /** Whether input is required (default: false) */
  required?: boolean
  
  /** Current validation state (default: 'default') */
  validationState?: ValidationState
  
  /** Error message to display (shown when validationState is 'error') */
  errorMessage?: string
  
  /** Success message to display (shown when validationState is 'success') */
  successMessage?: string
  
  /** Accessibility label for screen readers */
  ariaLabel?: string
  
  /** HTML id attribute */
  id?: string
  
  /** HTML name attribute */
  name?: string
  
  /** Additional CSS classes */
  className?: string
  
  /** Focus handler function */
  onFocus?: () => void
  
  /** Blur handler function */
  onBlur?: () => void
  
  /** Key down handler function */
  onKeyDown?: (event: KeyboardEvent) => void
}

/**
 * @brief Input component internal state
 * 
 * @description Internal state for input focus and interaction tracking.
 */
export interface InputState {
  /** Whether input is currently focused */
  isFocused: boolean
  
  /** Whether input has been touched (for validation timing) */
  isTouched: boolean
}

/**
 * @brief Gaming-themed Input component class
 * 
 * @description Implements form input with validation states, accessibility,
 * and gaming aesthetics. Follows controlled component pattern.
 */
export class Input extends Component<InputProps, InputState> {
  /**
   * @brief Initialize Input component
   * 
   * @param props - Input configuration properties
   * 
   * @description Creates input instance with default state and validates props.
   */
  constructor(props: InputProps) {
    super(props, {
      isFocused: false,
      isTouched: false
    })
    
    // Validate required props
    if (typeof props.onChange !== 'function') {
      throw new Error('Input component requires onChange function')
    }
    
    if (props.value === undefined || props.value === null) {
      throw new Error('Input component requires value prop (controlled component)')
    }
  }

  /**
   * @brief Render input to HTML string
   * 
   * @return HTML string representation of input
   * 
   * @description Generates input HTML with proper classes, attributes, and validation feedback.
   */
  render(): string {
    const {
      type = 'text',
      value,
      placeholder,
      disabled = false,
      required = false,
      validationState = 'default',
      errorMessage,
      successMessage,
      ariaLabel,
      id,
      name,
      className = ''
    } = this.props

    const { isFocused, isTouched } = this.state

    // Generate unique ID if not provided
    const inputId = id || this.generateInputId()
    
    // Build CSS classes
    const inputClasses = this.getInputClasses(validationState, disabled, isFocused, className)
    
    // Build attributes
    const attributes = this.buildAttributes(
      type, value, placeholder, disabled, required, ariaLabel, inputId, name
    )

    // Build validation message
    const validationMessage = this.buildValidationMessage(
      validationState, errorMessage, successMessage, inputId, isTouched
    )

    return `
      <div class="input-container">
        <input 
          class="${inputClasses}"
          ${attributes}
          data-input
        />
        ${validationMessage}
      </div>
    `
  }

  /**
   * @brief Set up event listeners after component mount
   * 
   * @description Attaches input event handlers for value changes, focus, and keyboard events.
   */
  protected afterMount(): void {
    const inputElement = this.element?.querySelector('[data-input]') as HTMLInputElement
    if (!inputElement) return

    // Add event listeners with cleanup tracking
    this.addEventListener(inputElement, 'input', this.handleInput)
    this.addEventListener(inputElement, 'focus', this.handleFocus)
    this.addEventListener(inputElement, 'blur', this.handleBlur)
    this.addEventListener(inputElement, 'keydown', this.handleKeyDown)
  }

  /**
   * @brief Handle input value changes
   * 
   * @param event - Input event
   * 
   * @description Processes input changes and calls onChange prop with new value.
   */
  private handleInput = (event: Event): void => {
    const inputElement = event.target as HTMLInputElement
    const newValue = inputElement.value

    try {
      this.props.onChange(newValue)
    } catch (error) {
      console.error('Input onChange handler error:', error)
    }
  }

  /**
   * @brief Handle input focus events
   * 
   * @param event - Focus event
   * 
   * @description Updates focus state and calls onFocus prop if provided.
   */
  private handleFocus = (event: Event): void => {
    this.setState({ isFocused: true })

    if (this.props.onFocus) {
      try {
        this.props.onFocus()
      } catch (error) {
        console.error('Input onFocus handler error:', error)
      }
    }
  }

  /**
   * @brief Handle input blur events
   * 
   * @param event - Blur event
   * 
   * @description Updates focus and touched state, calls onBlur prop if provided.
   */
  private handleBlur = (event: Event): void => {
    this.setState({ 
      isFocused: false,
      isTouched: true 
    })

    if (this.props.onBlur) {
      try {
        this.props.onBlur()
      } catch (error) {
        console.error('Input onBlur handler error:', error)
      }
    }
  }

  /**
   * @brief Handle keyboard events
   * 
   * @param event - Keyboard event
   * 
   * @description Processes keyboard events and calls onKeyDown prop if provided.
   */
  private handleKeyDown = (event: Event): void => {
    const keyEvent = event as KeyboardEvent

    if (this.props.onKeyDown) {
      try {
        this.props.onKeyDown(keyEvent)
      } catch (error) {
        console.error('Input onKeyDown handler error:', error)
      }
    }
  }

  /**
   * @brief Get input CSS classes based on state
   * 
   * @param validationState - Current validation state
   * @param disabled - Whether input is disabled
   * @param isFocused - Whether input is currently focused
   * @param className - Additional custom classes
   * @return Input CSS classes string
   * 
   * @description Maps input state to appropriate Tailwind classes.
   */
  private getInputClasses(
    validationState: ValidationState,
    disabled: boolean,
    isFocused: boolean,
    className: string
  ): string {
    // Base classes from existing CSS
    let baseClasses = 'input-base'

    // Validation state classes
    switch (validationState) {
      case 'error':
        baseClasses = 'input-error'
        break
      case 'success':
        baseClasses = 'input-success'
        break
      default:
        baseClasses = 'input-base'
    }

    // Additional state classes
    const stateClasses: string[] = []
    
    if (disabled) {
      stateClasses.push('opacity-50 cursor-not-allowed')
    }

    if (isFocused && !disabled) {
      stateClasses.push('ring-2')
    }

    return `${baseClasses} ${stateClasses.join(' ')} ${className}`.trim()
  }

  /**
   * @brief Build input HTML attributes
   * 
   * @param type - Input type
   * @param value - Input value
   * @param placeholder - Placeholder text
   * @param disabled - Whether disabled
   * @param required - Whether required
   * @param ariaLabel - Accessibility label
   * @param id - HTML id
   * @param name - HTML name
   * @return Attributes string
   * 
   * @description Constructs proper HTML attributes for accessibility and functionality.
   */
  private buildAttributes(
    type: InputType,
    value: string,
    placeholder?: string,
    disabled?: boolean,
    required?: boolean,
    ariaLabel?: string,
    id?: string,
    name?: string
  ): string {
    const attributes: string[] = []

    attributes.push(`type="${type}"`)
    attributes.push(`value="${this.escapeHtml(value)}"`)

    if (placeholder) {
      attributes.push(`placeholder="${this.escapeHtml(placeholder)}"`)
    }

    if (disabled) {
      attributes.push('disabled')
      attributes.push('aria-disabled="true"')
    }

    if (required) {
      attributes.push('required')
      attributes.push('aria-required="true"')
    }

    if (ariaLabel) {
      attributes.push(`aria-label="${this.escapeHtml(ariaLabel)}"`)
    }

    if (id) {
      attributes.push(`id="${id}"`)
    }

    if (name) {
      attributes.push(`name="${name}"`)
    }

    return attributes.join(' ')
  }

  /**
   * @brief Build validation message HTML
   * 
   * @param validationState - Current validation state
   * @param errorMessage - Error message text
   * @param successMessage - Success message text
   * @param inputId - Input ID for ARIA association
   * @param isTouched - Whether input has been touched
   * @return Validation message HTML string
   * 
   * @description Constructs validation feedback with proper ARIA associations.
   */
  private buildValidationMessage(
    validationState: ValidationState,
    errorMessage?: string,
    successMessage?: string,
    inputId?: string,
    isTouched?: boolean
  ): string {
    // Don't show validation messages until input has been touched
    if (!isTouched && validationState !== 'error') {
      return ''
    }

    let message = ''
    let messageClasses = ''
    let messageId = ''

    switch (validationState) {
      case 'error':
        if (errorMessage) {
          message = errorMessage
          messageClasses = 'text-red-400 text-sm mt-1'
          messageId = `${inputId}-error`
        }
        break
      case 'success':
        if (successMessage) {
          message = successMessage
          messageClasses = 'text-green-400 text-sm mt-1'
          messageId = `${inputId}-success`
        }
        break
    }

    if (!message) {
      return ''
    }

    return `
      <div 
        id="${messageId}"
        class="${messageClasses}"
        role="alert"
        aria-live="polite"
      >
        ${this.escapeHtml(message)}
      </div>
    `
  }

  /**
   * @brief Generate unique input ID
   * 
   * @return Unique ID string
   * 
   * @description Creates unique ID for input if none provided.
   */
  private generateInputId(): string {
    return `input-${Math.random().toString(36).substr(2, 9)}`
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
   * @brief Get current input value (convenience method)
   * 
   * @return Current input value
   * 
   * @description Helper to get current value from props.
   */
  public getValue(): string {
    return this.props.value
  }

  /**
   * @brief Check if input is valid (convenience method)
   * 
   * @return True if validation state is not error
   * 
   * @description Helper to check validation state.
   */
  public isValid(): boolean {
    return this.props.validationState !== 'error'
  }

  /**
   * @brief Focus the input programmatically
   * 
   * @description Sets focus to the input element.
   */
  public focus(): void {
    const inputElement = this.element?.querySelector('[data-input]') as HTMLInputElement
    if (inputElement) {
      inputElement.focus()
    }
  }
}