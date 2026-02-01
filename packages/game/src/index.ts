export * from './types'
export {
  gameSlice,
  default as gameReducer,
  // Actions
  startGame,
  setFirstPlayer,
  rollDice,
  makeMove,
  endTurn,
  setAvailableMoves,
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
  selectAvailableMoves,
  // Derived selectors
  selectBar,
  selectBorneOff,
  selectIsGameOver,
  selectCanRoll,
  selectCanMove,
  selectIsDoubles,
} from './gameSlice'

// Rules engine exports
export {
  getMoveDirection,
  canBearOff,
  isValidMove,
  getValidMoves,
  checkGameOver,
  hasAnyLegalMoves,
  createInitialBoard,
  countTotalCheckers,
  filterMovesByDie,
  getRequiredMoves,
  getLegalMoveSequences,
} from './rules'
