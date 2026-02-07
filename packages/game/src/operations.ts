/**
 * Game Operations
 *
 * High-level game operations implemented as sync thunks.
 * These encapsulate business logic and return typed Results.
 */

import type {
  AvailableMoves,
  BoardState,
  DiceRoll,
  DieValue,
  GameAction,
  GamePhase,
  GameResult,
  GameState,
  Move,
  MoveFrom,
  MoveTo,
  Player
} from './types'
import { getOpponent, isValidDieValue, isValidPointIndex } from './types'
import { buildCreateSyncThunk, type SyncThunkAction } from './syncThunk'
import { type Result, ok, err } from './result'

/** State shape for operations - matches the expected store shape */
export type RootState = { game: GameState }
import {
  applyMoveToBoard,
  checkGameOver,
  filterMovesByDie,
  getRequiredMoves,
  getValidMoves,
  createInitialBoard,
} from './rules'
import {
  createDiceRoll,
  getRemainingMovesFromDice,
  rollForFirstPlayer
} from './dice'

// =============================================================================
// Error Types
// =============================================================================

export type NoGameError = {
  readonly type: 'no_game'
  readonly message: string
}

export type WrongPhaseError = {
  readonly type: 'wrong_phase'
  readonly phase: GamePhase
  readonly message: string
}

export type InvalidMoveError = {
  readonly type: 'invalid_move'
  readonly validMoves: readonly AvailableMoves[]
  readonly message: string
}

export type MustPlayRequiredError = {
  readonly type: 'must_play_required'
  readonly requiredDie: DieValue
  readonly message: string
}

export type InvalidInputError = {
  readonly type: 'invalid_input'
  readonly field: string
  readonly message: string
}

export type MovesRemainingError = {
  readonly type: 'moves_remaining'
  readonly remainingMoves: readonly DieValue[]
  readonly message: string
}

export type GameOverError = {
  readonly type: 'game_over'
  readonly message: string
}

export type StartGameError = never // Start game can't fail currently

export type RollError = NoGameError | WrongPhaseError | GameOverError

export type MoveError =
  | NoGameError
  | WrongPhaseError
  | InvalidInputError
  | InvalidMoveError
  | MustPlayRequiredError

export type EndTurnError =
  | NoGameError
  | WrongPhaseError
  | MovesRemainingError
  | GameOverError

export type NothingToUndoError = {
  readonly type: 'nothing_to_undo'
  readonly message: string
}

export type UndoError = NoGameError | WrongPhaseError | NothingToUndoError

// =============================================================================
// Result Types
// =============================================================================

export interface StartGameResult {
  readonly firstPlayer: Player
  readonly diceRoll: DiceRoll
  readonly validMoves: readonly AvailableMoves[]
}

export interface RollDiceResult {
  readonly diceRoll: DiceRoll
  readonly validMoves: readonly AvailableMoves[]
  readonly turnForfeited: boolean
}

export interface MakeMoveResult {
  readonly move: Move
  readonly hit: boolean
  readonly gameOver: GameResult | null
  readonly remainingMoves: readonly DieValue[]
  readonly validMoves: readonly AvailableMoves[]
}

export interface EndTurnResult {
  readonly nextPlayer: Player
  readonly turnNumber: number
}

export interface UndoMoveResult {
  readonly undoneMoves: readonly { readonly move: Move; readonly hit: boolean }[]
  readonly validMoves: readonly AvailableMoves[]
}

// =============================================================================
// Input Types
// =============================================================================

export interface MakeMoveInput {
  readonly from: number | 'bar'
  readonly to: number | 'off'
  readonly dieUsed: number
}

// =============================================================================
// Sync Thunk Factory
// =============================================================================

const createSyncThunk = buildCreateSyncThunk<RootState>()

// =============================================================================
// Operations
// =============================================================================

/**
 * Start a new game.
 * Rolls for first player and sets up the initial board.
 */
export const performStartGame = createSyncThunk<
  Result<StartGameResult, StartGameError>
