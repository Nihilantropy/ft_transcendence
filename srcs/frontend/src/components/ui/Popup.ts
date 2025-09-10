/**
 * @brief Popup/Modal component for ft_transcendence
 * 
 * @description Reusable popup component for displaying messages, errors, and confirmations.
 * Provides consistent styling and behavior across the application.
 */

import { Component } from '../base/Component'

export interface PopupProps {
  /** Popup title */
  title?: string
  /** Popup message content */
  message: string
  /** Popup type determines styling and icon */
  type?: 'info' | 'success' | 'warning' | 'error' | 'critical'
  /** Whether to show close button */
  showCloseButton?: boolean
  /** Whether popup can be closed by clicking outside */
  closeOnOverlay?: boolean
  /** Custom CSS classes */
  className?: string
  /** Error code to display */
  errorCode?: number | null
  /** Actions/buttons to show */
  actions?: Array<{
    label: string
    type: 'primary' | 'secondary' | 'danger'
    action: () => void
  }>
}

export interface PopupState {
  /** Whether popup is visible */
  isVisible: boolean
  /** Animation state */
  animationState: 'entering' | 'visible' | 'exiting' | 'hidden'
}

/**
 * @brief Popup component class
 * 
 * @description Modal popup with different types and customizable actions.
 */
export class Popup extends Component<PopupProps, PopupState> {
  private overlayElement: HTMLElement | null = null
  private popupElement: HTMLElement | null = null

  constructor(props: PopupProps) {
    super(props, {
      isVisible: false,
      animationState: 'hidden'
    })
  }

  /**
   * @brief Override setState to prevent base class rerender conflicts
   * Popup manages its own DOM updates and doesn't need automatic rerendering
   */
  protected setState(stateUpdates: Partial<PopupState>): void {
    this.state = { ...this.state, ...stateUpdates }
    // Don't call parent setState to avoid rerender conflicts
  }

  /**
   * @brief Show the popup with animation
   */
  public show(): void {
    this.setState({ 
      isVisible: true, 
      animationState: 'entering' 
    })
    
    // Add to DOM if not already present
    if (!this.overlayElement) {
      this.mount(document.body)
    }
    
    // Start animation
    setTimeout(() => {
      this.setState({ animationState: 'visible' })
    }, 10)
  }

  /**
   * @brief Hide the popup with animation   
   */
  public hide(): void {
    this.setState({ animationState: 'exiting' })
    
    // Remove from DOM after animation
    setTimeout(() => {
      this.setState({ 
        isVisible: false, 
        animationState: 'hidden' 
      })
      
      if (this.overlayElement && this.overlayElement.parentNode) {
        this.overlayElement.parentNode.removeChild(this.overlayElement)
        this.overlayElement = null
        this.popupElement = null
      }
    }, 300)
  }

  /**
   * @brief Get icon for popup type
   */
  private getTypeIcon(): string {
    const { type = 'info' } = this.props
    
    switch (type) {
      case 'success':
        return '✅'
      case 'warning':
        return '⚠️'
      case 'error':
        return '❌'
      case 'critical':
        return '💥'
      case 'info':
      default:
        return 'ℹ️'
    }
  }

  /**
   * @brief Get color classes for popup type
   */
  private getTypeColors(): { border: string; bg: string; text: string; header: string } {
    const { type = 'info' } = this.props
    
    switch (type) {
      case 'success':
        return {
          border: 'border-green-600',
          bg: 'bg-green-900/20',
          text: 'text-green-400',
          header: 'text-green-300'
        }
      case 'warning':
        return {
          border: 'border-yellow-600',
          bg: 'bg-yellow-900/20',
          text: 'text-yellow-400',
          header: 'text-yellow-300'
        }
      case 'error':
        return {
          border: 'border-red-600',
          bg: 'bg-red-900/20',
          text: 'text-red-400',
          header: 'text-red-300'
        }
      case 'critical':
        return {
          border: 'border-red-700',
          bg: 'bg-red-900/40',
          text: 'text-red-300',
          header: 'text-red-200'
        }
      case 'info':
      default:
        return {
          border: 'border-blue-600',
          bg: 'bg-blue-900/20',
          text: 'text-blue-400',
          header: 'text-blue-300'
        }
    }
  }

  /**
   * @brief Render popup actions
   */
  private renderActions(): string {
    const { actions = [] } = this.props
    
    if (actions.length === 0) {
      return `
        <div class="mt-6 text-center">
          <button
            data-popup-action="close"
            class="px-6 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg font-medium transition-colors"
          >
            Close
          </button>
        </div>
      `
    }
    
    return `
      <div class="mt-6 flex flex-wrap gap-3 justify-center">
        ${actions.map((action, index) => {
          let buttonClasses = 'px-4 py-2 rounded-lg font-medium transition-colors '
          
          switch (action.type) {
            case 'primary':
              buttonClasses += 'bg-green-600 hover:bg-green-500 text-black'
              break
            case 'danger':
              buttonClasses += 'bg-red-600 hover:bg-red-500 text-white'
              break
            case 'secondary':
            default:
              buttonClasses += 'bg-gray-600 hover:bg-gray-500 text-white'
              break
          }
          
          return `
            <button
              data-popup-action="${index}"
              class="${buttonClasses}"
            >
              ${action.label}
            </button>
          `
        }).join('')}
      </div>
    `
  }

