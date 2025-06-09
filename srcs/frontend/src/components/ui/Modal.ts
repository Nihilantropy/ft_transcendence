/**
 * @brief Gaming-themed Modal component for ft_transcendence
 * 
 * @description Reusable modal dialog component with backdrop, focus management,
 * and accessibility features. Extends base Component class with portal mounting
 * to document.body for proper z-index layering.
 * 
 * Phase B3.2 implementation - Modal Component
 * 
 * FILE: src/components/ui/Modal.ts
 */

import { Component } from '../base/Component'

/**
 * @brief Modal size variants
 * 
 * @description Available modal sizes for different content types.
 */
export type ModalSize = 'sm' | 'md' | 'lg'

/**
 * @brief Modal component properties interface
 * 
 * @description Type-safe props for Modal component configuration.
 */
export interface ModalProps {
  /** Whether modal is currently visible */
  isOpen: boolean
  
  /** Function to call when modal should be closed */
  onClose: () => void
  
  /** Optional modal title displayed in header */
  title?: string
  
  /** Modal content as HTML string */
  children: string
  
  /** Size variant for modal width (default: 'md') */
  size?: ModalSize
  
  /** Whether clicking backdrop closes modal (default: true) */
  closeOnBackdrop?: boolean
  
  /** Whether ESC key closes modal (default: true) */
  closeOnEscape?: boolean
  
  /** Whether to show X close button in header (default: true) */
  showCloseButton?: boolean
  
  /** Additional CSS classes for modal content */
  className?: string
  
  /** Accessibility label for modal */
  ariaLabel?: string
}

/**
 * @brief Modal component internal state
 * 
 * @description Internal state for modal animations and focus management.
 */
export interface ModalState {
  /** Whether modal is currently animating open/close */
  isAnimating: boolean
  
  /** Previously focused element to restore focus on close */
  focusedBeforeOpen: HTMLElement | null
  
  /** Whether component has been mounted to portal */
  isMounted: boolean
}

/**
 * @brief Gaming-themed Modal component class
 * 
 * @description Implements accessible modal dialog with portal mounting,
 * focus management, and gaming aesthetics. Handles backdrop clicks,
 * ESC key, and proper cleanup.
 */
export class Modal extends Component<ModalProps, ModalState> {
  /** Portal container mounted to document.body */
  private portalContainer: HTMLElement | null = null
  
  /** Set of focusable elements within modal */
  private focusableElements: HTMLElement[] = []
  
  /** Original body overflow style for restoration */
  private originalBodyOverflow: string = ''

  /**
   * @brief Initialize Modal component
   * 
   * @param props - Modal configuration properties
   * 
   * @description Creates modal instance with default state and validates props.
   */
  constructor(props: ModalProps) {
    super(props, {
      isAnimating: false,
      focusedBeforeOpen: null,
      isMounted: false
    })
    
    // Validate required props
    if (typeof props.onClose !== 'function') {
      throw new Error('Modal component requires onClose function')
    }
  }

  /**
   * @brief Render modal to HTML string
   * 
   * @return HTML string representation of modal
   * 
   * @description Generates modal HTML with backdrop, content area, and accessibility attributes.
   * Only renders if modal is open to avoid unnecessary DOM elements.
   */
  render(): string {
    const { isOpen } = this.props
    
    // Don't render anything if modal is closed
    if (!isOpen) {
      return '<div style="display: none;"></div>'
    }

    const {
      title,
      children,
      size = 'md',
      showCloseButton = true,
      className = '',
      ariaLabel
    } = this.props

    const { isAnimating } = this.state

    // Build CSS classes for modal elements
    const overlayClasses = this.getOverlayClasses(isAnimating)
    const containerClasses = this.getContainerClasses()
    const contentClasses = this.getContentClasses(size, className)

    // Build modal header if title or close button is needed
    const header = this.buildHeader(title, showCloseButton)
    
    // Build modal content area
    const content = this.buildContent(children)

    return `
      <div 
        class="${overlayClasses}"
        role="dialog"
        aria-modal="true"
        ${ariaLabel ? `aria-label="${ariaLabel}"` : ''}
        ${title ? `aria-labelledby="modal-title"` : ''}
        data-modal-overlay
      >
        <div class="${containerClasses}">
          <div class="${contentClasses}" data-modal-content>
            ${header}
            ${content}
          </div>
        </div>
      </div>
    `
  }

  /**
   * @brief Custom mount to portal container
   * 
   * @param parent - Parent element (ignored, mounts to body)
   * 
   * @description Overrides default mount to use portal mounting to document.body.
   * Creates portal container and manages body scroll lock.
   */
  mount(parent: HTMLElement): void {
    if (!this.props.isOpen) {
      return // Don't mount if modal is closed
    }

    // Create portal container if it doesn't exist
    if (!this.portalContainer) {
      this.portalContainer = document.createElement('div')
      this.portalContainer.className = 'modal-portal'
      document.body.appendChild(this.portalContainer)
    }

    // Store currently focused element
    this.setState({
      focusedBeforeOpen: document.activeElement as HTMLElement,
      isMounted: true
    })

    // Lock body scroll
    this.lockBodyScroll()

    // Mount to portal container using base Component mount
    super.mount(this.portalContainer)

    // Start open animation
    requestAnimationFrame(() => {
      this.setState({ isAnimating: true })
    })
  }

