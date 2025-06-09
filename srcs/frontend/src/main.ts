/**
 * @brief Application entry point for ft_transcendence frontend
 * 
 * @description Main entry point that initializes the application.
 * Phase B3 implementation: Complete UI Components testing (Button + Modal + Form)
 */

// Import global styles
import './index.css'

// Import assets (using public folder assets available in Vite)
import viteLogo from '/vite.svg'
import typescriptLogo from '/typescript.svg'

// Phase A3: Import Component base class
import { Component } from '@/components'

// Development imports (to be replaced in later phases)
import { setupCounter } from './counter'

// Phase B2.2: Import store tests and store instances
import { authStore, gameStore, uiStore, appStore } from '@/stores'

// Phase B3: Import UI Components
import { Button, Modal, Input, Label, Navigation } from '@/components'
import type { ButtonVariant, ButtonSize, ValidationState, NavigationLayout, NavigationItem } from '@/components'

/**
 * @brief Simple test component demonstrating Component base class
 */
interface TestComponentProps {
  title: string
  subtitle: string
}

interface TestComponentState {
  clickCount: number
}

class TestComponent extends Component<TestComponentProps, TestComponentState> {
  constructor(props: TestComponentProps) {
    super(props, { clickCount: 0 })
  }

  render(): string {
    const { title, subtitle } = this.props
    const { clickCount } = this.state

    return `
      <div class="bg-gray-800 border-2 border-green-500 rounded-lg p-6 max-w-md mx-auto mb-8">
        <h2 class="text-2xl font-bold text-green-500 mb-2">${title}</h2>
        <p class="text-green-300 mb-4">${subtitle}</p>
        <button 
          type="button"
          class="btn-game"
          id="test-button"
        >
          Component Test (${clickCount} clicks)
        </button>
        <p class="text-sm text-green-500 mt-2">✅ Component base class working!</p>
      </div>
    `
  }

  protected afterMount(): void {
    const button = this.element?.querySelector('#test-button')
    if (button) {
      this.addEventListener(button as HTMLElement, 'click', this.handleClick)
    }
  }

  private handleClick = (): void => {
    this.setState({ clickCount: this.state.clickCount + 1 })
  }
}

// Global modal instance for demo
let demoModal: Modal | null = null

/**
 * @brief Initialize Modal component demonstration
 * 
 * @param container - Container element to mount modal demo
 * 
 * @description Creates Modal component testing interface with open/close functionality,
 * backdrop handling, and proper cleanup demonstration.
 */
function initModalDemo(container: HTMLElement): void {
  console.log('🪟 Initializing Modal component demonstration...')

  // Create modal demo section
  const modalSection = document.createElement('div')
  modalSection.className = 'bg-gray-800 border-2 border-blue-500 rounded-lg p-4'
  modalSection.innerHTML = `
    <h4 class="text-lg font-semibold text-blue-300 mb-3">Modal Component Demo</h4>
    <div id="modal-controls" class="flex flex-wrap gap-3"></div>
    <div class="mt-3 text-sm text-blue-400">
      Modal features: Portal mounting, backdrop click, ESC key, focus management
    </div>
  `
  container.appendChild(modalSection)

  const controlsContainer = modalSection.querySelector('#modal-controls') as HTMLElement

  // Create "Open Modal" button
  const openModalButton = new Button({
    text: 'Open Demo Modal',
    variant: 'primary',
    onClick: () => openDemoModal()
  })
  openModalButton.mount(controlsContainer)

  // Create "Open Form Modal" button  
  const openFormModalButton = new Button({
    text: 'Open Form Modal',
    variant: 'game',
    onClick: () => openFormModal()
  })
  openFormModalButton.mount(controlsContainer)
}

/**
 * @brief Open demonstration modal with test content
 * 
 * @description Creates and displays a modal with sample content to test
 * modal functionality including backdrop clicks and ESC key handling.
 */
