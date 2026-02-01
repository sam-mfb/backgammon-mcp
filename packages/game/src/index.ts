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
} from './gameSlice'

// Rules engine exports
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
} from './rules'
