/**
 * @brief Game logic and state management services
 * 
 * @description Barrel export for game-related client services.
 * Coordinates with server-side game engine (Phase 6).
 */

// Game Services (Active - Core functionality implemented)
export { GameService, gameService } from './GameService'
export type { CreateGameRequest, JoinGameResponse, ReadyResponse, AvailableGamesResponse } from './GameService'

// Game Services (Future implementation when Game Engine is ready - Phase 6)
// export { GameStateManager } from './GameStateManager'
// export { TournamentService } from './TournamentService'

// Game Client Logic (to be implemented in Phase G1)
// export { GameRenderer } from './GameRenderer'
// export { InputHandler } from './InputHandler'
// export { GameEvents } from './GameEvents'

// Game Utilities (to be implemented in Phase G1)
// export { gameConfig } from './config'
// export { gameValidators } from './validators'

// Game Types (to be implemented in Phase G1)
// export type { GameState, Player, Score, GameSettings } from './types'