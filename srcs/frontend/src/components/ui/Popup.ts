/**
 * @brief Simple Popup component for ft_transcendence
 * 
 * @description Minimal popup component for displaying messages.
 * Can be closed with X button or by clicking outside.
 */

/**
 * @brief Simple Popup class
 * 
 * @description Displays a message in a popup overlay that can be closed.
 */
export class Popup {
  private overlayElement: HTMLElement | null = null
  private message: string

  constructor(message: string) {
    this.message = message
  }

  /**
   * @brief Show the popup
   */
  public show(): void {
    // Create overlay
    this.overlayElement = document.createElement('div')
    this.overlayElement.className = 'fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 opacity-0 transition-opacity duration-300'
    
    // Create popup content
    this.overlayElement.innerHTML = `
      <div class="relative max-w-md w-full bg-blue-900/20 border border-blue-600 rounded-xl shadow-2xl transform scale-95 transition-all duration-300">
        <!-- Close button -->
        <button
          class="absolute top-4 right-4 text-gray-400 hover:text-gray-300 transition-colors text-xl"
          data-popup-close="true"
        >
          ✕
        </button>
        
        <div class="p-6">
          <!-- Message -->
          <div class="text-blue-400 text-sm leading-relaxed pr-8">
            ${this.message}
          </div>
        </div>
      </div>
    `
    
    // Add to DOM
    document.body.appendChild(this.overlayElement)
    
    // Setup event listeners
    this.setupEventListeners()
    
    // Trigger animation
    setTimeout(() => {
      if (this.overlayElement) {
        this.overlayElement.style.opacity = '1'
        const popupContent = this.overlayElement.querySelector('div > div')
        if (popupContent) {
          (popupContent as HTMLElement).style.transform = 'scale(1)'
        }
      }
    }, 10)
  }

  /**
   * @brief Hide the popup
   */
  public hide(): void {
    if (!this.overlayElement) return
    
    // Start exit animation
    this.overlayElement.style.opacity = '0'
    const popupContent = this.overlayElement.querySelector('div > div')
    if (popupContent) {
      (popupContent as HTMLElement).style.transform = 'scale(0.95)'
    }
    
    // Remove from DOM after animation
    setTimeout(() => {
      if (this.overlayElement && this.overlayElement.parentNode) {
        this.overlayElement.parentNode.removeChild(this.overlayElement)
        this.overlayElement = null
      }
    }, 300)
  }

  /**
   * @brief Setup event listeners
   */
  private setupEventListeners(): void {
    if (!this.overlayElement) return
    
    // Close on overlay click
    this.overlayElement.addEventListener('click', (event) => {
      if (event.target === this.overlayElement) {
        this.hide()
      }
    })
    
    // Close button
    const closeButton = this.overlayElement.querySelector('[data-popup-close]')
    if (closeButton) {
      closeButton.addEventListener('click', () => {
        this.hide()
      })
    }
    
    // ESC key to close
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        this.hide()
        document.removeEventListener('keydown', handleKeyDown)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
  }
}

/**
 * @brief Simple utility function to show a popup
 */
export const showPopup = (message: string): Popup => {
  const popup = new Popup(message)
  popup.show()
  return popup
}
