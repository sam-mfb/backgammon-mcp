import { createSlice } from '@reduxjs/toolkit'
import type { BoardState, GameState } from './types'

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
    // Game actions will be added here
  },
})

export default gameSlice.reducer
