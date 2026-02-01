/**
 * Game Slice with Operations
 *
 * This module combines the base game slice with extraReducers
 * that handle sync thunk operations. It's the main export for
 * consumers who want to use the operations-based API.
 */

import { createSlice, createSelector, type PayloadAction } from '@reduxjs/toolkit'
import type {
  BoardState,
  DiceRoll,
  GameResult,
  GameState,
  Move,
  Player,
} from './types'
import { getOpponent } from './types'
import { checkGameOver, getValidMoves, canEndTurn, createInitialBoard } from './rules'
import { getRemainingMovesFromDice } from './dice'
import {
  performStartGame,
  performRollDice,
  performMove,
  performEndTurn,
  type StartGameAction,
  type RollDiceAction,
  type MakeMoveAction,
  type EndTurnAction,
} from './operations'

/** State shape expected by selectors - apps must configure their store with { game: GameState } */
export type RootState = { game: GameState }

/**
 * Standard backgammon starting position
 */
const INITIAL_BOARD: BoardState = {
  points: [
    -2, 0, 0, 0, 0, 5, 0, 3, 0, 0, 0, -5,
    5, 0, 0, 0, -3, 0, -5, 0, 0, 0, 0, 2,
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
        const toIndex = to - 1
        const pointValue = state.board.points[toIndex]

        if (player === 'white' && pointValue === -1) {
          state.board.points[toIndex] = 1
          state.board.bar.black++
        } else if (player === 'black' && pointValue === 1) {
          state.board.points[toIndex] = -1
          state.board.bar.white++
        } else {
          if (player === 'white') {
            state.board.points[toIndex]++
          } else {
            state.board.points[toIndex]--
          }
        }
      }

      // Consume the used die value
      const dieIndex = state.remainingMoves.indexOf(dieUsed)
      if (dieIndex !== -1) {
        state.remainingMoves.splice(dieIndex, 1)
      }

      state.movesThisTurn.push(action.payload)

      const gameResult = checkGameOver({ state: state as GameState })
      if (gameResult) {
        state.result = gameResult
        state.phase = 'game_over'
      }
    },

    /** Archive turn to history, switch player, transition to rolling */
    endTurn(state) {
      if (state.currentPlayer && state.diceRoll) {
        state.history.push({
          player: state.currentPlayer,
          diceRoll: state.diceRoll,
          moves: [...state.movesThisTurn],
        })
      }

      state.currentPlayer = state.currentPlayer === 'white' ? 'black' : 'white'
      state.diceRoll = null
      state.remainingMoves = []
      state.movesThisTurn = []
      state.turnNumber++
      state.phase = 'rolling'
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
  extraReducers: (builder) => {
    // Handle performStartGame
    builder.addMatcher(performStartGame.match, (state, action: StartGameAction) => {
      const result = action.meta.result
      if (result?.ok) {
        const { firstPlayer, diceRoll } = result.value
        const initialBoard = createInitialBoard()
        // Copy board properties individually for Immer compatibility
        for (let i = 0; i < 24; i++) {
          state.board.points[i] = initialBoard.points[i]
        }
        state.board.bar.white = initialBoard.bar.white
        state.board.bar.black = initialBoard.bar.black
        state.board.borneOff.white = initialBoard.borneOff.white
        state.board.borneOff.black = initialBoard.borneOff.black
        state.currentPlayer = firstPlayer
        state.phase = 'moving'
        state.diceRoll = diceRoll
        state.remainingMoves = getRemainingMovesFromDice(diceRoll)
        state.turnNumber = 1
        state.movesThisTurn = []
        state.result = null
        state.history = []
      }
    })

    // Handle performRollDice
    builder.addMatcher(performRollDice.match, (state, action: RollDiceAction) => {
      const result = action.meta.result
      if (result?.ok) {
        const { diceRoll, turnForfeited } = result.value

        if (turnForfeited) {
          // Auto-forfeit: switch to opponent
          const opponent = getOpponent(state.currentPlayer!)
          state.history.push({
            player: state.currentPlayer!,
            diceRoll,
            moves: [],
          })
          state.currentPlayer = opponent
          state.phase = 'rolling'
          state.diceRoll = null
          state.remainingMoves = []
          state.movesThisTurn = []
          state.turnNumber++
        } else {
          state.diceRoll = diceRoll
          state.phase = 'moving'
          state.remainingMoves = getRemainingMovesFromDice(diceRoll)
          state.movesThisTurn = []
        }
      }
    })

    // Handle performMove
    builder.addMatcher(performMove.match, (state, action: MakeMoveAction) => {
      const result = action.meta.result
      if (result?.ok) {
        const { move, gameOver, remainingMoves } = result.value
        const player = state.currentPlayer!
        const { from, to } = move

        // Remove checker from source
        if (from === 'bar') {
          state.board.bar[player]--
        } else {
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
          const toIndex = to - 1
          const pointValue = state.board.points[toIndex]

          if (player === 'white' && pointValue === -1) {
            state.board.points[toIndex] = 1
            state.board.bar.black++
          } else if (player === 'black' && pointValue === 1) {
            state.board.points[toIndex] = -1
            state.board.bar.white++
          } else {
            if (player === 'white') {
              state.board.points[toIndex]++
            } else {
              state.board.points[toIndex]--
            }
          }
        }

        // Update remaining moves
        state.remainingMoves = [...remainingMoves]
        state.movesThisTurn.push(move)

        if (gameOver) {
          state.result = gameOver
          state.phase = 'game_over'
        }
      }
    })

    // Handle performEndTurn
    builder.addMatcher(performEndTurn.match, (state, action: EndTurnAction) => {
      const result = action.meta.result
      if (result?.ok) {
        const { nextPlayer, turnNumber } = result.value

        if (state.currentPlayer && state.diceRoll) {
          state.history.push({
            player: state.currentPlayer,
            diceRoll: state.diceRoll,
            moves: [...state.movesThisTurn],
          })
        }

        state.currentPlayer = nextPlayer
        state.diceRoll = null
        state.remainingMoves = []
        state.movesThisTurn = []
        state.turnNumber = turnNumber
        state.phase = 'rolling'
      }
    })
  },
})