function openDemoModal(): void {
  if (demoModal) {
    demoModal.unmount()
  }

  demoModal = new Modal({
    isOpen: true,
    title: 'Demo Modal',
    size: 'md',
    onClose: () => {
      showFeedback('🪟 Modal closed via close button/backdrop/ESC', 'info')
      if (demoModal) {
        demoModal.unmount()
        demoModal = null
      }
    },
    children: `
      <div class="space-y-4">
        <p class="text-green-300">This is a demonstration modal!</p>
        <ul class="text-green-300 text-sm space-y-1">
          <li>✅ Portal mounted to document.body</li>
          <li>✅ Click backdrop to close</li>
          <li>✅ Press ESC to close</li>
          <li>✅ Focus trapped within modal</li>
        </ul>
        <div class="flex gap-2">
          <button type="button" class="btn-game" onclick="alert('Action button works!')">
            Action Button
          </button>
          <button type="button" class="btn-secondary" onclick="if(window.demoModal) window.demoModal.unmount()">
            Close Modal
          </button>
        </div>
      </div>
    `
  })

  // Mount to document.body (modal handles portal mounting)
  demoModal.mount(document.body)
  
  // Make modal accessible globally for demo buttons
  ;(window as any).demoModal = demoModal

  showFeedback('🪟 Modal opened - Test backdrop click, ESC key, or close button', 'info')
}

/**
 * @brief Open modal containing form demonstration
 * 
 * @description Creates modal with embedded form components to test
 * Input and Label components within modal context.
 */
function openFormModal(): void {
  if (demoModal) {
    demoModal.unmount()
  }

  demoModal = new Modal({
    isOpen: true,
    title: 'Form Components in Modal',
    size: 'lg',
    onClose: () => {
      showFeedback('📝 Form modal closed', 'info')
      if (demoModal) {
        demoModal.unmount()
        demoModal = null
      }
    },
    children: `
      <div class="space-y-4">
        <p class="text-green-300">Testing Input and Label components within modal:</p>
        <div id="modal-form-demo" class="space-y-4"></div>
      </div>
    `
  })

  demoModal.mount(document.body)
  
  // Add form components after modal mounts
  setTimeout(() => {
    const formContainer = document.querySelector('#modal-form-demo')
    if (formContainer) {
      initModalFormComponents(formContainer as HTMLElement)
    }
  }, 100)
}

/**
 * @brief Initialize form components within modal
 * 
 * @param container - Container for form components
 * 
 * @description Creates Input and Label components inside modal for testing
 * form component functionality in modal context.
 */
function initModalFormComponents(container: HTMLElement): void {
  // Simple controlled form state
  let formData = {
    username: '',
    email: ''
  }

  // Username field
  const usernameLabel = new Label({
    text: 'Username',
    htmlFor: 'modal-username',
    required: true
  })
  usernameLabel.mount(container)

  const usernameInput = new Input({
    id: 'modal-username',
    type: 'text',
    value: formData.username,
    placeholder: 'Enter username',
    required: true,
    onChange: (value: string) => {
      formData.username = value
      showFeedback(`📝 Username: "${value}"`, 'info')
    }
  })
  usernameInput.mount(container)

  // Email field with validation
  const emailLabel = new Label({
    text: 'Email',
    htmlFor: 'modal-email',
    required: true
  })
  emailLabel.mount(container)

  const emailInput = new Input({
    id: 'modal-email', 
    type: 'email',
    value: formData.email,
    placeholder: 'Enter email address',
    required: true,
    validationState: 'default',
    onChange: (value: string) => {
      formData.email = value
      // Simple email validation for demo
      const isValid = value.includes('@') && value.includes('.')
      const newValidationState: ValidationState = value === '' ? 'default' : 
                                                   isValid ? 'success' : 'error'
      
      // Update input with new validation state
      emailInput.updateProps({
        validationState: newValidationState,
        errorMessage: !isValid && value !== '' ? 'Please enter a valid email' : undefined,
        successMessage: isValid ? 'Valid email format' : undefined
      })
      
      showFeedback(`📧 Email: "${value}" (${isValid ? 'valid' : 'invalid'})`, isValid ? 'success' : 'warning')
    }
  })
  emailInput.mount(container)
}

/**
 * @brief Initialize Form components demonstration
 * 
 * @param container - Container element to mount navigation demo
 * 
 * @description Creates Navigation component testing interface with different
 * layouts, active states, and responsive behavior demonstrations.
 */