>('game/performStartGame', () => {
  const { diceRoll, firstPlayer } = rollForFirstPlayer()

  // Compute valid moves for the starting position
  const initialBoard = createInitialBoard()
  const initialState: GameState = {
    board: initialBoard,
    currentPlayer: firstPlayer,
    phase: 'moving',
    diceRoll,
    remainingMoves: getRemainingMovesFromDice(diceRoll),
    turnNumber: 1,
    movesThisTurn: [],
    result: null,
    history: [],
    actionHistory: []
  }

  const allValidMoves = getValidMoves({ state: initialState })

  // Filter moves by required die (must-play-higher rule) - unlikely at game start but for consistency
  const requirements = getRequiredMoves({ state: initialState })
  const validMoves = requirements.requiredDie
    ? filterMovesByDie({ availableMoves: allValidMoves, dieValue: requirements.requiredDie })
    : allValidMoves

  return ok({
    firstPlayer,
    diceRoll,
    validMoves
  })
})

/**
 * Roll dice for the current player's turn.
 * Handles auto-forfeit if no legal moves are available.
 */
export const performRollDice = createSyncThunk<
  Result<RollDiceResult, RollError>
>('game/performRollDice', (_arg, { getState }) => {
  const state = getState().game

  if (state.currentPlayer === null) {
    return err({
      type: 'no_game',
      message: 'No game in progress. Use startGame first.'
    })
  }

  if (state.phase === 'game_over') {
    return err({
      type: 'game_over',
      message: 'Game is already over.'
    })
  }

  if (state.phase !== 'rolling') {
    return err({
      type: 'wrong_phase',
      phase: state.phase,
      message: `Cannot roll dice in ${state.phase} phase. ${
        state.phase === 'moving'
          ? 'Make moves or end turn.'
          : 'Start a game first.'
      }`
    })
  }

  const diceRoll = createDiceRoll()
  const remainingMoves = getRemainingMovesFromDice(diceRoll)

  // Create temporary state to check for valid moves
  const tempState: GameState = {
    ...state,
    phase: 'moving',
    diceRoll,
    remainingMoves,
    movesThisTurn: []
  }

  const allValidMoves = getValidMoves({ state: tempState })
  const turnForfeited = allValidMoves.length === 0

  // Filter moves by required die (must-play-higher rule)
  const requirements = getRequiredMoves({ state: tempState })
  const validMoves = requirements.requiredDie
    ? filterMovesByDie({ availableMoves: allValidMoves, dieValue: requirements.requiredDie })
    : allValidMoves

  return ok({
    diceRoll,
    validMoves,
    turnForfeited
  })
})

/**
 * Make a single checker move.
 */
export const performMove = createSyncThunk<
  Result<MakeMoveResult, MoveError>,
  MakeMoveInput
