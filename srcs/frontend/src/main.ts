/**
 * @brief Application entry point
 * 
 * @description Main entry point for ft_transcendence frontend application.
 * Initializes core systems and bootstraps the SPA.
 */

// Import global styles
import './index.css'

// Development imports (to be replaced in Phase B1)
import { setupCounter } from './counter.ts'

// Future imports (to be added in respective phases)
// import { router } from '@/router'              // Phase B1
// import { i18n } from '@/i18n'                  // Phase C1
// import { appStore } from '@/stores'            // Phase B2

/**
 * @brief Initialize application
 * 
 * @description Bootstrap the application with all necessary systems.
 * Will be refactored in Phase B1 to use proper SPA architecture.
 */
async function initApp(): Promise<void> {
  // Current development setup (to be replaced in Phase B1)
  document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
    <div>
      <a href="https://vite.dev" target="_blank">
        <img src="${viteLogo}" class="logo" alt="Vite logo" />
      </a>
      <a href="https://www.typescriptlang.org/" target="_blank">
        <img src="${typescriptLogo}" class="logo vanilla" alt="TypeScript logo" />
      </a>
      <h1>ft_transcendence</h1>
      <div class="card">
        <button id="counter" type="button"></button>
      </div>
      <p class="read-the-docs">
        Phase A1: Project Structure Complete!<br>
        Next: Phase A2 - Tailwind Configuration
      </p>
    </div>
  `

  setupCounter(document.querySelector<HTMLButtonElement>('#counter')!)

  // Future initialization steps (to be implemented):
  // 1. Initialize i18n system (Phase C1)
  // 2. Set up router (Phase B1)  
  // 3. Initialize state stores (Phase B2)
  // 4. Load user preferences (Phase C1)
  // 5. Mount root component (Phase F1)
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', initApp)