  /**
   * @brief Render the popup component
   */
  public render(): string {
    const { 
      title, 
      message, 
      showCloseButton = true, 
      className = '',
      errorCode
    } = this.props
    
    const { isVisible, animationState } = this.state
    
    if (!isVisible && animationState === 'hidden') {
      return ''
    }
    
    const colors = this.getTypeColors()
    const icon = this.getTypeIcon()
    
    // Animation classes
    const overlayClasses = `
      fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4
      ${animationState === 'entering' ? 'opacity-0' : ''}
      ${animationState === 'visible' ? 'opacity-100' : ''}
      ${animationState === 'exiting' ? 'opacity-0' : ''}
      transition-opacity duration-300 ease-out
    `
    
    const popupClasses = `
      relative max-w-md w-full ${colors.bg} ${colors.border} border rounded-xl shadow-2xl
      transform transition-all duration-300 ease-out
      ${animationState === 'entering' ? 'scale-95 translate-y-4 opacity-0' : ''}
      ${animationState === 'visible' ? 'scale-100 translate-y-0 opacity-100' : ''}
      ${animationState === 'exiting' ? 'scale-95 translate-y-4 opacity-0' : ''}
      ${className}
    `
    
    return `
      <div class="${overlayClasses}" data-popup-overlay="true">
        <div class="${popupClasses}" data-popup-content="true">
          <!-- Close button -->
          ${showCloseButton ? `
            <button
              class="absolute top-4 right-4 text-gray-400 hover:text-gray-300 transition-colors"
              data-popup-action="close"
            >
              ✕
            </button>
          ` : ''}
          
          <div class="p-6">
            <!-- Header -->
            <div class="flex items-center space-x-3 mb-4">
              <div class="text-2xl">${icon}</div>
              <div>
                ${title ? `
                  <h3 class="text-lg font-bold ${colors.header}">${title}</h3>
                ` : ''}
                ${errorCode ? `
                  <p class="text-sm ${colors.text} opacity-75">Error Code: ${errorCode}</p>
                ` : ''}
              </div>
            </div>
            
            <!-- Message -->
            <div class="${colors.text} text-sm leading-relaxed">
              ${message}
            </div>
            
            <!-- Actions -->
            ${this.renderActions()}
          </div>
        </div>
      </div>
    `
  }

  /**
   * @brief Mount popup and set up event listeners
   */
  public mount(container: HTMLElement): void {
    // Create overlay element
    this.overlayElement = document.createElement('div')
    this.overlayElement.innerHTML = this.render()
    container.appendChild(this.overlayElement)
    
    this.popupElement = this.overlayElement.querySelector('[data-popup-content]') as HTMLElement
    
    this.setupEventListeners()
  }

  /**
   * @brief Set up event listeners
   */
  private setupEventListeners(): void {
    if (!this.overlayElement) return
    
    const { actions = [], closeOnOverlay = true } = this.props
    
    // Close on overlay click
    if (closeOnOverlay) {
      this.overlayElement.addEventListener('click', (event) => {
        if (event.target === this.overlayElement) {
          this.hide()
        }
      })
    }
    
    // Action buttons
    const actionButtons = this.overlayElement.querySelectorAll('[data-popup-action]')
    actionButtons.forEach(button => {
      button.addEventListener('click', (event) => {
        event.preventDefault()
        event.stopPropagation()
        
        const actionIndex = button.getAttribute('data-popup-action')
        
        if (actionIndex === 'close') {
          this.hide()
        } else {
          const index = parseInt(actionIndex || '0', 10)
          if (actions[index]) {
            actions[index].action()
          }
        }
      })
    })
    
    // ESC key to close
    document.addEventListener('keydown', this.handleKeyDown.bind(this))
  }

  /**
   * @brief Handle keyboard events
   */
  private handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.state.isVisible) {
      this.hide()
    }
  }

  /**
   * @brief Clean up event listeners
   */
  public unmount(): void {
    document.removeEventListener('keydown', this.handleKeyDown.bind(this))
    
    if (this.overlayElement && this.overlayElement.parentNode) {
      this.overlayElement.parentNode.removeChild(this.overlayElement)
    }
    
    this.overlayElement = null
    this.popupElement = null
  }
}

/**
 * @brief Utility functions for creating common popups
 */
export const PopupUtils = {
  /**
   * @brief Show error popup
   */
  showError: (message: string, errorCode?: number, actions?: PopupProps['actions']) => {
    const popup = new Popup({
      title: 'Error',
      message,
      type: 'error',
      errorCode,
      actions,
      closeOnOverlay: true
    })
    popup.show()
    return popup
  },

  /**
   * @brief Show critical error popup
   */
  showCriticalError: (message: string, errorCode?: number, actions?: PopupProps['actions']) => {
    const popup = new Popup({
      title: 'Critical Error',
      message,
      type: 'critical',
      errorCode,
      actions,
      closeOnOverlay: false,
      showCloseButton: false
    })
    popup.show()
    return popup
  },

  /**
   * @brief Show success popup
   */
  showSuccess: (message: string, actions?: PopupProps['actions']) => {
    const popup = new Popup({
      title: 'Success',
      message,
      type: 'success',
      actions,
      closeOnOverlay: true
    })
    popup.show()
    return popup
  },

  /**
   * @brief Show warning popup
   */
  showWarning: (message: string, actions?: PopupProps['actions']) => {
    const popup = new Popup({
      title: 'Warning',
      message,
      type: 'warning',
      actions,
      closeOnOverlay: true
    })
    popup.show()
    return popup
  },

  /**
   * @brief Show info popup
   */
  showInfo: (message: string, actions?: PopupProps['actions']) => {
    const popup = new Popup({
      title: 'Information',
      message,
      type: 'info',
      actions,
      closeOnOverlay: true
    })
    popup.show()
    return popup
  }
}