>('game/performMove', (input, { getState }) => {
  const state = getState().game

  if (state.currentPlayer === null) {
    return err({
      type: 'no_game',
      message: 'No game in progress. Use startGame first.'
    })
  }

  if (state.phase !== 'moving') {
    return err({
      type: 'wrong_phase',
      phase: state.phase,
      message: `Cannot make move in ${state.phase} phase. ${
        state.phase === 'rolling' ? 'Roll dice first.' : ''
      }`
    })
  }

  // Validate input types
  if (input.from !== 'bar' && !isValidPointIndex(input.from)) {
    return err({
      type: 'invalid_input',
      field: 'from',
      message: `Invalid 'from' value: ${String(input.from)}. Must be 'bar' or a number 1-24.`
    })
  }

  if (input.to !== 'off' && !isValidPointIndex(input.to)) {
    return err({
      type: 'invalid_input',
      field: 'to',
      message: `Invalid 'to' value: ${String(input.to)}. Must be 'off' or a number 1-24.`
    })
  }

  if (!isValidDieValue(input.dieUsed)) {
    return err({
      type: 'invalid_input',
      field: 'dieUsed',
      message: `Invalid 'dieUsed' value: ${String(input.dieUsed)}. Must be 1-6.`
    })
  }

  const from: MoveFrom = input.from === 'bar' ? 'bar' : input.from
  const to: MoveTo = input.to === 'off' ? 'off' : input.to
  const move: Move = { from, to, dieUsed: input.dieUsed }

  // Check if move is in the valid moves list
  const validMoves = getValidMoves({ state })
  const isValid = validMoves.some(
    vm =>
      vm.from === from &&
      vm.destinations.some(d => d.to === to && d.dieValue === input.dieUsed)
  )

  if (!isValid) {
    const validMovesStr = validMoves
      .flatMap(vm =>
        vm.destinations.map(
          d =>
            `${String(vm.from)} -> ${String(d.to)} (die: ${String(d.dieValue)})`
        )
      )
      .join(', ')

    return err({
      type: 'invalid_move',
      validMoves,
      message: `Invalid move: ${String(from)} -> ${String(to)} with die ${String(input.dieUsed)}. Valid moves: ${validMovesStr || 'none'}`
    })
  }

  // Check for must-play rules
  const requirements = getRequiredMoves({ state })
  if (requirements.requiredDie && move.dieUsed !== requirements.requiredDie) {
    return err({
      type: 'must_play_required',
      requiredDie: requirements.requiredDie,
      message: `Must play the ${String(requirements.requiredDie)} (${
        requirements.mustPlayHigherDie ? 'higher die rule' : 'only legal die'
      }).`
    })
  }

  // Compute result data
  const player = state.currentPlayer
  const newBoard = applyMoveToBoard({ state, move })

  // Check if this was a hit
  const hit =
    to !== 'off' &&
    ((player === 'white' && state.board.points[to - 1] === -1) ||
      (player === 'black' && state.board.points[to - 1] === 1))

  // Update remaining moves
  const newRemainingMoves = [...state.remainingMoves]
  const dieIndex = newRemainingMoves.indexOf(move.dieUsed)
  if (dieIndex !== -1) {
    newRemainingMoves.splice(dieIndex, 1)
  }

  // Create state after move to check for game over and valid moves
  const stateAfterMove: GameState = {
    ...state,
    board: newBoard,
    remainingMoves: newRemainingMoves,
    movesThisTurn: [...state.movesThisTurn, move]
  }

  const gameOver = checkGameOver({ state: stateAfterMove })
  const allNewValidMoves = gameOver ? [] : getValidMoves({ state: stateAfterMove })

  // Filter moves by required die (must-play-higher rule)
  const newRequirements = gameOver ? null : getRequiredMoves({ state: stateAfterMove })
  const newValidMoves = newRequirements?.requiredDie
    ? filterMovesByDie({ availableMoves: allNewValidMoves, dieValue: newRequirements.requiredDie })
    : allNewValidMoves

  return ok({
    move,
    hit,
    gameOver,
    remainingMoves: newRemainingMoves,
    validMoves: newValidMoves
  })
})

/**
 * End the current player's turn.
 */
export const performEndTurn = createSyncThunk<
  Result<EndTurnResult, EndTurnError>
>('game/performEndTurn', (_arg, { getState }) => {
  const state = getState().game

  if (state.currentPlayer === null) {
    return err({
      type: 'no_game',
      message: 'No game in progress. Use startGame first.'
    })
  }

  if (state.phase === 'game_over') {
    return err({
      type: 'game_over',
      message: 'Game is already over.'
    })
  }

  if (state.phase !== 'moving') {
    return err({
      type: 'wrong_phase',
      phase: state.phase,
      message: `Cannot end turn in ${state.phase} phase.`
    })
  }

  // Check if player still has legal moves they must play
  const validMoves = getValidMoves({ state })
  if (validMoves.length > 0 && state.remainingMoves.length > 0) {
    return err({
      type: 'moves_remaining',
      remainingMoves: state.remainingMoves,
      message:
        'You still have legal moves available. You must play all possible dice.'
    })
  }

  const nextPlayer = getOpponent(state.currentPlayer)
  const turnNumber = state.turnNumber + 1

  return ok({
    nextPlayer,
    turnNumber
  })
})

/**
 * Undo the last move in the current turn.
 * Only valid during moving phase with at least one move made.
 */
export const performUndoMove = createSyncThunk<
  Result<UndoMoveResult, UndoError>