function initNavigationDemo(container: HTMLElement): void {
  console.log('🧭 Initializing Navigation component demonstration...')

  // Create navigation demo section
  const navSection = document.createElement('div')
  navSection.className = 'bg-gray-800 border-2 border-cyan-500 rounded-lg p-4'
  navSection.innerHTML = `
    <h4 class="text-lg font-semibold text-cyan-300 mb-3">Navigation Component Demo</h4>
    <div class="space-y-6">
      <!-- Horizontal Navigation -->
      <div class="bg-gray-700 rounded-lg p-4">
        <h5 class="text-md font-semibold text-cyan-200 mb-3">Horizontal Navigation</h5>
        <div id="horizontal-nav" class="mb-4"></div>
        <div class="flex gap-2">
          <button type="button" class="btn-game btn-sm" data-nav-action="home">Set Home Active</button>
          <button type="button" class="btn-game btn-sm" data-nav-action="game">Set Game Active</button>
          <button type="button" class="btn-game btn-sm" data-nav-action="profile">Set Profile Active</button>
        </div>
      </div>
      
      <!-- Vertical Navigation -->
      <div class="bg-gray-700 rounded-lg p-4">
        <h5 class="text-md font-semibold text-cyan-200 mb-3">Vertical Navigation</h5>
        <div id="vertical-nav" class="mb-4"></div>
        <div class="text-sm text-cyan-400">
          Try keyboard navigation: Tab, Arrow keys, Enter/Space
        </div>
      </div>
      
      <!-- Mobile Responsive Navigation -->
      <div class="bg-gray-700 rounded-lg p-4">
        <h5 class="text-md font-semibold text-cyan-200 mb-3">Mobile Responsive (resize window)</h5>
        <div id="mobile-nav" class="mb-4"></div>
        <div class="text-sm text-cyan-400">
          On mobile screens, navigation collapses to hamburger menu
        </div>
      </div>
    </div>
  `
  container.appendChild(navSection)

  // Initialize different navigation demonstrations
  initHorizontalNavigation()
  initVerticalNavigation()
  initMobileNavigation()
  
  // Set up navigation action buttons
  setupNavigationActions(navSection)
}

/**
 * @brief Initialize horizontal navigation demonstration
 * 
 * @description Creates horizontal navigation with main app sections.
 */
function initHorizontalNavigation(): void {
  const container = document.getElementById('horizontal-nav')
  if (!container) return

  const navItems: NavigationItem[] = [
    { id: 'home', text: 'Home', path: '/', icon: 'home' },
    { id: 'game', text: 'Game', path: '/game' },
    { id: 'tournament', text: 'Tournament', path: '/tournament' },
    { id: 'profile', text: 'Profile', path: '/profile' },
    { id: 'settings', text: 'Settings', path: '/settings' },
    { id: 'disabled', text: 'Disabled', path: '/disabled', disabled: true }
  ]

  // Store navigation instance globally for demo controls
  ;(window as any).horizontalNav = new Navigation({
    items: navItems,
    layout: 'horizontal',
    activeItem: 'home',
    collapsible: false,
    onItemClick: (item: NavigationItem) => {
      if (!item.disabled) {
        showFeedback(`🧭 Navigated to: ${item.text} (${item.path})`, 'info')
        ;(window as any).horizontalNav.setActiveItem(item.id)
      }
    }
  })

  ;(window as any).horizontalNav.mount(container)
}

/**
 * @brief Initialize vertical navigation demonstration
 * 
 * @description Creates vertical navigation suitable for sidebar layouts.
 */
function initVerticalNavigation(): void {
  const container = document.getElementById('vertical-nav')
  if (!container) return

  const sidebarItems: NavigationItem[] = [
    { id: 'dashboard', text: 'Dashboard', path: '/dashboard' },
    { id: 'games', text: 'My Games', path: '/games' },
    { id: 'friends', text: 'Friends', path: '/friends' },
    { id: 'achievements', text: 'Achievements', path: '/achievements' },
    { id: 'stats', text: 'Statistics', path: '/stats' }
  ]

  const verticalNav = new Navigation({
    items: sidebarItems,
    layout: 'vertical',
    activeItem: 'dashboard',
    collapsible: false,
    ariaLabel: 'Sidebar navigation',
    onItemClick: (item: NavigationItem) => {
      showFeedback(`📋 Sidebar navigation: ${item.text}`, 'info')
      verticalNav.setActiveItem(item.id)
    }
  })

  verticalNav.mount(container)
}

/**
 * @brief Initialize mobile responsive navigation demonstration
 * 
 * @description Creates responsive navigation that collapses on mobile screens.
 */
