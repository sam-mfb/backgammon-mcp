/**
 * Game Operations
 *
 * High-level game operations implemented as sync thunks.
 * These encapsulate business logic and return typed Results.
 */

import type {
  AvailableMoves,
  DiceRoll,
  DieValue,
  GamePhase,
  GameResult,
  GameState,
  Move,
  MoveFrom,
  MoveTo,
  Player,
  PointIndex,
} from './types'
import { getOpponent, isValidDieValue, isValidPointIndex } from './types'
import { buildCreateSyncThunk, type SyncThunkAction } from './syncThunk'
import { type Result, ok, err } from './result'

/** State shape for operations - matches the expected store shape */
export type RootState = { game: GameState }
import {
  applyMoveToBoard,
  checkGameOver,
  getRequiredMoves,
  getValidMoves,
  createInitialBoard,
} from './rules'
import { createDiceRoll, getRemainingMovesFromDice, rollForFirstPlayer } from './dice'

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

export type EndTurnError = NoGameError | WrongPhaseError | MovesRemainingError | GameOverError

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

const createSyncThunk = buildCreateSyncThunk<RootState, undefined>()

// =============================================================================
// Operations
// =============================================================================

/**
 * Start a new game.
 * Rolls for first player and sets up the initial board.
 */
export const performStartGame = createSyncThunk<Result<StartGameResult, StartGameError>>(
  'game/performStartGame',
  () => {
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
    }

    const validMoves = getValidMoves({ state: initialState })

    return ok({
      firstPlayer,
      diceRoll,
      validMoves,
    })
  }
)

/**
 * Roll dice for the current player's turn.
 * Handles auto-forfeit if no legal moves are available.
 */
export const performRollDice = createSyncThunk<Result<RollDiceResult, RollError>>(
  'game/performRollDice',
  (_arg, { getState }) => {
    const state = getState().game

    if (state.currentPlayer === null) {
      return err({
        type: 'no_game',
        message: 'No game in progress. Use startGame first.',
      })
    }

    if (state.phase === 'game_over') {
      return err({
        type: 'game_over',
        message: 'Game is already over.',
      })
    }

    if (state.phase !== 'rolling') {
      return err({
        type: 'wrong_phase',
        phase: state.phase,
        message: `Cannot roll dice in ${state.phase} phase. ${
          state.phase === 'moving' ? 'Make moves or end turn.' : 'Start a game first.'
        }`,
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
      movesThisTurn: [],
    }

    const validMoves = getValidMoves({ state: tempState })
    const turnForfeited = validMoves.length === 0

    return ok({
      diceRoll,
      validMoves,
      turnForfeited,
    })
  }
)

/**
 * Make a single checker move.
 */
export const performMove = createSyncThunk<Result<MakeMoveResult, MoveError>, MakeMoveInput>(
  'game/performMove',
  (input, { getState }) => {
    const state = getState().game

    if (state.currentPlayer === null) {
      return err({
        type: 'no_game',
        message: 'No game in progress. Use startGame first.',
      })
    }

    if (state.phase !== 'moving') {
      return err({
        type: 'wrong_phase',
        phase: state.phase,
        message: `Cannot make move in ${state.phase} phase. ${
          state.phase === 'rolling' ? 'Roll dice first.' : ''
        }`,
      })
    }

    // Validate input types
    if (input.from !== 'bar' && !isValidPointIndex(input.from)) {
      return err({
        type: 'invalid_input',
        field: 'from',
        message: `Invalid 'from' value: ${input.from}. Must be 'bar' or a number 1-24.`,
      })
    }

    if (input.to !== 'off' && !isValidPointIndex(input.to)) {
      return err({
        type: 'invalid_input',
        field: 'to',
        message: `Invalid 'to' value: ${input.to}. Must be 'off' or a number 1-24.`,
      })
    }

    if (!isValidDieValue(input.dieUsed)) {
      return err({
        type: 'invalid_input',
        field: 'dieUsed',
        message: `Invalid 'dieUsed' value: ${input.dieUsed}. Must be 1-6.`,
      })
    }

    const from: MoveFrom = input.from === 'bar' ? 'bar' : (input.from as PointIndex)
    const to: MoveTo = input.to === 'off' ? 'off' : (input.to as PointIndex)
    const move: Move = { from, to, dieUsed: input.dieUsed }

    // Check if move is in the valid moves list
    const validMoves = getValidMoves({ state })
    const isValid = validMoves.some(
      (vm) =>
        vm.from === from &&
        vm.destinations.some((d) => d.to === to && d.dieValue === input.dieUsed)
    )

    if (!isValid) {
      const validMovesStr = validMoves
        .flatMap((vm) =>
          vm.destinations.map((d) => `${vm.from} -> ${d.to} (die: ${d.dieValue})`)
        )
        .join(', ')

      return err({
        type: 'invalid_move',
        validMoves,
        message: `Invalid move: ${from} -> ${to} with die ${input.dieUsed}. Valid moves: ${validMovesStr || 'none'}`,
      })
    }

    // Check for must-play rules
    const requirements = getRequiredMoves({ state })
    if (requirements.requiredDie && move.dieUsed !== requirements.requiredDie) {
      return err({
        type: 'must_play_required',
        requiredDie: requirements.requiredDie,
        message: `Must play the ${requirements.requiredDie} (${
          requirements.mustPlayHigherDie ? 'higher die rule' : 'only legal die'
        }).`,
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
      movesThisTurn: [...state.movesThisTurn, move],
    }

    const gameOver = checkGameOver({ state: stateAfterMove })
    const newValidMoves = gameOver ? [] : getValidMoves({ state: stateAfterMove })

    return ok({
      move,
      hit,
      gameOver,
      remainingMoves: newRemainingMoves,
      validMoves: newValidMoves,
    })
  }
)

/**
 * End the current player's turn.
 */
export const performEndTurn = createSyncThunk<Result<EndTurnResult, EndTurnError>>(
  'game/performEndTurn',
  (_arg, { getState }) => {
    const state = getState().game

    if (state.currentPlayer === null) {
      return err({
        type: 'no_game',
        message: 'No game in progress. Use startGame first.',
      })
    }

    if (state.phase === 'game_over') {
      return err({
        type: 'game_over',
        message: 'Game is already over.',
      })
    }

    if (state.phase !== 'moving') {
      return err({
        type: 'wrong_phase',
        phase: state.phase,
        message: `Cannot end turn in ${state.phase} phase.`,
      })
    }

    // Check if player still has legal moves they must play
    const validMoves = getValidMoves({ state })
    if (validMoves.length > 0 && state.remainingMoves.length > 0) {
      return err({
        type: 'moves_remaining',
        remainingMoves: state.remainingMoves,
        message: 'You still have legal moves available. You must play all possible dice.',
      })
    }

    const nextPlayer = getOpponent(state.currentPlayer)
    const turnNumber = state.turnNumber + 1

    return ok({
      nextPlayer,
      turnNumber,
    })
  }
)

// =============================================================================
// Action Type Helpers (for extraReducers)
// =============================================================================

export type StartGameAction = SyncThunkAction<
  RootState,
  undefined,
  Result<StartGameResult, StartGameError>,
  void
>

export type RollDiceAction = SyncThunkAction<
  RootState,
  undefined,
  Result<RollDiceResult, RollError>,
  void
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
  Result<EndTurnResult, EndTurnError>,
  void
>