>('game/performUndoMove', (_arg, { getState }) => {
  const state = getState().game

  if (state.currentPlayer === null) {
    return err({
      type: 'no_game',
      message: 'No game in progress.'
    })
  }

  if (state.phase !== 'moving') {
    return err({
      type: 'wrong_phase',
      phase: state.phase,
      message: `Cannot undo in ${state.phase} phase.`
    })
  }

  if (state.movesThisTurn.length === 0) {
    return err({
      type: 'nothing_to_undo',
      message: 'No moves to undo this turn.'
    })
  }

  // Find the last piece_move action to get hit info
  const lastAction = state.actionHistory[state.actionHistory.length - 1]
  if (lastAction.type !== 'piece_move') {
    return err({
      type: 'nothing_to_undo',
      message: 'No piece_move action found in history to undo.'
    })
  }

  const lastMove = state.movesThisTurn[state.movesThisTurn.length - 1]

  // The reducer will handle the actual board reversal.
  // We compute valid moves for what the state will look like after undo.
  // Build the projected state by replaying all moves except the last.
  const projectedRemainingMoves = [...state.remainingMoves, lastMove.dieUsed]
  const projectedMovesThisTurn = state.movesThisTurn.slice(0, -1)

  // Rebuild board: start from state and reverse the last move
  // We'll let the reducer do the actual reversal; here just compute valid moves
  // by building a projected state from action replay
  const projectedState = buildProjectedStateAfterUndo({
    state,
    movesToKeep: projectedMovesThisTurn,
    remainingMoves: projectedRemainingMoves
  })

  const allValidMoves = getValidMoves({ state: projectedState })
  const requirements = getRequiredMoves({ state: projectedState })
  const validMoves = requirements.requiredDie
    ? filterMovesByDie({ availableMoves: allValidMoves, dieValue: requirements.requiredDie })
    : allValidMoves

  return ok({
    undoneMoves: [{ move: lastMove, hit: lastAction.hit }],
    validMoves
  })
})

/**
 * Undo all moves in the current turn.
 * Only valid during moving phase with at least one move made.
 */
export const performUndoAllMoves = createSyncThunk<
  Result<UndoMoveResult, UndoError>
>('game/performUndoAllMoves', (_arg, { getState }) => {
  const state = getState().game

  if (state.currentPlayer === null) {
    return err({
      type: 'no_game',
      message: 'No game in progress.'
    })
  }

  if (state.phase !== 'moving') {
    return err({
      type: 'wrong_phase',
      phase: state.phase,
      message: `Cannot undo in ${state.phase} phase.`
    })
  }

  if (state.movesThisTurn.length === 0) {
    return err({
      type: 'nothing_to_undo',
      message: 'No moves to undo this turn.'
    })
  }

  // Collect all piece_move actions from this turn (in reverse order for undo)
  const moveCount = state.movesThisTurn.length
  const pieceMoveActions: (GameAction & { type: 'piece_move' })[] = []
  for (let i = state.actionHistory.length - 1; i >= 0 && pieceMoveActions.length < moveCount; i--) {
    const action = state.actionHistory[i]
    if (action.type === 'piece_move') {
      pieceMoveActions.unshift(action)
    }
  }

  const undoneMoves = state.movesThisTurn.map((move, i) => ({
    move,
    hit: pieceMoveActions[i]?.hit ?? false
  }))

  // Compute remaining moves: restore all dice used this turn
  const allDiceUsed = state.movesThisTurn.map(m => m.dieUsed)
  const projectedRemainingMoves = [...state.remainingMoves, ...allDiceUsed]

  const projectedState = buildProjectedStateAfterUndo({
    state,
    movesToKeep: [],
    remainingMoves: projectedRemainingMoves
  })

  const allValidMoves = getValidMoves({ state: projectedState })
  const requirements = getRequiredMoves({ state: projectedState })
  const validMoves = requirements.requiredDie
    ? filterMovesByDie({ availableMoves: allValidMoves, dieValue: requirements.requiredDie })
    : allValidMoves

  return ok({
    undoneMoves,
    validMoves
  })
})

/**
 * Build a projected game state after undoing moves, by replaying only
 * the moves we want to keep from the turn-start board state.
 */