  /**
   * @brief Custom unmount with portal cleanup
   * 
   * @description Overrides default unmount to handle portal cleanup,
   * focus restoration, and body scroll unlock.
   */
  unmount(): void {
    // Restore focus before unmounting
    this.restoreFocus()
    
    // Unlock body scroll
    this.unlockBodyScroll()

    // Unmount using base Component unmount
    super.unmount()

    // Clean up portal container
    if (this.portalContainer && this.portalContainer.parentNode) {
      this.portalContainer.parentNode.removeChild(this.portalContainer)
      this.portalContainer = null
    }

    this.setState({ 
      isMounted: false,
      isAnimating: false,
      focusedBeforeOpen: null
    })
  }

  /**
   * @brief Update modal visibility based on props
   * 
   * @param newProps - New props to apply
   * 
   * @description Handles modal open/close state changes by mounting/unmounting.
   */
  updateProps(newProps: Partial<ModalProps>): void {
    const wasOpen = this.props.isOpen
    const willBeOpen = newProps.isOpen !== undefined ? newProps.isOpen : wasOpen

    // Update props
    super.updateProps(newProps)

    // Handle state changes
    if (!wasOpen && willBeOpen) {
      // Modal opening - need to mount
      this.mount(document.body)
    } else if (wasOpen && !willBeOpen) {
      // Modal closing - start close animation then unmount
      this.startCloseAnimation()
    }
  }

  /**
   * @brief Set up event listeners after mount
   * 
   * @description Attaches event listeners for backdrop clicks, ESC key,
   * and focus management. Sets up focus trap within modal.
   */
  protected afterMount(): void {
    if (!this.element) return

    // Set up focus trap
    this.setupFocusTrap()

    // Add event listeners for modal interactions
    this.addEventListener(document as unknown as HTMLElement, 'keydown', this.handleKeyDown)
    
    // Add backdrop click listener to overlay
    const overlay = this.element.querySelector('[data-modal-overlay]') as HTMLElement
    if (overlay) {
      this.addEventListener(overlay, 'click', this.handleBackdropClick)
    }

    // Add close button listener
    const closeButton = this.element.querySelector('[data-modal-close]') as HTMLElement
    if (closeButton) {
      this.addEventListener(closeButton, 'click', this.handleCloseClick)
    }

    // Focus first focusable element
    this.focusFirstElement()
  }

  /**
   * @brief Handle keyboard events for modal
   * 
   * @param event - Keyboard event
   * 
   * @description Handles ESC key for closing and Tab key for focus trapping.
   */
  private handleKeyDown = (event: Event): void => {
    const { closeOnEscape = true } = this.props
    const keyEvent = event as KeyboardEvent

    switch (keyEvent.key) {
      case 'Escape':
        if (closeOnEscape) {
          event.preventDefault()
          this.closeModal()
        }
        break

      case 'Tab':
        this.handleTabKey(keyEvent)
        break
    }
  }

  /**
   * @brief Handle backdrop click events
   * 
   * @param event - Mouse click event
   * 
   * @description Closes modal if backdrop is clicked and closeOnBackdrop is enabled.
   */
  private handleBackdropClick = (event: Event): void => {
    const { closeOnBackdrop = true } = this.props
    
    if (!closeOnBackdrop) return

    // Only close if clicking the backdrop, not the content
    const target = event.target as HTMLElement
    const isBackdrop = target.hasAttribute('data-modal-overlay')
    
    if (isBackdrop) {
      event.preventDefault()
      this.closeModal()
    }
  }

  /**
   * @brief Handle close button clicks
   * 
   * @param event - Mouse click event
   * 
   * @description Closes modal when close button is clicked.
   */
  private handleCloseClick = (event: Event): void => {
    event.preventDefault()
    this.closeModal()
  }

  /**
   * @brief Handle Tab key for focus trapping
   * 
   * @param event - Keyboard event
   * 
   * @description Traps focus within modal by cycling through focusable elements.
   */
  private handleTabKey(event: KeyboardEvent): void {
    if (this.focusableElements.length === 0) return

    const firstElement = this.focusableElements[0]
    const lastElement = this.focusableElements[this.focusableElements.length - 1]
    const activeElement = document.activeElement

    if (event.shiftKey) {
      // Shift + Tab - moving backwards
      if (activeElement === firstElement) {
        event.preventDefault()
        lastElement.focus()
      }
    } else {
      // Tab - moving forwards
      if (activeElement === lastElement) {
        event.preventDefault()
        firstElement.focus()
      }
    }
  }

  /**
   * @brief Close modal with proper cleanup
   * 
   * @description Calls onClose prop function to notify parent component.
   */
  private closeModal(): void {
    try {
      this.props.onClose()
    } catch (error) {
      console.error('Modal onClose handler error:', error)
    }
  }

