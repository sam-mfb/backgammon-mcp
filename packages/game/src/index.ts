// =============================================================================
// Types (only those used by consuming packages)
// =============================================================================

export type {
  Player,
  PointIndex,
  CheckerCounts,
  BoardState,
  DiceRoll,
  DieValue,
  Move,
  MoveFrom,
  MoveTo,
  Turn,
  GamePhase,
  GameResult,
  GameState,
  GameAction,
  AvailableMoves
} from './types'

// =============================================================================
// Dice Utilities
// =============================================================================

export { rollDie } from './dice'

// =============================================================================
// Sync Thunk Infrastructure
// =============================================================================

export { gameSyncThunkMiddleware } from './syncThunkMiddleware'

// =============================================================================
// Game Slice
// =============================================================================

export {
  default as gameReducer,
  // Actions
  resetGame,
  // Selectors
  selectBoard,
  selectCurrentPlayer,
  selectPhase,
  selectRemainingMoves,
  selectValidMoves,
  selectCanEndTurn,
  selectLastAction
} from './gameSlice'

// =============================================================================
// Operations (sync thunks)
// =============================================================================

export {
  performStartGame,
  performRollDice,
  performMove,
  performEndTurn
} from './operations'

// =============================================================================
// Rules Engine
// =============================================================================

export { getValidMoves, getRequiredMoves, filterMovesByDie } from './rules'
