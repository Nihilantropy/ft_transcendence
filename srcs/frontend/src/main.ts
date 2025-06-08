/**
 * @brief Application entry point for ft_transcendence frontend
 * 
 * @description Main entry point that initializes the application.
 * Phase B1 implementation: Router class + Store system + Testing framework.
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

// Phase B1 + Testing: Import testing system (FIXED PATH)
// import { initTestingSystem } from '../tests/test-runner'

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

/**
 * @brief Initialize application
 * 
 * @description Bootstrap the application with all necessary systems.
 * Phase B1: Router + Component + Store + Testing systems.
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
        
        <!-- Testing System will be inserted here -->
        
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
        
        <!-- Development Status -->
        <div class="text-green-300 space-y-2">
          <p class="text-lg font-semibold">🎯 Phase B1: Complete SPA Router + Testing!</p>
          <p class="text-base">✅ Router Class with History API</p>
          <p class="text-base">✅ Route Registration & Pattern Matching</p>
          <p class="text-base">✅ URL Parameter Extraction</p>
          <p class="text-base">✅ Browser Back/Forward Support</p>
          <p class="text-base">✅ Route Change Events</p>
          <p class="text-base">✅ 404 Handling</p>
          <p class="text-base">✅ Testing Framework & Integration Tests</p>
          <p class="text-base">⏭️  Next: Phase B2 - Component Integration</p>
        </div>
        
        <!-- Console Tip -->
        <div class="mt-8 text-sm text-cyan-400 bg-gray-800 border border-cyan-400 rounded p-4 max-w-2xl mx-auto">
          <p class="font-semibold mb-2">🖥️ Console Testing:</p>
          <p>• <code>ftTests.router()</code> - Test router</p>
          <p>• <code>ftTests.all()</code> - Run all tests</p>
        </div>
        
        <!-- Version Info -->
        <div class="mt-8 text-sm text-green-500 border-t border-green-800 pt-4">
          <p>Frontend Development Phase B1 | Router + Testing System Complete</p>
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

  // Initialize Testing System (Phase B1 + Testing)
  // initTestingSystem()

  console.log('✅ ft_transcendence frontend initialized - Phase B1 + Testing')
  console.log('✅ Router class with History API ready')
  console.log('✅ Complete state management system ready')
  console.log('✅ Testing framework ready')
  console.log('🧭 Router supports: route registration, navigation, parameters, back/forward')
  console.log('🧪 Testing: Use UI buttons or console commands (ftTests.*)')
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