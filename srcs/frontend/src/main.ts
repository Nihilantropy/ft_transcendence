/**
 * @brief Application entry point for ft_transcendence frontend
 * 
 * @description Main entry point that initializes the application with
 * a working placeholder page for Phase A1 testing. Fixed import issues
 * and provided proper fallbacks for missing assets.
 */

// Import global styles
import './index.css'

// Import assets (using public folder assets available in Vite)
import viteLogo from '/vite.svg'
import typescriptLogo from '/typescript.svg'

// Development imports (to be replaced in Phase B1)
import { setupCounter } from './counter'

// Future imports (to be added in respective phases)
// import { router } from '@/router'              // Phase B1
// import { i18n } from '@/i18n'                  // Phase C1
// import { appStore } from '@/stores'            // Phase B2

/**
 * @brief Initialize application
 * 
 * @description Bootstrap the application with all necessary systems.
 * Currently shows a working placeholder page for Phase A1 testing.
 * Will be refactored in Phase B1 to use proper SPA architecture.
 */
async function initApp(): Promise<void> {
  const appElement = document.querySelector<HTMLDivElement>('#app')
  
  if (!appElement) {
    console.error('App element not found')
    return
  }

  // Phase A1: Working placeholder page with ft_transcendence branding
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
        
        <!-- Interactive Counter Card -->
        <div class="bg-gray-800 border-2 border-green-400 rounded-lg p-6 max-w-md mx-auto mb-8">
          <button 
            id="counter" 
            type="button"
            class="bg-transparent border-2 border-green-400 text-green-400 px-6 py-3 rounded-md font-bold hover:bg-green-400 hover:text-black transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-green-400"
          ></button>
        </div>
        
        <!-- Development Status -->
        <div class="text-green-300 space-y-2">
          <p class="text-lg font-semibold">🎯 Phase A1: Project Structure Complete!</p>
          <p class="text-base">✅ TypeScript + Tailwind CSS Setup Working</p>
          <p class="text-base">✅ Docker Container Ready</p>
          <p class="text-base">⏭️  Next: Phase A2 - Tailwind Configuration</p>
        </div>
        
        <!-- Version Info -->
        <div class="mt-8 text-sm text-green-500 border-t border-green-800 pt-4">
          <p>Frontend Development Phase A1 | Docker + Vite + TypeScript + Tailwind CSS</p>
        </div>
      </div>
    </div>
  `

  // Set up the interactive counter
  const counterButton = document.querySelector<HTMLButtonElement>('#counter')
  if (counterButton) {
    setupCounter(counterButton)
  }

  // Future initialization steps (to be implemented):
  // 1. Initialize i18n system (Phase C1)
  // 2. Set up router (Phase B1)  
  // 3. Initialize state stores (Phase B2)
  // 4. Load user preferences (Phase C1)
  // 5. Mount root component (Phase F1)
  
  console.log('✅ ft_transcendence frontend initialized - Phase A1')
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