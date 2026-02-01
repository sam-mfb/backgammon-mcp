import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type {
  AvailableMoves,
  BoardState,
  DiceRoll,
  GameResult,
  GameState,
  Move,
  Player,
} from './types'

/** State shape expected by selectors - apps must configure their store with { game: GameState } */
type RootState = { game: GameState }

/**
 * Standard backgammon starting position
 *
 * White (positive) checkers:
 * - 2 on point 24
 * - 5 on point 13
 * - 3 on point 8
 * - 5 on point 6
 *
 * Black (negative) checkers:
 * - 2 on point 1
 * - 5 on point 12
 * - 3 on point 17
 * - 5 on point 19
 */
const INITIAL_BOARD: BoardState = {
  points: [
    -2, // Point 1: 2 black
    0, // Point 2
    0, // Point 3
    0, // Point 4
    0, // Point 5
    5, // Point 6: 5 white
    0, // Point 7
    3, // Point 8: 3 white
    0, // Point 9
    0, // Point 10
    0, // Point 11
    -5, // Point 12: 5 black
    5, // Point 13: 5 white
    0, // Point 14
    0, // Point 15
    0, // Point 16
    -3, // Point 17: 3 black
    0, // Point 18
    -5, // Point 19: 5 black
    0, // Point 20
    0, // Point 21
    0, // Point 22
    0, // Point 23
    2, // Point 24: 2 white
  ],
  bar: { white: 0, black: 0 },
  borneOff: { white: 0, black: 0 },
}

const initialState: GameState = {
  board: INITIAL_BOARD,
  currentPlayer: null,
  phase: 'not_started',
  diceRoll: null,
  remainingMoves: [],
  turnNumber: 0,
  movesThisTurn: [],
  result: null,
  history: [],
  availableMoves: null,
}

export const gameSlice = createSlice({
  name: 'game',
  initialState,
  reducers: {
    /** Transition to rolling_for_first phase to determine who goes first */
    startGame(state) {
      state.phase = 'rolling_for_first'
    },

    /** Set who goes first and transition to rolling phase */
    setFirstPlayer(state, action: PayloadAction<Player>) {
      state.currentPlayer = action.payload
      state.phase = 'rolling'
    },

    /** Set dice roll, compute remaining moves (4 if doubles), transition to moving */
    rollDice(state, action: PayloadAction<DiceRoll>) {
      const { die1, die2 } = action.payload
      state.diceRoll = action.payload
      state.phase = 'moving'

      // Doubles give 4 moves of the same value
      if (die1 === die2) {
        state.remainingMoves = [die1, die1, die1, die1]
      } else {
        state.remainingMoves = [die1, die2]
      }
    },

    /** Execute a move, update board/bar/borneOff, consume die from remainingMoves */
    makeMove(state, action: PayloadAction<Move>) {
      const { from, to, dieUsed } = action.payload
      const player = state.currentPlayer!

      // Remove checker from source
      if (from === 'bar') {
        state.board.bar[player]--
      } else {
        // from is a PointIndex (1-24), array index is from - 1
        const fromIndex = from - 1
        if (player === 'white') {
          state.board.points[fromIndex]--
        } else {
          state.board.points[fromIndex]++
        }
      }

      // Place checker at destination
      if (to === 'off') {
        state.board.borneOff[player]++
      } else {
        // to is a PointIndex (1-24), array index is to - 1
        const toIndex = to - 1
        const pointValue = state.board.points[toIndex]

        // Check for hitting a blot (single opponent checker)
        if (player === 'white' && pointValue === -1) {
          // Hit black's blot
          state.board.points[toIndex] = 1
          state.board.bar.black++
        } else if (player === 'black' && pointValue === 1) {
          // Hit white's blot
          state.board.points[toIndex] = -1
          state.board.bar.white++
        } else {
          // Normal move
          if (player === 'white') {
            state.board.points[toIndex]++
          } else {
            state.board.points[toIndex]--
          }
        }
      }

      // Consume the used die value from remainingMoves
      const dieIndex = state.remainingMoves.indexOf(dieUsed)
      if (dieIndex !== -1) {
        state.remainingMoves.splice(dieIndex, 1)
      }

      // Record the move
      state.movesThisTurn.push(action.payload)
    },

    /** Archive turn to history, switch player, transition to rolling */
    endTurn(state) {
      // Archive the completed turn
      if (state.currentPlayer && state.diceRoll) {
        state.history.push({
          player: state.currentPlayer,
          diceRoll: state.diceRoll,
          moves: [...state.movesThisTurn],
        })
      }

      // Switch player
      state.currentPlayer = state.currentPlayer === 'white' ? 'black' : 'white'

      // Reset turn state
      state.diceRoll = null
      state.remainingMoves = []
      state.movesThisTurn = []
      state.availableMoves = null
      state.turnNumber++
      state.phase = 'rolling'
    },

    /** Update precomputed available moves for UI */
    setAvailableMoves(
      state,
      action: PayloadAction<readonly AvailableMoves[]>
    ) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      // Use 'any' to bypass Immer's WritableDraft type requirements.
      // This is safe: Immer doesn't mutate inputs, it creates its own draft.
      // The readonly input is assigned directly and becomes part of the
      // immutable state that Immer produces.
      ;(state as any).availableMoves = action.payload
    },

    /** Set result and transition to game_over */
    endGame(state, action: PayloadAction<GameResult>) {
      state.result = action.payload
      state.phase = 'game_over'
    },

    /** Reset to initial state */
    resetGame() {
      return initialState
    },
  },
})

export const {
  startGame,
  setFirstPlayer,
  rollDice,
  makeMove,
  endTurn,
  setAvailableMoves,
  endGame,
  resetGame,
} = gameSlice.actions

// =============================================================================
// Selectors
// =============================================================================

// Direct state selectors
export const selectBoard = (state: RootState) => state.game.board
export const selectCurrentPlayer = (state: RootState) => state.game.currentPlayer
export const selectPhase = (state: RootState) => state.game.phase
export const selectDiceRoll = (state: RootState) => state.game.diceRoll
export const selectRemainingMoves = (state: RootState) => state.game.remainingMoves
export const selectTurnNumber = (state: RootState) => state.game.turnNumber
export const selectMovesThisTurn = (state: RootState) => state.game.movesThisTurn
export const selectResult = (state: RootState) => state.game.result
export const selectHistory = (state: RootState) => state.game.history
export const selectAvailableMoves = (state: RootState) => state.game.availableMoves

// Derived selectors
export const selectBar = (state: RootState) => state.game.board.bar
export const selectBorneOff = (state: RootState) => state.game.board.borneOff
export const selectIsGameOver = (state: RootState) => state.game.phase === 'game_over'
export const selectCanRoll = (state: RootState) => state.game.phase === 'rolling'
export const selectCanMove = (state: RootState) =>
  state.game.phase === 'moving' && state.game.remainingMoves.length > 0
export const selectIsDoubles = (state: RootState) =>
  state.game.diceRoll?.die1 === state.game.diceRoll?.die2

export default gameSlice.reducer
