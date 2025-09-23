/**
 * @brief Game-specific UI components
 * 
 * @description Barrel export for Pong game interface components.
 * These components will interface with server-side game logic.
 * 
 * Phase 4.1 - Game Components Implementation
 */

// Game Interface Components
export { GameContainer } from './GameContainer'
export { Scoreboard } from './Scoreboard'
export { GameControls } from './GameControls'
export { GameStatus } from './GameStatus'

// Future components
// export { PongCanvas } from './PongCanvas'
// export { AccessiblePongGame } from './AccessiblePongGame'
// export { TournamentBracket } from './TournamentBracket'
// export { TournamentMatch } from './TournamentMatch'

// Import for components collection
import { GameContainer } from './GameContainer'
import { Scoreboard } from './Scoreboard'
import { GameControls } from './GameControls'
import { GameStatus } from './GameStatus'

// Export components collection
export const gameComponents = {
  GameContainer,
  Scoreboard,
  GameControls,
  GameStatus
}