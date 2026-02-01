// =============================================================================
// Types
// =============================================================================

export * from './types'

// =============================================================================
// Result Type
// =============================================================================

export { type Result, ok, err, isOk, isErr, mapResult, mapError, unwrap, unwrapOr } from './result'

// =============================================================================
// Dice Utilities
// =============================================================================

export { rollDie, createDiceRoll, getRemainingMovesFromDice, rollForFirstPlayer } from './dice'

// =============================================================================
// Sync Thunk Infrastructure
// =============================================================================

export {
  buildCreateSyncThunk,
  isSyncThunkAction,
  type SyncThunkAPI,
  type PayloadCreator,
  type SyncThunkMeta,
  type SyncThunkAction,
  type SyncThunkActionCreator,
  type CreateSyncThunk,
} from './syncThunk'

export { createSyncThunkMiddleware, gameSyncThunkMiddleware } from './syncThunkMiddleware'

// =============================================================================
// Game Slice
// =============================================================================

export {
  gameSlice,
  default as gameReducer,
  // Actions
  startGame,
  setFirstPlayer,
  rollDice,
  makeMove,
  endTurn,
  endGame,
  resetGame,
  // Direct selectors
  selectBoard,
  selectCurrentPlayer,
  selectPhase,
  selectDiceRoll,
  selectRemainingMoves,
  selectTurnNumber,
  selectMovesThisTurn,
  selectResult,
  selectHistory,
  // Derived selectors
  selectBar,
  selectBorneOff,
  selectIsGameOver,
  selectCanRoll,
  selectCanMove,
  selectIsDoubles,
  selectGameState,
  // Memoized selectors
  selectValidMoves,
  selectCanEndTurn,
  // Types
  type RootState,
} from './gameSlice'

// =============================================================================
// Operations (sync thunks)
// =============================================================================

export {
  // Operations
  performStartGame,
  performRollDice,
  performMove,
  performEndTurn,
  // Error types
  type NoGameError,
  type WrongPhaseError,
  type InvalidMoveError,
  type MustPlayRequiredError,
  type InvalidInputError,
  type MovesRemainingError,
  type GameOverError,
  type StartGameError,
  type RollError,
  type MoveError,
  type EndTurnError,
  // Result types
  type StartGameResult,
  type RollDiceResult,
  type MakeMoveResult,
  type EndTurnResult,
  // Input types
  type MakeMoveInput,
  // Action types
  type StartGameAction,
  type RollDiceAction,
  type MakeMoveAction,
  type EndTurnAction,
} from './operations'

// =============================================================================
// Rules Engine
// =============================================================================

export {
  getMoveDirection,
  canBearOff,
  isValidMove,
  getValidMoves,
  checkGameOver,
  hasAnyLegalMoves,
  canEndTurn,
  createInitialBoard,
  countTotalCheckers,
  filterMovesByDie,
  getRequiredMoves,
  getLegalMoveSequences,
  applyMoveToBoard,
} from './rules'
