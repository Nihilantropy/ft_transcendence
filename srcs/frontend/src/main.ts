/**
 * @brief Application entry point for ft_transcendence frontend
 * 
 * @description Main entry point that initializes the application.
 * Phase A3 + B2.2 implementation with Component class and Store testing.
 */

// Import global styles
import './index.css'

// Import assets (using public folder assets available in Vite)
import viteLogo from '/vite.svg'
import typescriptLogo from '/typescript.svg'

// Phase A3: Import Component base class for testing
import { Component } from '@/components'

// Development imports (to be replaced in Phase B1)
import { setupCounter } from './counter'

// Phase B2.2: Import store tests and store instances
import { runBaseStore, runStoreTests, authStore, gameStore, uiStore, appStore } from '@/stores'

/**
 * @brief Simple test component demonstrating Component base class
 * 
 * @description Shows that our Component<TProps, TState> system works correctly
 * with type safety, state management, and lifecycle methods.
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

/**
 * @brief Initialize application
 * 
 * @description Bootstrap the application with all necessary systems.
 * Phase A3 + B2.2 implementation demonstrating Component and Store systems.
 */
async function initApp(): Promise<void> {
  const appElement = document.querySelector<HTMLDivElement>('#app')
  
  if (!appElement) {
    console.error('App element not found')
    return
  }

  // Phase A3 + B2.2: Demonstrate Component base class and Store system working
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
        <div class="bg-gray-800 border-2 border-blue-400 rounded-lg p-6 max-w-md mx-auto mb-8">
          <button 
            id="store-test"
            type="button"
            class="btn-game"
          >
            Run Store Tests
          </button>
          <p class="text-sm text-blue-400 mt-2">Click to test all store implementations</p>
        </div>
        
        <!-- Development Status -->
        <div class="text-green-300 space-y-2">
          <p class="text-lg font-semibold">🎯 Phase B2.2: Store System Complete!</p>
          <p class="text-base">✅ BaseStore&lt;T&gt; with Subscription System</p>
          <p class="text-base">✅ AuthStore - Authentication State Management</p>
          <p class="text-base">✅ GameStore - Game Session State Management</p>
          <p class="text-base">✅ UIStore - Interface State Management</p>
          <p class="text-base">✅ AppStore - Global Application State</p>
          <p class="text-base">✅ Basic Unit Tests for All Stores</p>
          <p class="text-base">⏭️  Next: Phase B1 - SPA Routing System</p>
        </div>
        
        <!-- Version Info -->
        <div class="mt-8 text-sm text-green-500 border-t border-green-800 pt-4">
          <p>Frontend Development Phase B2.2 | Complete State Management System</p>
        </div>
      </div>
    </div>
  `

  // Test Component base class
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
      runStoreTests()
      
      // Show some store state examples
      console.log('\n📊 Store State Examples:')
      console.log('Auth Store:', authStore.getState())
      console.log('Game Store:', gameStore.getState())
      console.log('UI Store:', uiStore.getState())
      console.log('App Store:', appStore.getState())
    })
  }

  console.log('✅ ft_transcendence frontend initialized - Phase B2.2')
  console.log('✅ Component base class system ready')
  console.log('✅ Complete state management system ready')
  console.log('📦 Available stores: AuthStore, GameStore, UIStore, AppStore')
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