export const {
  startGame,
  setFirstPlayer,
  rollDice,
  makeMove,
  endTurn,
  endGame,
  resetGame,
} = gameSlice.actions

// =============================================================================
// Selectors
// =============================================================================

export const selectBoard = (state: RootState) => state.game.board
export const selectCurrentPlayer = (state: RootState) => state.game.currentPlayer
export const selectPhase = (state: RootState) => state.game.phase
export const selectDiceRoll = (state: RootState) => state.game.diceRoll
export const selectRemainingMoves = (state: RootState) => state.game.remainingMoves
export const selectTurnNumber = (state: RootState) => state.game.turnNumber
export const selectMovesThisTurn = (state: RootState) => state.game.movesThisTurn
export const selectResult = (state: RootState) => state.game.result
export const selectHistory = (state: RootState) => state.game.history
export const selectBar = (state: RootState) => state.game.board.bar
export const selectBorneOff = (state: RootState) => state.game.board.borneOff
export const selectIsGameOver = (state: RootState) => state.game.phase === 'game_over'
export const selectCanRoll = (state: RootState) => state.game.phase === 'rolling'
export const selectCanMove = (state: RootState) =>
  state.game.phase === 'moving' && state.game.remainingMoves.length > 0
export const selectIsDoubles = (state: RootState) =>
  state.game.diceRoll?.die1 === state.game.diceRoll?.die2
export const selectGameState = (state: RootState) => state.game

export const selectValidMoves = createSelector([selectGameState], (gameState) => {
  if (gameState.phase !== 'moving' || gameState.remainingMoves.length === 0) {
    return []
  }
  return getValidMoves({ state: gameState })
})

export const selectCanEndTurn = createSelector([selectGameState], (gameState) =>
  canEndTurn({ state: gameState })
)

export default gameSlice.reducer