function initMobileNavigation(): void {
  const container = document.getElementById('mobile-nav')
  if (!container) return

  const mobileItems: NavigationItem[] = [
    { id: 'play', text: 'Play Now', path: '/play' },
    { id: 'leaderboard', text: 'Leaderboard', path: '/leaderboard' },
    { id: 'tournaments', text: 'Tournaments', path: '/tournaments' },
    { id: 'community', text: 'Community', path: '/community' },
    { id: 'help', text: 'Help', path: '/help' }
  ]

  const mobileNav = new Navigation({
    items: mobileItems,
    layout: 'horizontal',
    activeItem: 'play',
    collapsible: true, // Enables mobile hamburger menu
    ariaLabel: 'Mobile responsive navigation',
    onItemClick: (item: NavigationItem) => {
      showFeedback(`📱 Mobile nav: ${item.text} selected`, 'success')
      mobileNav.setActiveItem(item.id)
    }
  })

  mobileNav.mount(container)
}

/**
 * @brief Set up navigation action buttons
 * 
 * @param container - Container with navigation action buttons
 * 
 * @description Attaches event listeners to buttons that control navigation state.
 */
function setupNavigationActions(container: HTMLElement): void {
  const actionButtons = container.querySelectorAll('[data-nav-action]')
  
  actionButtons.forEach(button => {
    button.addEventListener('click', (event: Event) => {
      const target = event.target as HTMLElement
      const action = target.dataset.navAction
      
      if (action && (window as any).horizontalNav) {
        ;(window as any).horizontalNav.setActiveItem(action)
        showFeedback(`🎯 Set ${action} as active navigation item`, 'success')
      }
    })
  })
 * 
 * @param container - Container element to mount form demo
 * 
 * @description Creates comprehensive form component testing interface with
 * Input, Label components, validation states, and interactive examples.
 */
function initFormDemo(container: HTMLElement): void {
  console.log('📝 Initializing Form components demonstration...')

  // Create form demo section
  const formSection = document.createElement('div')
  formSection.className = 'bg-gray-800 border-2 border-purple-500 rounded-lg p-4'
  formSection.innerHTML = `
    <h4 class="text-lg font-semibold text-purple-300 mb-3">Form Components Demo</h4>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div id="form-inputs" class="space-y-4"></div>
      <div id="form-validation" class="space-y-4"></div>
    </div>
    <div class="mt-4 text-sm text-purple-400">
      Input + Label components with validation states, focus management, and accessibility
    </div>
  `
  container.appendChild(formSection)

  const inputsContainer = formSection.querySelector('#form-inputs') as HTMLElement
  const validationContainer = formSection.querySelector('#form-validation') as HTMLElement

  // Initialize basic form inputs
  initBasicFormInputs(inputsContainer)
  
  // Initialize validation examples
  initValidationExamples(validationContainer)
}

/**
 * @brief Initialize basic form input examples
 * 
 * @param container - Container for basic inputs
 * 
 * @description Creates basic Input and Label component examples showing
 * standard form field functionality.
 */
function initBasicFormInputs(container: HTMLElement): void {
  // Add section title
  const title = document.createElement('h5')
  title.textContent = 'Basic Form Fields'
  title.className = 'text-md font-semibold text-purple-300 mb-3'
  container.appendChild(title)

  // Controlled form state
  let basicFormData = {
    name: '',
    email: '',
    password: ''
  }

  // Name field
  const nameLabel = new Label({
    text: 'Full Name',
    htmlFor: 'demo-name',
    required: true
  })
  nameLabel.mount(container)

  const nameInput = new Input({
    id: 'demo-name',
    type: 'text', 
    value: basicFormData.name,
    placeholder: 'Enter your full name',
    required: true,
    onChange: (value: string) => {
      basicFormData.name = value
      showFeedback(`👤 Name updated: "${value}"`, 'info')
    }
  })
  nameInput.mount(container)

  // Email field
  const emailLabel = new Label({
    text: 'Email Address',
    htmlFor: 'demo-email'
  })
  emailLabel.mount(container)

  const emailInput = new Input({
    id: 'demo-email',
    type: 'email',
    value: basicFormData.email,
    placeholder: 'user@example.com',
    onChange: (value: string) => {
      basicFormData.email = value
      showFeedback(`📧 Email updated: "${value}"`, 'info')
    }
  })
  emailInput.mount(container)

  // Password field
  const passwordLabel = new Label({
    text: 'Password',
    htmlFor: 'demo-password',
    required: true
  })
  passwordLabel.mount(container)

  const passwordInput = new Input({
    id: 'demo-password',
    type: 'password',
    value: basicFormData.password,
    placeholder: 'Enter secure password',
    required: true,
    onChange: (value: string) => {
      basicFormData.password = value
      showFeedback(`🔐 Password updated (${value.length} chars)`, 'info')
    }
  })
  passwordInput.mount(container)
}

/**
 * @brief Initialize validation state examples
 * 
 * @param container - Container for validation examples
 * 
 * @description Creates Input components demonstrating different validation
 * states including error, success, and dynamic validation.
 */
function initValidationExamples(container: HTMLElement): void {
  // Add section title
  const title = document.createElement('h5')
  title.textContent = 'Validation States'
  title.className = 'text-md font-semibold text-purple-300 mb-3'
  container.appendChild(title)

  let validationData = {
    username: '',
    confirmEmail: ''
  }

  // Username with validation
  const usernameLabel = new Label({
    text: 'Username (min 3 chars)',
    htmlFor: 'validation-username',
    required: true
  })
  usernameLabel.mount(container)

  const usernameInput = new Input({
    id: 'validation-username',
    type: 'text',
    value: validationData.username,
    placeholder: 'Username validation demo',
    required: true,
    validationState: 'default',
    onChange: (value: string) => {
      validationData.username = value
      
      // Dynamic validation
      let state: ValidationState = 'default'
      let errorMessage: string | undefined
      let successMessage: string | undefined

      if (value.length > 0) {
        if (value.length < 3) {
          state = 'error'
          errorMessage = 'Username must be at least 3 characters'
        } else if (value.length >= 3) {
          state = 'success'
          successMessage = 'Username looks good!'
        }
      }

      usernameInput.updateProps({
        validationState: state,
        errorMessage,
        successMessage
      })

      showFeedback(`✅ Username validation: ${state}`, state === 'error' ? 'warning' : 'success')
    }
  })
  usernameInput.mount(container)

  // Email confirmation with validation
  const confirmEmailLabel = new Label({
    text: 'Email Confirmation',
    htmlFor: 'validation-confirm-email',
    required: true
  })
  confirmEmailLabel.mount(container)

  const confirmEmailInput = new Input({
    id: 'validation-confirm-email',
    type: 'email',
    value: validationData.confirmEmail,
    placeholder: 'test@example.com',
    required: true,
    validationState: 'default',
    onChange: (value: string) => {
      validationData.confirmEmail = value
      
      // Email format validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      let state: ValidationState = 'default'
      let errorMessage: string | undefined
      let successMessage: string | undefined

      if (value.length > 0) {
        if (!emailRegex.test(value)) {
          state = 'error'
          errorMessage = 'Please enter a valid email format'
        } else {
          state = 'success'
          successMessage = 'Email format is valid'
        }
      }

      confirmEmailInput.updateProps({
        validationState: state,
        errorMessage,
        successMessage
      })

      showFeedback(`📧 Email validation: ${state}`, state === 'error' ? 'warning' : 'success')
    }
  })
  confirmEmailInput.mount(container)

  // Add validation demo buttons
  const buttonContainer = document.createElement('div')
  buttonContainer.className = 'flex gap-2 mt-4'
  container.appendChild(buttonContainer)

  const setErrorButton = new Button({
    text: 'Trigger Error',
    variant: 'danger',
    size: 'sm',
    onClick: () => {
      usernameInput.updateProps({
        validationState: 'error',
        errorMessage: 'Demo error message triggered'
      })
      showFeedback('❌ Error state triggered on username field', 'warning')
    }
  })
  setErrorButton.mount(buttonContainer)

  const setSuccessButton = new Button({
    text: 'Trigger Success',
    variant: 'game',
    size: 'sm', 
    onClick: () => {
      confirmEmailInput.updateProps({
        validationState: 'success',
        successMessage: 'Demo success message triggered'
      })
      showFeedback('✅ Success state triggered on email field', 'success')
    }
  })
  setSuccessButton.mount(buttonContainer)
}

/**
 * @brief Initialize Button component demonstrations
 * 
 * @param container - Container element to mount buttons
 * 
 * @description Creates multiple Button instances showcasing different variants,
 * sizes, and states for testing and demonstration purposes.
 */
function initButtonDemo(container: HTMLElement): void {
  console.log('🔘 Initializing Button component demonstrations...')

  // Clear container and create button demo section
  const buttonSection = document.createElement('div')
  buttonSection.className = 'space-y-6'
  buttonSection.innerHTML = `
    <div class="space-y-6">
      <h3 class="text-xl font-bold text-green-400 mb-4">UI Components Demo - Phase B3</h3>
      
      <!-- Button Variants Section -->
      <div class="bg-gray-800 border-2 border-green-500 rounded-lg p-4">
        <h4 class="text-lg font-semibold text-green-300 mb-3">Button Variants</h4>
        <div id="button-variants" class="flex flex-wrap gap-3"></div>
      </div>
      
      <!-- Button Sizes Section -->
      <div class="bg-gray-800 border-2 border-blue-500 rounded-lg p-4">
        <h4 class="text-lg font-semibold text-blue-300 mb-3">Button Sizes</h4>
        <div id="button-sizes" class="flex flex-wrap items-center gap-3"></div>
      </div>
      
      <!-- Button States Section -->
      <div class="bg-gray-800 border-2 border-purple-500 rounded-lg p-4">
        <h4 class="text-lg font-semibold text-purple-300 mb-3">Button States</h4>
        <div id="button-states" class="flex flex-wrap gap-3"></div>
      </div>
      
      <!-- Interactive Demo Section -->
      <div class="bg-gray-800 border-2 border-yellow-500 rounded-lg p-4">
        <h4 class="text-lg font-semibold text-yellow-300 mb-3">Interactive Demo</h4>
        <div id="button-interactive" class="space-y-3"></div>
        <div id="button-feedback" class="mt-3 p-2 bg-gray-700 rounded text-green-300 text-sm min-h-[2rem]">
          Click any button to see feedback here...
        </div>
      </div>
    </div>
  `
  container.appendChild(buttonSection)

  // Initialize different button demonstrations
  initButtonVariants()
  initButtonSizes()
  initButtonStates()
  initInteractiveDemo()
}

/**
 * @brief Create button variant demonstrations
 * 
 * @description Showcases all available button variants with proper styling.
 */
function initButtonVariants(): void {
  const container = document.getElementById('button-variants')
  if (!container) return

  const variants: ButtonVariant[] = ['primary', 'game', 'secondary', 'danger']
  
  variants.forEach(variant => {
    const button = new Button({
      text: `${variant.charAt(0).toUpperCase() + variant.slice(1)} Button`,
      variant,
      onClick: () => showFeedback(`${variant} button clicked!`)
    })
    
    button.mount(container)
  })
}

/**
 * @brief Create button size demonstrations
 * 
 * @description Showcases all available button sizes using primary variant.
 */
function initButtonSizes(): void {
  const container = document.getElementById('button-sizes')
  if (!container) return

  const sizes: ButtonSize[] = ['sm', 'md', 'lg']
  
  sizes.forEach(size => {
    const button = new Button({
      text: `Size ${size.toUpperCase()}`,
      variant: 'primary',
      size,
      onClick: () => showFeedback(`${size} size button clicked!`)
    })
    
    button.mount(container)
  })
}

/**
 * @brief Create button state demonstrations
 * 
 * @description Showcases disabled and loading button states.
 */
function initButtonStates(): void {
  const container = document.getElementById('button-states')
  if (!container) return

  // Disabled button
  const disabledButton = new Button({
    text: 'Disabled Button',
    variant: 'secondary',
    disabled: true,
    onClick: () => showFeedback('This should not be called')
  })
  disabledButton.mount(container)

  // Loading button
  const loadingButton = new Button({
    text: 'Loading Button', 
    variant: 'primary',
    loading: true,
    onClick: () => showFeedback('This should not be called')
  })
  loadingButton.mount(container)

  // Normal button for comparison
  const normalButton = new Button({
    text: 'Normal Button',
    variant: 'game',
    onClick: () => showFeedback('Normal button clicked!')
  })
  normalButton.mount(container)
}

/**
 * @brief Create interactive button demonstrations
 * 
 * @description Showcases advanced button features and real-world usage scenarios.
 */
function initInteractiveDemo(): void {
  const container = document.getElementById('button-interactive')
  if (!container) return

  // Create wrapper for first row
  const row1 = document.createElement('div')
  row1.className = 'flex flex-wrap gap-3'
  container.appendChild(row1)

  // Action buttons
  const actionButton = new Button({
    text: 'Start Game',
    variant: 'primary',
    size: 'lg',
    ariaLabel: 'Start a new Pong game',
    onClick: () => showFeedback('🎮 Starting new game...', 'success')
  })
  actionButton.mount(row1)

  const deleteButton = new Button({
    text: 'Delete Save',
    variant: 'danger',
    onClick: () => showFeedback('⚠️ Save file deleted!', 'warning')
  })
  deleteButton.mount(row1)

  // Create wrapper for second row
  const row2 = document.createElement('div')
  row2.className = 'flex flex-wrap gap-3 mt-3'
  container.appendChild(row2)

  // Toggle loading demo
  let isLoading = false
  const loadingDemoButton = new Button({
    text: 'Toggle Loading',
    variant: 'game',
    onClick: () => {
      isLoading = !isLoading
      
      // Create new button with updated state
      row2.innerHTML = ''
      const newButton = new Button({
        text: isLoading ? 'Processing...' : 'Toggle Loading',
        variant: 'game',
        loading: isLoading,
        onClick: () => {
          setTimeout(() => {
            isLoading = false
            showFeedback('✅ Loading completed!')
            initInteractiveDemo() // Refresh demo
          }, 2000)
        }
      })
      newButton.mount(row2)
      
      if (isLoading) {
        showFeedback('⏳ Loading state activated (will auto-complete in 2s)', 'info')
      }
    }
  })
  loadingDemoButton.mount(row2)
}

/**
 * @brief Show user feedback for button interactions
 * 
 * @param message - Feedback message to display
 * @param type - Message type for styling
 * 
 * @description Updates feedback area with button interaction results.
 */
function showFeedback(message: string, type: 'info' | 'success' | 'warning' = 'info'): void {
  const feedbackElement = document.getElementById('button-feedback')
  if (!feedbackElement) return

  const colors = {
    info: 'text-blue-300',
    success: 'text-green-300', 
    warning: 'text-yellow-300'
  }

  feedbackElement.textContent = message
  feedbackElement.className = `mt-3 p-2 bg-gray-700 rounded text-sm min-h-[2rem] ${colors[type]}`
  
  console.log(`🔘 UI Component feedback: ${message}`)
}

/**
 * @brief Initialize application
 * 
 * @description Bootstrap the application with all necessary systems.
 * Phase B3: Complete UI Components testing (Button + Modal + Form).
 */
async function initApp(): Promise<void> {
  const appElement = document.querySelector<HTMLDivElement>('#app')
  
  if (!appElement) {
    console.error('App element not found')
    return
  }

  // Set up main application layout
  appElement.innerHTML = `
    <div class="min-h-screen bg-gray-900 text-green-400 font-mono">
      <div class="container mx-auto px-4 py-8 text-center">
        <!-- Logo Section -->
        <div class="flex justify-center items-center gap-8 mb-8">
          <a href="https://vite.dev" target="_blank" class="hover:opacity-80 transition-opacity">
            <img src="${viteLogo}" class="w-24 h-24" alt="Vite logo" />
          </a>
          <a href="https://www.typescriptlang.org/" target="_blank" class="hover:opacity-80 transition-opacity">
            <img src="${typescriptLogo}" class="w-24 h-24" alt="TypeScript logo" />
          </a>
        </div>
        
        <!-- Main Title -->
        <h1 class="text-6xl font-bold mb-4 text-green-400" style="text-shadow: 0 0 10px currentColor;">
          ft_transcendence
        </h1>
        
        <!-- Subtitle -->
        <p class="text-xl text-green-300 mb-8">
          The Ultimate Pong Experience
        </p>
        
        <!-- Component Test Container -->
        <div id="component-test"></div>
        
        <!-- Interactive Counter Card -->
        <div class="bg-gray-800 border-2 border-green-400 rounded-lg p-6 max-w-md mx-auto mb-8">
          <button 
            id="counter" 
            type="button"
            class="btn-primary"
          ></button>
        </div>
        
        <!-- Store Test Button -->
        <div class="bg-gray-800 border-2 border-purple-400 rounded-lg p-6 max-w-md mx-auto mb-8">
          <button 
            id="store-test"
            type="button"
            class="btn-game"
          >
            Run Store Tests
          </button>
          <p class="text-sm text-purple-400 mt-2">Click to test all store implementations</p>
        </div>
        
        <!-- Phase B3 UI Components Demo Container -->
        <div id="ui-components-demo" class="max-w-6xl mx-auto mb-8"></div>
        
        <!-- Navigation Demo Container -->
        <div id="navigation-demo" class="max-w-6xl mx-auto mb-8"></div>
        
        <!-- Modal Demo Container -->
        <div id="modal-demo" class="max-w-4xl mx-auto mb-8 space-y-6"></div>
        
        <!-- Form Demo Container -->
        <div id="form-demo" class="max-w-4xl mx-auto mb-8"></div>
        
        <!-- Development Status -->
        <div class="text-green-300 space-y-2">
          <p class="text-lg font-semibold">🎯 Phase B3: Complete UI Components!</p>
          <p class="text-base">✅ Button Component with variants, sizes, states</p>
          <p class="text-base">✅ Modal Component with portal mounting & accessibility</p>
          <p class="text-base">✅ Input Component with validation states</p>
          <p class="text-base">✅ Label Component with proper associations</p>
          <p class="text-base">✅ Navigation Component with responsive layouts</p>
          <p class="text-base">⏭️  Next: Phase C1 - i18n Core System</p>
        </div>
        
        <!-- Console Tip -->
        <div class="mt-8 text-sm text-cyan-400 bg-gray-800 border border-cyan-400 rounded p-4 max-w-2xl mx-auto">
          <p class="font-semibold mb-2">🖥️ UI Component Testing:</p>
          <p>• Test all Button variants and states above</p>
          <p>• Open modals to test portal mounting & focus</p>
          <p>• Try form inputs with validation</p>
          <p>• Test Navigation layouts & responsive behavior</p>
          <p>• Check accessibility with keyboard navigation</p>
        </div>
        
        <!-- Version Info -->
        <div class="mt-8 text-sm text-green-500 border-t border-green-800 pt-4">
          <p>Frontend Development Phase B3 | Complete UI Components System</p>
        </div>
      </div>
    </div>
  `

  // Initialize Component Test
  const testContainer = document.getElementById('component-test')
  if (testContainer) {
    const testComponent = new TestComponent({
      title: 'Component Base Class Test',
      subtitle: 'Demonstrating TypeScript component system'
    })
    testComponent.mount(testContainer)
  }

  // Set up the interactive counter
  const counterButton = document.querySelector<HTMLButtonElement>('#counter')
  if (counterButton) {
    setupCounter(counterButton)
  }

  // Set up store test button
  const storeTestButton = document.querySelector<HTMLButtonElement>('#store-test')
  if (storeTestButton) {
    storeTestButton.addEventListener('click', () => {
      console.log('\n🧪 Starting Store Tests...')
      
      console.log('\n📊 Store State Examples:')
      console.log('Auth Store:', authStore.getState())
      console.log('Game Store:', gameStore.getState())
      console.log('UI Store:', uiStore.getState())
      console.log('App Store:', appStore.getState())
    })
  }

  // Initialize all UI component demos
  const uiDemoContainer = document.getElementById('ui-components-demo')
  const navigationDemoContainer = document.getElementById('navigation-demo')
  const modalDemoContainer = document.getElementById('modal-demo')
  const formDemoContainer = document.getElementById('form-demo')

  if (uiDemoContainer) {
    initButtonDemo(uiDemoContainer)
  }
  
  if (navigationDemoContainer) {
    initNavigationDemo(navigationDemoContainer)
  }
  
  if (modalDemoContainer) {
    initModalDemo(modalDemoContainer)
  }
  
  if (formDemoContainer) {
    initFormDemo(formDemoContainer)
  }

  console.log('✅ ft_transcendence frontend initialized - Phase B3 Complete')
  console.log('✅ UI Components: Button, Modal, Input, Label, Navigation ready')
  console.log('✅ Complete state management system ready')
  console.log('✅ Testing framework ready')
  console.log('🧭 Router supports: route registration, navigation, parameters, back/forward')
  console.log('🎨 UI Components: Test all variants, validation, modal & navigation functionality')
}

/**
 * @brief Handle application errors
 * 
 * @param error - Error that occurred during initialization
 */
function handleAppError(error: Error): void {
  console.error('❌ Failed to initialize ft_transcendence:', error)
  
  const appElement = document.querySelector<HTMLDivElement>('#app')
  if (appElement) {
    appElement.innerHTML = `
      <div class="min-h-screen bg-red-900 text-red-100 font-mono flex items-center justify-center">
        <div class="text-center">
          <h1 class="text-4xl font-bold mb-4">Application Error</h1>
          <p class="text-lg mb-4">Failed to initialize ft_transcendence</p>
          <p class="text-sm opacity-75">${error.message}</p>
        </div>
      </div>
    `
  }
}

// Initialize app when DOM is ready with error handling
document.addEventListener('DOMContentLoaded', () => {
  initApp().catch(handleAppError)
})