function buildProjectedStateAfterUndo({
  state,
  movesToKeep,
  remainingMoves
}: {
  state: GameState
  movesToKeep: readonly Move[]
  remainingMoves: readonly DieValue[]
}): GameState {
  // Find the board state at the start of this turn by looking at actionHistory.
  // The turn started after the last dice_roll action. We need to reconstruct
  // the board before any piece_move actions in this turn.
  // Strategy: reverse all moves in movesThisTurn to get back to turn-start board,
  // then replay movesToKeep.

  // First, reverse all current moves to get turn-start board
  let board = state.board
  const moveCount = state.movesThisTurn.length
  const player = state.currentPlayer
  if (!player) return state

  // Get hit info from actionHistory
  const pieceMoveActions: (GameAction & { type: 'piece_move' })[] = []
  for (let i = state.actionHistory.length - 1; i >= 0 && pieceMoveActions.length < moveCount; i--) {
    const action = state.actionHistory[i]
    if (action.type === 'piece_move') {
      pieceMoveActions.unshift(action)
    }
  }

  // Reverse moves in reverse order to get back to turn-start board
  for (let i = moveCount - 1; i >= 0; i--) {
    const move = state.movesThisTurn[i]
    const hit = pieceMoveActions[i]?.hit ?? false
    board = reverseMove({ board, move, player, hit })
  }

  // Replay movesToKeep
  let replayState: GameState = {
    ...state,
    board,
    remainingMoves,
    movesThisTurn: []
  }
  for (const move of movesToKeep) {
    const newBoard = applyMoveToBoard({ state: replayState, move })
    const newRemaining = [...replayState.remainingMoves]
    const idx = newRemaining.indexOf(move.dieUsed)
    if (idx !== -1) newRemaining.splice(idx, 1)
    replayState = {
      ...replayState,
      board: newBoard,
      remainingMoves: newRemaining,
      movesThisTurn: [...replayState.movesThisTurn, move]
    }
  }

  return replayState
}

/**
 * Reverse a single move on the board. Pure function.
 * This is the inverse of applyMoveToBoard.
 */
function reverseMove({
  board,
  move,
  player,
  hit
}: {
  board: BoardState
  move: Move
  player: Player
  hit: boolean
}): BoardState {
  const { from, to } = move

  const newPoints = [...board.points] as BoardState['points']
  const newBar = { ...board.bar }
  const newBorneOff = { ...board.borneOff }
  const opponent = getOpponent(player)

  // Remove checker from destination (reverse of placing)
  if (to === 'off') {
    newBorneOff[player]--
  } else {
    const toIndex = to - 1
    if (player === 'white') {
      newPoints[toIndex]--
    } else {
      newPoints[toIndex]++
    }

    // If this move was a hit, restore opponent's checker from bar to this point
    if (hit) {
      newBar[opponent]--
      if (opponent === 'white') {
        newPoints[toIndex]++
      } else {
        newPoints[toIndex]--
      }
    }
  }

  // Restore checker to source (reverse of removing)
  if (from === 'bar') {
    newBar[player]++
  } else {
    const fromIndex = from - 1
    if (player === 'white') {
      newPoints[fromIndex]++
    } else {
      newPoints[fromIndex]--
    }
  }

  return {
    points: newPoints,
    bar: newBar,
    borneOff: newBorneOff
  }
}

// =============================================================================
// Action Type Helpers (for extraReducers)
// =============================================================================

export type StartGameAction = SyncThunkAction<
  RootState,
  undefined,
  Result<StartGameResult, StartGameError>
>

export type RollDiceAction = SyncThunkAction<
  RootState,
  undefined,
  Result<RollDiceResult, RollError>
>

export type MakeMoveAction = SyncThunkAction<
  RootState,
  undefined,
  Result<MakeMoveResult, MoveError>,
  MakeMoveInput
>

export type EndTurnAction = SyncThunkAction<
  RootState,
  undefined,
  Result<EndTurnResult, EndTurnError>
>

export type UndoMoveAction = SyncThunkAction<
  RootState,
  undefined,
  Result<UndoMoveResult, UndoError>
>

export type UndoAllMovesAction = SyncThunkAction<
  RootState,
  undefined,
  Result<UndoMoveResult, UndoError>
>
