/**
 * @brief GameAnimationDemo - Phase 4.2 Animation Showcase
 * 
 * @description Demo component to showcase the retro gaming animations and 
 * visual feedback systems implemented in Phase 4.2.
 * 
 * This is a temporary component for demonstration purposes only.
 */

import { Component } from '../base/Component'

export interface GameAnimationDemoProps {
  /** Demo mode to show different animation types */
  mode?: 'buttons' | 'effects' | 'feedback' | 'all'
  /** Custom CSS classes */
  className?: string
}

export interface GameAnimationDemoState {
  /** Current demo animation */
  activeDemo: string
  /** Demo counter for effects */
  demoCount: number
}

/**
 * @brief Demo component for Phase 4.2 animations
 * 
 * @description Showcases all the retro gaming animations and visual effects
 * implemented in Phase 4.2 including scan lines, button effects, score animations,
 * and visual feedback systems.
 */
export class GameAnimationDemo extends Component<GameAnimationDemoProps, GameAnimationDemoState> {

  constructor(props: GameAnimationDemoProps = {}) {
    super(props, {
      activeDemo: 'none',
      demoCount: 0
    })
  }

  /**
   * @brief Trigger demo animation
   */
  public triggerDemo(demoType: string): void {
    this.setState({ 
      activeDemo: demoType,
      demoCount: this.state.demoCount + 1 
    })
    
    // Auto-reset after animation
    setTimeout(() => {
      this.setState({ activeDemo: 'none' })
    }, 1000)
  }

  /**
   * @brief Render the demo component
   */
  public render(): string {
    const { className = '' } = this.props
    const { activeDemo, demoCount } = this.state
    
    return `
      <div class="animation-demo ${className} bg-gray-900 border border-green-600 rounded-lg p-6">
        <h2 class="text-2xl font-bold text-center mb-6 neon-glow text-green-400">
          🎮 Phase 4.2 Animation Showcase
        </h2>
        
        ${this.renderButtonEffects()}
        ${this.renderScoreEffects()}
        ${this.renderVisualFeedback()}
        ${this.renderRetroEffects()}
        
        <div class="mt-6 text-center text-sm text-green-500">
          Demo Count: ${demoCount} | Active: ${activeDemo}
        </div>
      </div>
    `
  }

  /**
   * @brief Render enhanced button effects demo
   */
  private renderButtonEffects(): string {
    return `
      <div class="mb-6">
        <h3 class="text-lg font-bold mb-4 text-green-400">Enhanced Button Effects</h3>
        
        <div class="flex flex-wrap gap-4">
          <button 
            onclick="this.triggerDemo('button-hover')"
            class="game-btn-enhanced px-6 py-3 bg-green-600 hover:bg-green-500 text-black font-bold rounded-lg"
          >
            🚀 Hover Effect
          </button>
          
          <button 
            onclick="this.triggerDemo('button-press')"
            class="btn-press-feedback px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg"
          >
            👆 Press Feedback
          </button>
          
          <button 
            onclick="this.triggerDemo('victory')"
            class="px-6 py-3 bg-yellow-600 hover:bg-yellow-500 text-black font-bold rounded-lg ${
              this.state.activeDemo === 'victory' ? 'victory-celebration' : ''
            }"
          >
            🏆 Victory Effect
          </button>
        </div>
      </div>
    `
  }

  /**
   * @brief Render score animation effects demo
   */
  private renderScoreEffects(): string {
    return `
      <div class="mb-6">
        <h3 class="text-lg font-bold mb-4 text-green-400">Score & Game Effects</h3>
        
        <div class="flex items-center justify-center gap-8 mb-4">
          <div class="text-center">
            <div class="text-sm text-gray-400 mb-2">Player 1</div>
            <div class="score-display ${
              this.state.activeDemo === 'score-impact' ? 'score-impact' : ''
            }">
              ${this.state.demoCount}
            </div>
          </div>
          
          <div class="text-2xl text-yellow-400">VS</div>
          
          <div class="text-center">
            <div class="text-sm text-gray-400 mb-2">Player 2</div>
            <div class="score-display">
              ${Math.max(0, this.state.demoCount - 1)}
            </div>
          </div>
        </div>
        
        <div class="text-center">
          <button 
            onclick="this.triggerDemo('score-impact')"
            class="px-6 py-3 bg-green-600 hover:bg-green-500 text-black font-bold rounded-lg"
          >
            ⚡ Score Impact
          </button>
        </div>
      </div>
    `
  }

  /**
   * @brief Render visual feedback systems demo
   */
  private renderVisualFeedback(): string {
    return `
      <div class="mb-6">
        <h3 class="text-lg font-bold mb-4 text-green-400">Visual Feedback Systems</h3>
        
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="card p-4">
            <h4 class="font-bold mb-2 text-green-400">Success State</h4>
            <div class="p-3 bg-green-900/20 border border-green-600 rounded ${
              this.state.activeDemo === 'success' ? 'success-glow' : ''
            }">
              <button 
                onclick="this.triggerDemo('success')"
                class="px-4 py-2 bg-green-600 text-black rounded font-bold"
              >
                ✅ Trigger Success
              </button>
            </div>
          </div>
          
          <div class="card p-4">
            <h4 class="font-bold mb-2 text-red-400">Error State</h4>
            <div class="p-3 bg-red-900/20 border border-red-600 rounded ${
              this.state.activeDemo === 'error' ? 'error-shake' : ''
            }">
              <button 
                onclick="this.triggerDemo('error')"
                class="px-4 py-2 bg-red-600 text-white rounded font-bold"
              >
                ❌ Trigger Error
              </button>
            </div>
          </div>
          
          <div class="card p-4">
            <h4 class="font-bold mb-2 text-blue-400">Loading State</h4>
            <div class="p-3 bg-blue-900/20 border border-blue-600 rounded">
              <div class="text-center">
                <div class="loading-text text-blue-400 font-bold">Loading</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `
  }

  /**
   * @brief Render retro effects demo
   */
  private renderRetroEffects(): string {
    return `
      <div class="mb-6">
        <h3 class="text-lg font-bold mb-4 text-green-400">Retro Gaming Effects</h3>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="card p-4">
            <h4 class="font-bold mb-2 text-green-400">Scan Lines Effect</h4>
            <div class="retro-scanlines bg-gray-800 border border-green-600 rounded p-4 h-24 flex items-center justify-center">
              <span class="neon-glow text-green-400 font-bold">RETRO DISPLAY</span>
            </div>
          </div>
          
          <div class="card p-4">
            <h4 class="font-bold mb-2 text-yellow-400">Ball Trail Effect</h4>
            <div class="bg-gray-800 border border-green-600 rounded p-4 h-24 flex items-center justify-center">
              <div class="w-4 h-4 bg-yellow-400 rounded-full ball-trail"></div>
            </div>
          </div>
        </div>
        
        <div class="mt-4 text-center">
          <div class="animate-fade-in-up">
            <span class="text-green-400">🎯 Fade In Up Animation</span>
          </div>
        </div>
      </div>
    `
  }
}

/**
 * @brief Temporary demo component for Phase 4.2 showcase
 * 
 * @description This component demonstrates all the animation and visual
 * effects implemented in Phase 4.2. Can be integrated temporarily for testing.
 */