  /**
   * @brief Start close animation before unmounting
   * 
   * @description Triggers close animation then unmounts after animation completes.
   */
  private startCloseAnimation(): void {
    this.setState({ isAnimating: false })
    
    // Unmount after animation completes
    setTimeout(() => {
      this.unmount()
    }, 200) // Match CSS transition duration
  }

  /**
   * @brief Set up focus trap within modal
   * 
   * @description Finds all focusable elements within modal for focus management.
   */
  private setupFocusTrap(): void {
    if (!this.element) return

    // Find all focusable elements within modal
    const focusableSelector = [
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      'a[href]',
      '[tabindex]:not([tabindex="-1"]):not([disabled])'
    ].join(', ')

    this.focusableElements = Array.from(
      this.element.querySelectorAll(focusableSelector)
    ) as HTMLElement[]
  }

  /**
   * @brief Focus first focusable element in modal
   * 
   * @description Sets focus to first interactive element or modal itself.
   */
  private focusFirstElement(): void {
    if (this.focusableElements.length > 0) {
      this.focusableElements[0].focus()
    } else if (this.element) {
      // Focus modal itself if no focusable elements
      (this.element as HTMLElement).focus()
    }
  }

  /**
   * @brief Restore focus to previously focused element
   * 
   * @description Restores focus to element that was focused before modal opened.
   */
  private restoreFocus(): void {
    const { focusedBeforeOpen } = this.state
    
    if (focusedBeforeOpen && document.contains(focusedBeforeOpen)) {
      try {
        focusedBeforeOpen.focus()
      } catch (error) {
        // Fallback to body if focus restoration fails
        document.body.focus()
      }
    }
  }

  /**
   * @brief Lock body scroll when modal is open
   * 
   * @description Prevents background scrolling while modal is displayed.
   */
  private lockBodyScroll(): void {
    this.originalBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }

  /**
   * @brief Unlock body scroll when modal closes
   * 
   * @description Restores original body overflow behavior.
   */
  private unlockBodyScroll(): void {
    document.body.style.overflow = this.originalBodyOverflow
  }

  /**
   * @brief Get overlay CSS classes
   * 
   * @param isAnimating - Whether modal is currently animating
   * @return Overlay CSS classes string
   * 
   * @description Returns backdrop overlay classes with animation states.
   */
  private getOverlayClasses(isAnimating: boolean): string {
    const baseClasses = 'fixed inset-0 z-50 flex items-center justify-center p-4'
    const backdropClasses = 'bg-black bg-opacity-75'
    const animationClasses = isAnimating 
      ? 'transition-opacity duration-200 opacity-100' 
      : 'transition-opacity duration-200 opacity-0'

    return `${baseClasses} ${backdropClasses} ${animationClasses}`
  }

  /**
   * @brief Get container CSS classes
   * 
   * @return Container CSS classes string
   * 
   * @description Returns modal container positioning classes.
   */
  private getContainerClasses(): string {
    return 'relative w-full flex items-center justify-center'
  }

  /**
   * @brief Get content CSS classes
   * 
   * @param size - Modal size variant
   * @param className - Additional custom classes
   * @return Content CSS classes string
   * 
   * @description Returns modal content area classes including size variants.
   */
  private getContentClasses(size: ModalSize, className: string): string {
    const baseClasses = 'bg-gray-800 border-2 border-green-500 rounded-lg shadow-2xl relative'
    const sizeClasses = this.getSizeClasses(size)
    const animationClasses = 'transform transition-all duration-200'

    return `${baseClasses} ${sizeClasses} ${animationClasses} ${className}`.trim()
  }

  /**
   * @brief Get size-specific CSS classes
   * 
   * @param size - Modal size variant
   * @return Size CSS classes string
   * 
   * @description Maps modal sizes to their corresponding width classes.
   */
  private getSizeClasses(size: ModalSize): string {
    const sizes = {
      sm: 'max-w-sm',
      md: 'max-w-lg',
      lg: 'max-w-4xl'
    }

    return sizes[size] || sizes.md
  }

  /**
   * @brief Build modal header HTML
   * 
   * @param title - Optional modal title
   * @param showCloseButton - Whether to show close button
   * @return Header HTML string
   * 
   * @description Constructs modal header with title and close button.
   */
  private buildHeader(title?: string, showCloseButton: boolean = true): string {
    if (!title && !showCloseButton) {
      return ''
    }

    const titleHtml = title 
      ? `<h2 id="modal-title" class="text-xl font-bold text-green-400">${title}</h2>`
      : ''

    const closeButtonHtml = showCloseButton
      ? `
        <button 
          type="button"
          class="text-green-400 hover:text-green-300 transition-colors duration-200"
          data-modal-close
          aria-label="Close modal"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      `
      : ''

    return `
      <div class="flex items-center justify-between p-6 border-b border-gray-700">
        ${titleHtml}
        ${closeButtonHtml}
      </div>
    `
  }

  /**
   * @brief Build modal content HTML
   * 
   * @param children - Modal content string
   * @return Content HTML string
   * 
   * @description Constructs modal content area with proper padding.
   */
  private buildContent(children: string): string {
    return `
      <div class="p-6 text-green-300">
        ${children}
      </div>
    `
  }
}