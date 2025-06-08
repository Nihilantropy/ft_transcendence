/**
 * @brief Simple test runner for ft_transcendence frontend
 * 
 * @description Coordinates test execution and provides testing interface.
 */

import { runRouterTests } from './integration/router.test'

export function initTestingSystem(): void {
  console.log('🔬 Initializing ft_transcendence Testing System...')
  
  // Add test controls to the page
  addTestControls()
  
  // Make quick tests available globally
  if (typeof window !== 'undefined') {
    (window as any).ftTests = {
      router: runRouterTests,
      all: async () => {
        console.log('🧪 Running All Tests...')
        await runRouterTests()
      }
    }
    console.log('🌍 Global test functions available as window.ftTests')
  }
}

function addTestControls(): void {
  const controlsHtml = `
    <div class="bg-gray-800 border-2 border-cyan-400 rounded-lg p-6 max-w-2xl mx-auto mb-8">
      <h2 class="text-xl font-bold text-cyan-400 mb-4">🧪 Router Testing</h2>
      
      <div class="grid grid-cols-2 gap-3 mb-4">
        <button id="test-router" class="btn-game text-sm">🧭 Test Router</button>
        <button id="clear-console" class="btn-secondary text-sm">🧹 Clear Console</button>
      </div>
      
      <div class="text-sm text-cyan-300 space-y-1">
        <div>• <strong>Test Router:</strong> Run router functionality tests</div>
        <div>• <strong>Console:</strong> Use <code>ftTests.router()</code> in console</div>
      </div>
    </div>
  `
  
  const appElement = document.querySelector('#app')
  if (appElement) {
    appElement.insertAdjacentHTML('afterbegin', controlsHtml)
    
    // Add event listeners
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement
      
      if (target.id === 'test-router') {
        runRouterTests()
      }
      
      if (target.id === 'clear-console') {
        console.clear()
      }
    })
  }
}