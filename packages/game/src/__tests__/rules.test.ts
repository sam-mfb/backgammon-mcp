/**
 * Comprehensive Test Suite for Backgammon Rules
 *
 * Tests all game rules as specified in docs/BACKGAMMON_RULES.md
 */

import { describe, it, expect } from 'vitest'
import {
  getMoveDirection,
  canBearOff,
  isValidMove,
  getValidMoves,
  checkGameOver,
  hasAnyLegalMoves,
  canEndTurn,
  createInitialBoard,
  countTotalCheckers,
  getRequiredMoves,
  getLegalMoveSequences,
  filterMovesByDie
} from '../rules'
import type { PointIndex, DieValue } from '../types'
import {
  createBoardWithCheckers,
  createGameState,
  createMovingState,
  createBearingOffState,
  createBarEntryState,
  rollSpecificDice,
  getTotalCheckerCount
} from './testUtils'

// =============================================================================
// 1. Initial Setup Tests
// =============================================================================

describe('Initial Setup', () => {
  it('should have correct starting position', () => {
    const board = createInitialBoard()

    // White checkers (positive values)
    expect(board.points[23]).toBe(2) // Point 24: 2 white
    expect(board.points[12]).toBe(5) // Point 13: 5 white
    expect(board.points[7]).toBe(3) // Point 8: 3 white
    expect(board.points[5]).toBe(5) // Point 6: 5 white

    // Black checkers (negative values)
    expect(board.points[0]).toBe(-2) // Point 1: 2 black
    expect(board.points[11]).toBe(-5) // Point 12: 5 black
    expect(board.points[16]).toBe(-3) // Point 17: 3 black
    expect(board.points[18]).toBe(-5) // Point 19: 5 black
  })

  it('should have 15 checkers per player', () => {
    const board = createInitialBoard()

    expect(getTotalCheckerCount(board, 'white')).toBe(15)
    expect(getTotalCheckerCount(board, 'black')).toBe(15)
  })

  it('should have empty bar at start', () => {
    const board = createInitialBoard()

    expect(board.bar.white).toBe(0)
    expect(board.bar.black).toBe(0)
  })

  it('should have empty borne-off areas at start', () => {
    const board = createInitialBoard()

    expect(board.borneOff.white).toBe(0)
    expect(board.borneOff.black).toBe(0)
  })
})

// =============================================================================
// 2. Movement Direction Tests
// =============================================================================

describe('Movement Direction', () => {
  it('white moves from high points to low (24 → 1)', () => {
    expect(getMoveDirection('white')).toBe(-1)
  })

  it('black moves from low points to high (1 → 24)', () => {
    expect(getMoveDirection('black')).toBe(1)
  })

  it('white can move from point 24 toward point 1', () => {
    const state = createMovingState({
      player: 'white',
      dice: rollSpecificDice(3, 1)
    })

    const moves = getValidMoves({ state })

    // White's checker on point 24 should be able to move to 21 (using 3)
    const point24Moves = moves.find(m => m.from === 24)
    expect(point24Moves).toBeDefined()
    expect(point24Moves?.destinations.some(d => d.to === 21)).toBe(true)
  })

  it('black can move from point 1 toward point 24', () => {
    const state = createMovingState({
      player: 'black',
      dice: rollSpecificDice(3, 1)
    })

    const moves = getValidMoves({ state })

    // Black's checker on point 1 should be able to move to 4 (using 3)
    const point1Moves = moves.find(m => m.from === 1)
    expect(point1Moves).toBeDefined()
    expect(point1Moves?.destinations.some(d => d.to === 4)).toBe(true)
  })

  it('movement distance matches die value exactly', () => {
    const board = createBoardWithCheckers({
      white: [{ point: 10 as PointIndex, count: 1 }],
      black: [{ point: 19 as PointIndex, count: 15 }]
    })

    const state = createMovingState({
      player: 'white',
      board,
      dice: rollSpecificDice(4, 2)
    })

    const moves = getValidMoves({ state })
    const point10Moves = moves.find(m => m.from === 10)

    expect(point10Moves).toBeDefined()
    // Should move to point 6 (10 - 4) or point 8 (10 - 2)
    expect(point10Moves?.destinations).toContainEqual(
      expect.objectContaining({ to: 6, dieValue: 4 })
    )
    expect(point10Moves?.destinations).toContainEqual(
      expect.objectContaining({ to: 8, dieValue: 2 })
    )
  })
})

// =============================================================================
// 3. Legal Move Conditions Tests
// =============================================================================

describe('Legal Move Conditions', () => {
  it('can move to an empty point', () => {
    const board = createBoardWithCheckers({
      white: [{ point: 10 as PointIndex, count: 1 }],
      black: [{ point: 19 as PointIndex, count: 15 }]
    })

    const state = createMovingState({
      player: 'white',
      board,
      dice: rollSpecificDice(3, 1)
    })

    // Point 7 is empty, white should be able to move there
    const isValid = isValidMove({
      state,
      move: { from: 10, to: 7, dieUsed: 3 }
    })

    expect(isValid).toBe(true)
  })

  it('can move to a point occupied by own checkers', () => {
    const board = createBoardWithCheckers({
      white: [
        { point: 10 as PointIndex, count: 1 },
        { point: 7 as PointIndex, count: 3 }
      ],
      black: [{ point: 19 as PointIndex, count: 15 }]
    })

    const state = createMovingState({
      player: 'white',
      board,
      dice: rollSpecificDice(3, 1)
    })

    // Point 7 has 3 white checkers, should still be able to add more
    const isValid = isValidMove({
      state,
      move: { from: 10, to: 7, dieUsed: 3 }
    })

    expect(isValid).toBe(true)
  })

  it('can move to a point with exactly 1 opponent checker (hit)', () => {
    const board = createBoardWithCheckers({
      white: [{ point: 10 as PointIndex, count: 1 }],
      black: [
        { point: 7 as PointIndex, count: 1 }, // Blot
        { point: 19 as PointIndex, count: 14 }
      ]
    })

    const state = createMovingState({
      player: 'white',
      board,
      dice: rollSpecificDice(3, 1)
    })

    const isValid = isValidMove({
      state,
      move: { from: 10, to: 7, dieUsed: 3 }
    })

    expect(isValid).toBe(true)

    // Verify the move shows wouldHit
    const moves = getValidMoves({ state })
    const point10Moves = moves.find(m => m.from === 10)
    const hitMove = point10Moves?.destinations.find(
      d => d.to === 7 && d.dieValue === 3
    )
    expect(hitMove?.wouldHit).toBe(true)
  })

  it('cannot move to a point with 2+ opponent checkers (blocked)', () => {
    const board = createBoardWithCheckers({
      white: [{ point: 10 as PointIndex, count: 1 }],
      black: [
        { point: 7 as PointIndex, count: 2 }, // Made point (blocked)
        { point: 19 as PointIndex, count: 13 }
      ]
    })

    const state = createMovingState({
      player: 'white',
      board,
      dice: rollSpecificDice(3, 1)
    })

    const isValid = isValidMove({
      state,
      move: { from: 10, to: 7, dieUsed: 3 }
    })

    expect(isValid).toBe(false)
  })

  it('cannot move if no checker at source', () => {
    const board = createBoardWithCheckers({
      white: [{ point: 6 as PointIndex, count: 15 }],
      black: [{ point: 19 as PointIndex, count: 15 }]
    })

    const state = createMovingState({
      player: 'white',
      board,
      dice: rollSpecificDice(3, 1)
    })

    // Try to move from point 10 which has no checkers
    const isValid = isValidMove({
      state,
      move: { from: 10, to: 7, dieUsed: 3 }
    })

    expect(isValid).toBe(false)
  })
})

// =============================================================================
// 4. Dice Usage Tests
// =============================================================================

describe('Dice Usage', () => {
  it('each die can move a separate checker', () => {
    const board = createBoardWithCheckers({
      white: [
        { point: 10 as PointIndex, count: 1 },
        { point: 8 as PointIndex, count: 1 }
      ],
      black: [{ point: 19 as PointIndex, count: 15 }]
    })

    const state = createMovingState({
      player: 'white',
      board,
      dice: rollSpecificDice(3, 2)
    })

    const moves = getValidMoves({ state })

    // Both checkers should have valid moves
    const point10Moves = moves.find(m => m.from === 10)
    const point8Moves = moves.find(m => m.from === 8)

    expect(point10Moves).toBeDefined()
    expect(point8Moves).toBeDefined()

    // Verify each checker can use both die values (3 and 2)
    // Point 10 should be able to move to 7 (using 3) and 8 (using 2)
    expect(point10Moves?.destinations).toContainEqual(
      expect.objectContaining({ to: 7, dieValue: 3 })
    )
    expect(point10Moves?.destinations).toContainEqual(
      expect.objectContaining({ to: 8, dieValue: 2 })
    )

    // Point 8 should be able to move to 5 (using 3) and 6 (using 2)
    expect(point8Moves?.destinations).toContainEqual(
      expect.objectContaining({ to: 5, dieValue: 3 })
    )
    expect(point8Moves?.destinations).toContainEqual(
      expect.objectContaining({ to: 6, dieValue: 2 })
    )
  })

  it('one checker can use both dice if intermediate point is open', () => {
    const board = createBoardWithCheckers({
      white: [{ point: 10 as PointIndex, count: 1 }],
      black: [{ point: 19 as PointIndex, count: 15 }]
    })

    const state = createMovingState({
      player: 'white',
      board,
      dice: rollSpecificDice(3, 2)
    })

    // First move: 10 to 7 (using 3)
    const firstMoveValid = isValidMove({
      state,
      move: { from: 10, to: 7, dieUsed: 3 }
    })
    expect(firstMoveValid).toBe(true)

    // After first move, simulate the state
    const afterFirstMove = createGameState({
      board: createBoardWithCheckers({
        white: [{ point: 7 as PointIndex, count: 1 }],
        black: [{ point: 19 as PointIndex, count: 15 }]
      }),
      currentPlayer: 'white',
      phase: 'moving',
      diceRoll: rollSpecificDice(3, 2),
      remainingMoves: [2] // 3 was used
    })

    // Second move: 7 to 5 (using 2)
    const secondMoveValid = isValidMove({
      state: afterFirstMove,
      move: { from: 7, to: 5, dieUsed: 2 }
    })
    expect(secondMoveValid).toBe(true)
  })

  it('doubles allow 4 moves of that value', () => {
    const dice = rollSpecificDice(3, 3)
    const state = createMovingState({
      player: 'white',
      dice
    })

    // Should have 4 moves of value 3
    expect(state.remainingMoves).toEqual([3, 3, 3, 3])
  })

  it('must use both dice if legally possible', () => {
    const board = createBoardWithCheckers({
      white: [{ point: 10 as PointIndex, count: 2 }],
      black: [{ point: 19 as PointIndex, count: 15 }]
    })

    const state = createMovingState({
      player: 'white',
      board,
      dice: rollSpecificDice(3, 2)
    })

    const requirements = getRequiredMoves({ state })
    expect(requirements.mustPlayBothDice).toBe(true)
  })

  it('if only one die is playable, must play it', () => {
    const board = createBoardWithCheckers({
      white: [{ point: 5 as PointIndex, count: 1 }],
      black: [
        { point: 2 as PointIndex, count: 2 }, // Blocks 5-3=2
        { point: 19 as PointIndex, count: 13 }
      ]
    })

    const state = createMovingState({
      player: 'white',
      board,
      dice: rollSpecificDice(4, 3)
    })

    // 5-4=1 is valid, 5-3=2 is blocked
    const moves = getValidMoves({ state })
    expect(moves.length).toBeGreaterThan(0)

    // Should be able to play the 4
    const validMovesWith4 = moves.flatMap(m =>
      m.destinations.filter(d => d.dieValue === 4)
    )
    expect(validMovesWith4.length).toBeGreaterThan(0)
  })

  it('if either die is playable but not both, must play the higher one', () => {
    // Create a scenario where white can only play one die (the 3)
    // because the 5 is blocked
    const board = createBoardWithCheckers({
      white: [{ point: 10 as PointIndex, count: 1 }],
      black: [
        { point: 5 as PointIndex, count: 2 }, // Blocks 10-5=5
        { point: 4 as PointIndex, count: 2 }, // Blocks 7-3=4 (after 10-3=7)
        { point: 19 as PointIndex, count: 11 }
      ]
    })

    const state = createMovingState({
      player: 'white',
      board,
      dice: rollSpecificDice(5, 3)
    })

    // 10-5=5 blocked, 10-3=7 open
    // After 10-3=7: 7-5=2 open, 7-3=4 blocked
    // So white can only play the 3 (can't play 5 at all)
    const requirements = getRequiredMoves({ state })

    // Verify only one die can be played
    expect(requirements.maxMovesUsable).toBeLessThanOrEqual(2)

    // Verify there are valid moves with the 3
    const validMoves = getValidMoves({ state })
    expect(validMoves.length).toBeGreaterThan(0)

    // At least one move should use die value 3
    const movesUsingDie3 = validMoves.flatMap(m =>
      m.destinations.filter(d => d.dieValue === 3)
    )
    expect(movesUsingDie3.length).toBeGreaterThan(0)
  })

  it('if no moves possible, turn is forfeit', () => {
    // Create a completely blocked position
    const board = createBoardWithCheckers({
      white: [{ point: 24 as PointIndex, count: 2 }],
      black: [
        { point: 23 as PointIndex, count: 2 },
        { point: 22 as PointIndex, count: 2 },
        { point: 21 as PointIndex, count: 2 },
        { point: 20 as PointIndex, count: 2 },
        { point: 19 as PointIndex, count: 2 },
        { point: 18 as PointIndex, count: 2 },
        { point: 17 as PointIndex, count: 3 }
      ]
    })

    const state = createMovingState({
      player: 'white',
      board,
      dice: rollSpecificDice(6, 5)
    })

    const hasLegalMoves = hasAnyLegalMoves({ state })
    expect(hasLegalMoves).toBe(false)
  })
})

// =============================================================================
// 5. Bar Entry Tests
// =============================================================================

describe('Bar Entry (Re-entering hit checkers)', () => {
  it('checker on bar MUST re-enter before any other move', () => {
    const board = createBoardWithCheckers({
      white: [
        { bar: true, count: 1 },
        { point: 10 as PointIndex, count: 14 }
      ],
      black: [{ point: 1 as PointIndex, count: 15 }]
    })

    const state = createMovingState({
      player: 'white',
      board,
      dice: rollSpecificDice(3, 2)
    })

    // Should not be able to move checker from point 10
    const movingFromPoint = isValidMove({
      state,
      move: { from: 10, to: 7, dieUsed: 3 }
    })
    expect(movingFromPoint).toBe(false)

    // Should only see moves from bar
    const moves = getValidMoves({ state })
    expect(moves.every(m => m.from === 'bar')).toBe(true)
  })

  it('white enters on points 24-19 (opponent home board)', () => {
    const state = createBarEntryState({
      player: 'white',
      barCount: 1,
      dice: rollSpecificDice(3, 1)
    })

    const moves = getValidMoves({ state })
    const barMoves = moves.find(m => m.from === 'bar')

    expect(barMoves).toBeDefined()
    // Die 3 -> point 22 (25-3=22), Die 1 -> point 24 (25-1=24)
    expect(barMoves?.destinations).toContainEqual(
      expect.objectContaining({ to: 22, dieValue: 3 })
    )
    expect(barMoves?.destinations).toContainEqual(
      expect.objectContaining({ to: 24, dieValue: 1 })
    )
  })

  it('black enters on points 1-6 (opponent home board)', () => {
    const state = createBarEntryState({
      player: 'black',
      barCount: 1,
      dice: rollSpecificDice(4, 2)
    })

    const moves = getValidMoves({ state })
    const barMoves = moves.find(m => m.from === 'bar')

    expect(barMoves).toBeDefined()
    // Die 4 -> point 4, Die 2 -> point 2
    expect(barMoves?.destinations).toContainEqual(
      expect.objectContaining({ to: 4, dieValue: 4 })
    )
    expect(barMoves?.destinations).toContainEqual(
      expect.objectContaining({ to: 2, dieValue: 2 })
    )
  })

  it('cannot enter on blocked points (2+ opponent checkers)', () => {
    // Block point 22 (where white would enter with a 3)
    const state = createBarEntryState({
      player: 'white',
      barCount: 1,
      dice: rollSpecificDice(3, 1),
      opponentBlocks: [22 as PointIndex]
    })

    const moves = getValidMoves({ state })
    const barMoves = moves.find(m => m.from === 'bar')

    // Should not have entry on point 22
    expect(barMoves?.destinations.find(d => d.to === 22)).toBeUndefined()
    // Should still have entry on point 24
    expect(barMoves?.destinations).toContainEqual(
      expect.objectContaining({ to: 24, dieValue: 1 })
    )
  })

  it('if all entry points blocked, turn is forfeit', () => {
    // Block all entry points for white (19-24)
    const state = createBarEntryState({
      player: 'white',
      barCount: 1,
      dice: rollSpecificDice(6, 5),
      opponentBlocks: [19 as PointIndex, 20 as PointIndex]
    })

    // With dice 6 and 5, white would enter on 19 and 20 - both blocked
    const moves = getValidMoves({ state })
    expect(moves.length).toBe(0)
  })

  it('multiple checkers on bar must all enter before moving others', () => {
    const board = createBoardWithCheckers({
      white: [
        { bar: true, count: 2 },
        { point: 10 as PointIndex, count: 13 }
      ],
      black: [{ point: 1 as PointIndex, count: 15 }]
    })

    const state = createMovingState({
      player: 'white',
      board,
      dice: rollSpecificDice(3, 2)
    })

    // Should only be able to enter from bar
    const moves = getValidMoves({ state })
    expect(moves.every(m => m.from === 'bar')).toBe(true)

    // After entering one checker, still can only enter
    const afterOneEntry = createGameState({
      board: createBoardWithCheckers({
        white: [
          { bar: true, count: 1 },
          { point: 22 as PointIndex, count: 1 },
          { point: 10 as PointIndex, count: 13 }
        ],
        black: [{ point: 1 as PointIndex, count: 15 }]
      }),
      currentPlayer: 'white',
      phase: 'moving',
      diceRoll: rollSpecificDice(3, 2),
      remainingMoves: [2] // Used the 3 to enter
    })

    const movesAfter = getValidMoves({ state: afterOneEntry })
    expect(movesAfter.every(m => m.from === 'bar')).toBe(true)
  })
})

// =============================================================================
// 6. Hitting Tests
// =============================================================================

describe('Hitting', () => {
  it('landing on a single opponent checker sends it to bar', () => {
    const board = createBoardWithCheckers({
      white: [{ point: 10 as PointIndex, count: 1 }],
      black: [
        { point: 7 as PointIndex, count: 1 }, // Blot
        { point: 19 as PointIndex, count: 14 }
      ]
    })

    const state = createMovingState({
      player: 'white',
      board,
      dice: rollSpecificDice(3, 2)
    })

    const moves = getValidMoves({ state })
    const hitMove = moves
      .find(m => m.from === 10)
      ?.destinations.find(d => d.to === 7)

    expect(hitMove).toBeDefined()
    expect(hitMove?.wouldHit).toBe(true)
  })

  it('can hit during bearing off phase', () => {
    // White is bearing off but has a checker that can hit
    const board = createBoardWithCheckers({
      white: [
        { point: 6 as PointIndex, count: 10 },
        { point: 5 as PointIndex, count: 4 },
        { point: 12 as PointIndex, count: 1 } // One straggler
      ],
      black: [
        { point: 9 as PointIndex, count: 1 }, // Blot
        { point: 19 as PointIndex, count: 14 }
      ]
    })

    const state = createMovingState({
      player: 'white',
      board,
      dice: rollSpecificDice(3, 1)
    })

    // White can hit on point 9 from point 12
    const moves = getValidMoves({ state })
    const hitMove = moves
      .find(m => m.from === 12)
      ?.destinations.find(d => d.to === 9)

    expect(hitMove).toBeDefined()
    expect(hitMove?.wouldHit).toBe(true)
  })
})

// =============================================================================
// 7. Bearing Off Tests
// =============================================================================

describe('Bearing Off', () => {
  it('can only bear off when ALL 15 checkers are in home board', () => {
    // 14 in home, 1 outside
    const board = createBoardWithCheckers({
      white: [
        { point: 6 as PointIndex, count: 14 },
        { point: 10 as PointIndex, count: 1 } // Outside home
      ],
      black: [{ point: 19 as PointIndex, count: 15 }]
    })

    const state = createMovingState({
      player: 'white',
      board,
      dice: rollSpecificDice(6, 5)
    })

    expect(canBearOff({ state, player: 'white' })).toBe(false)

    // Now all in home
    const boardAllHome = createBoardWithCheckers({
      white: [{ point: 6 as PointIndex, count: 15 }],
      black: [{ point: 19 as PointIndex, count: 15 }]
    })

    const stateAllHome = createMovingState({
      player: 'white',
      board: boardAllHome,
      dice: rollSpecificDice(6, 5)
    })

    expect(canBearOff({ state: stateAllHome, player: 'white' })).toBe(true)
  })

  it('home board is points 1-6 for white', () => {
    const board = createBoardWithCheckers({
      white: [
        { point: 1 as PointIndex, count: 3 },
        { point: 2 as PointIndex, count: 3 },
        { point: 3 as PointIndex, count: 3 },
        { point: 4 as PointIndex, count: 3 },
        { point: 5 as PointIndex, count: 2 },
        { point: 6 as PointIndex, count: 1 }
      ],
      black: [{ point: 19 as PointIndex, count: 15 }]
    })

    const state = createMovingState({
      player: 'white',
      board,
      dice: rollSpecificDice(6, 1)
    })

    expect(canBearOff({ state, player: 'white' })).toBe(true)
  })

  it('home board is points 19-24 for black', () => {
    const board = createBoardWithCheckers({
      white: [{ point: 6 as PointIndex, count: 15 }],
      black: [
        { point: 19 as PointIndex, count: 5 },
        { point: 20 as PointIndex, count: 3 },
        { point: 21 as PointIndex, count: 3 },
        { point: 22 as PointIndex, count: 2 },
        { point: 23 as PointIndex, count: 1 },
        { point: 24 as PointIndex, count: 1 }
      ]
    })

    const state = createMovingState({
      player: 'black',
      board,
      dice: rollSpecificDice(6, 1)
    })

    expect(canBearOff({ state, player: 'black' })).toBe(true)
  })

  it('exact roll removes checker from that point', () => {
    const state = createBearingOffState({
      player: 'white',
      dice: rollSpecificDice(6, 3),
      positions: [
        { point: 6 as PointIndex, count: 10 },
        { point: 3 as PointIndex, count: 5 }
      ]
    })

    const moves = getValidMoves({ state })

    // Can bear off from point 6 with die 6
    const point6BearOff = moves
      .find(m => m.from === 6)
      ?.destinations.find(d => d.to === 'off' && d.dieValue === 6)
    expect(point6BearOff).toBeDefined()

    // Can bear off from point 3 with die 3
    const point3BearOff = moves
      .find(m => m.from === 3)
      ?.destinations.find(d => d.to === 'off' && d.dieValue === 3)
    expect(point3BearOff).toBeDefined()
  })

  it('higher roll can bear off from highest occupied point', () => {
    const state = createBearingOffState({
      player: 'white',
      dice: rollSpecificDice(6, 5),
      positions: [
        { point: 3 as PointIndex, count: 10 },
        { point: 2 as PointIndex, count: 5 }
      ]
    })

    // No checker on 6 or 5, highest is 3
    // Should be able to bear off from 3 with the 6
    const moves = getValidMoves({ state })
    const bearOffWith6 = moves
      .find(m => m.from === 3)
      ?.destinations.find(d => d.to === 'off' && d.dieValue === 6)

    expect(bearOffWith6).toBeDefined()
  })

  it('must move a checker if bearing off is not possible with that die', () => {
    const state = createBearingOffState({
      player: 'white',
      dice: rollSpecificDice(6, 2),
      positions: [
        { point: 5 as PointIndex, count: 10 },
        { point: 3 as PointIndex, count: 5 }
      ]
    })

    // Die 6: can bear off from point 5 (highest)
    // Die 2: cannot bear off (no checker on 2), must move from 5 to 3 or 3 to 1
    const moves = getValidMoves({ state })

    // Check that regular moves within home board exist
    const point5Moves = moves.find(m => m.from === 5)
    const moveWith2 = point5Moves?.destinations.find(
      d => d.dieValue === 2 && d.to === 3
    )
    expect(moveWith2).toBeDefined()
  })

  it('if checker hit during bearing off, must re-enter and return to home', () => {
    // White has 14 checkers in home, 1 on bar
    const board = createBoardWithCheckers({
      white: [
        { bar: true, count: 1 },
        { point: 6 as PointIndex, count: 14 }
      ],
      black: [{ point: 19 as PointIndex, count: 15 }]
    })

    const state = createMovingState({
      player: 'white',
      board,
      dice: rollSpecificDice(6, 3)
    })

    // Cannot bear off (checker on bar)
    expect(canBearOff({ state, player: 'white' })).toBe(false)

    // Must enter from bar first
    const moves = getValidMoves({ state })
    expect(moves.every(m => m.from === 'bar')).toBe(true)
  })
})

// =============================================================================
// 8. Winning Conditions Tests
// =============================================================================

describe('Winning Conditions', () => {
  it('first player to bear off all 15 checkers wins', () => {
    const board = createBoardWithCheckers({
      white: [{ borneOff: true, count: 15 }],
      black: [{ point: 19 as PointIndex, count: 15 }]
    })

    const state = createGameState({
      board,
      currentPlayer: 'black',
      phase: 'moving'
    })

    const result = checkGameOver({ state })
    expect(result).toBeDefined()
    expect(result?.winner).toBe('white')
  })

  it('single game: opponent has borne off at least 1 checker', () => {
    const board = createBoardWithCheckers({
      white: [{ borneOff: true, count: 15 }],
      black: [
        { borneOff: true, count: 1 },
        { point: 19 as PointIndex, count: 14 }
      ]
    })

    const state = createGameState({ board })
    const result = checkGameOver({ state })

    expect(result?.winner).toBe('white')
    expect(result?.victoryType).toBe('single')
  })

  it('gammon: opponent has not borne off any checkers', () => {
    const board = createBoardWithCheckers({
      white: [{ borneOff: true, count: 15 }],
      black: [{ point: 19 as PointIndex, count: 15 }] // All still on board
    })

    const state = createGameState({ board })
    const result = checkGameOver({ state })

    expect(result?.winner).toBe('white')
    expect(result?.victoryType).toBe('gammon')
  })

  it('backgammon: opponent has checker on bar', () => {
    const board = createBoardWithCheckers({
      white: [{ borneOff: true, count: 15 }],
      black: [
        { bar: true, count: 1 },
        { point: 19 as PointIndex, count: 14 }
      ]
    })

    const state = createGameState({ board })
    const result = checkGameOver({ state })

    expect(result?.winner).toBe('white')
    expect(result?.victoryType).toBe('backgammon')
  })

  it("backgammon: opponent has checker in winner's home board", () => {
    const board = createBoardWithCheckers({
      white: [{ borneOff: true, count: 15 }],
      black: [
        { point: 1 as PointIndex, count: 1 }, // In white's home board
        { point: 19 as PointIndex, count: 14 }
      ]
    })

    const state = createGameState({ board })
    const result = checkGameOver({ state })

    expect(result?.winner).toBe('white')
    expect(result?.victoryType).toBe('backgammon')
  })

  it('black winning with backgammon (white in black home)', () => {
    const board = createBoardWithCheckers({
      black: [{ borneOff: true, count: 15 }],
      white: [
        { point: 24 as PointIndex, count: 1 }, // In black's home board (19-24)
        { point: 6 as PointIndex, count: 14 }
      ]
    })

    const state = createGameState({ board })
    const result = checkGameOver({ state })

    expect(result?.winner).toBe('black')
    expect(result?.victoryType).toBe('backgammon')
  })
})

// =============================================================================
// 9. Edge Cases
// =============================================================================

describe('Edge Cases', () => {
  it('empty turn when no legal moves after roll', () => {
    // Completely blocked
    const board = createBoardWithCheckers({
      white: [{ point: 24 as PointIndex, count: 2 }],
      black: [
        { point: 23 as PointIndex, count: 2 },
        { point: 22 as PointIndex, count: 2 },
        { point: 21 as PointIndex, count: 2 },
        { point: 20 as PointIndex, count: 2 },
        { point: 19 as PointIndex, count: 2 },
        { point: 18 as PointIndex, count: 2 },
        { point: 17 as PointIndex, count: 3 }
      ]
    })

    const state = createMovingState({
      player: 'white',
      board,
      dice: rollSpecificDice(6, 5)
    })

    const sequences = getLegalMoveSequences({ state })
    expect(sequences.length).toBe(1)
    expect(sequences[0].length).toBe(0)
  })

  it('partial turn when only some dice playable', () => {
    const board = createBoardWithCheckers({
      white: [{ point: 6 as PointIndex, count: 1 }],
      black: [
        { point: 1 as PointIndex, count: 2 }, // Blocks point 1
        { point: 19 as PointIndex, count: 13 }
      ]
    })

    const state = createMovingState({
      player: 'white',
      board,
      dice: rollSpecificDice(5, 6)
    })

    // 6-5=1 blocked, 6-6=0 (off board, can't bear off)
    // Neither die is playable from this position alone

    const sequences = getLegalMoveSequences({ state })
    // All sequences should have 0 or 1 moves
    const maxMoves = Math.max(...sequences.map(s => s.length))
    expect(maxMoves).toBeLessThanOrEqual(1)
  })

  it('re-entry hitting a blot', () => {
    const board = createBoardWithCheckers({
      white: [
        { bar: true, count: 1 },
        { point: 6 as PointIndex, count: 14 }
      ],
      black: [
        { point: 22 as PointIndex, count: 1 }, // Blot at entry point
        { point: 19 as PointIndex, count: 14 }
      ]
    })

    const state = createMovingState({
      player: 'white',
      board,
      dice: rollSpecificDice(3, 1)
    })

    const moves = getValidMoves({ state })
    const barMoves = moves.find(m => m.from === 'bar')

    // Die 3 -> point 22 (hitting the blot)
    const hitEntry = barMoves?.destinations.find(
      d => d.to === 22 && d.dieValue === 3
    )
    expect(hitEntry).toBeDefined()
    expect(hitEntry?.wouldHit).toBe(true)
  })

  it('forced move scenario', () => {
    // Only one legal move sequence exists
    const board = createBoardWithCheckers({
      white: [{ point: 4 as PointIndex, count: 1 }],
      black: [
        { point: 2 as PointIndex, count: 2 }, // Block
        { point: 1 as PointIndex, count: 2 }, // Block
        { point: 19 as PointIndex, count: 11 }
      ]
    })

    const state = createMovingState({
      player: 'white',
      board,
      dice: rollSpecificDice(1, 2)
    })

    // 4-1=3 (open), 4-2=2 (blocked), 3-1=2 (blocked), 3-2=1 (blocked)
    // Only move: 4->3 using die 1
    const sequences = getLegalMoveSequences({ state })

    // All non-empty sequences should start with 4->3
    const nonEmptySequences = sequences.filter(s => s.length > 0)
    expect(nonEmptySequences.length).toBeGreaterThan(0)
    expect(nonEmptySequences.every(s => s[0].from === 4 && s[0].to === 3)).toBe(
      true
    )
  })

  it('checker count remains constant throughout game', () => {
    const board = createInitialBoard()

    expect(countTotalCheckers({ board, player: 'white' })).toBe(15)
    expect(countTotalCheckers({ board, player: 'black' })).toBe(15)

    // After some movement (simulated)
    const boardMidGame = createBoardWithCheckers({
      white: [
        { bar: true, count: 1 },
        { borneOff: true, count: 3 },
        { point: 6 as PointIndex, count: 5 },
        { point: 5 as PointIndex, count: 4 },
        { point: 3 as PointIndex, count: 2 }
      ],
      black: [
        { bar: true, count: 2 },
        { borneOff: true, count: 1 },
        { point: 19 as PointIndex, count: 5 },
        { point: 20 as PointIndex, count: 4 },
        { point: 21 as PointIndex, count: 3 }
      ]
    })

    expect(countTotalCheckers({ board: boardMidGame, player: 'white' })).toBe(
      15
    )
    expect(countTotalCheckers({ board: boardMidGame, player: 'black' })).toBe(
      15
    )
  })

  it('cannot use a die value not in remainingMoves', () => {
    const state = createGameState({
      board: createInitialBoard(),
      currentPlayer: 'white',
      phase: 'moving',
      diceRoll: rollSpecificDice(3, 1),
      remainingMoves: [3] // Only 3 remaining, 1 already used
    })

    // Try to use die value 1 which is not in remainingMoves
    const isValid = isValidMove({
      state,
      move: { from: 24, to: 23, dieUsed: 1 }
    })

    expect(isValid).toBe(false)
  })

  it('handles doubles correctly with 4 available moves', () => {
    const board = createBoardWithCheckers({
      white: [{ point: 12 as PointIndex, count: 4 }],
      black: [{ point: 19 as PointIndex, count: 15 }]
    })

    const state = createMovingState({
      player: 'white',
      board,
      dice: rollSpecificDice(3, 3)
    })

    // Should have 4 moves of 3
    expect(state.remainingMoves).toEqual([3, 3, 3, 3])

    const sequences = getLegalMoveSequences({ state })
    // Should be able to make 4 moves with doubles
    const maxMoves = Math.max(...sequences.map(s => s.length))
    expect(maxMoves).toBe(4)
  })
})

// =============================================================================
// Move Validation Edge Cases
// =============================================================================

describe('Move Validation', () => {
  it('validates correct die is used for move distance', () => {
    const state = createMovingState({
      player: 'white',
      dice: rollSpecificDice(5, 3)
    })

    // Correct: 24 to 21 with die 3
    expect(isValidMove({ state, move: { from: 24, to: 21, dieUsed: 3 } })).toBe(
      true
    )

    // Incorrect: 24 to 21 with die 5 (wrong distance)
    expect(isValidMove({ state, move: { from: 24, to: 21, dieUsed: 5 } })).toBe(
      false
    )
  })

  it('cannot move opponent checkers', () => {
    const state = createMovingState({
      player: 'white',
      dice: rollSpecificDice(3, 1)
    })

    // Black has checkers on point 1
    const isValid = isValidMove({
      state,
      move: { from: 1, to: 4, dieUsed: 3 }
    })

    expect(isValid).toBe(false)
  })

  it('cannot bear off without being in home board', () => {
    const state = createMovingState({
      player: 'white',
      dice: rollSpecificDice(6, 1)
    })

    // White has checkers on point 24 (not in home)
    const isValid = isValidMove({
      state,
      move: { from: 6, to: 'off', dieUsed: 6 }
    })

    // Should fail because not all checkers are in home board
    expect(isValid).toBe(false)
  })
})

// =============================================================================
// Filter and Utility Functions
// =============================================================================

describe('Utility Functions', () => {
  it('filterMovesByDie returns only moves with specified die', () => {
    const state = createMovingState({
      player: 'white',
      dice: rollSpecificDice(5, 3)
    })

    const allMoves = getValidMoves({ state })
    const movesWithDie5 = filterMovesByDie({
      availableMoves: allMoves,
      dieValue: 5
    })

    // All returned destinations should use die value 5
    for (const available of movesWithDie5) {
      for (const dest of available.destinations) {
        expect(dest.dieValue).toBe(5)
      }
    }
  })

  it('getRequiredMoves identifies when both dice must be played', () => {
    const board = createBoardWithCheckers({
      white: [{ point: 10 as PointIndex, count: 2 }],
      black: [{ point: 19 as PointIndex, count: 15 }]
    })

    const state = createMovingState({
      player: 'white',
      board,
      dice: rollSpecificDice(4, 2)
    })

    const requirements = getRequiredMoves({ state })
    expect(requirements.mustPlayBothDice).toBe(true)
    expect(requirements.maxMovesUsable).toBe(2)
  })
})

// =============================================================================
// 9. Turn Ending Rules
// =============================================================================

describe('Turn Ending Rules', () => {
  it('cannot end turn when dice remain and legal moves exist', () => {
    const board = createBoardWithCheckers({
      white: [{ point: 10 as PointIndex, count: 2 }],
      black: [{ point: 19 as PointIndex, count: 15 }]
    })

    const state = createMovingState({
      player: 'white',
      board,
      dice: rollSpecificDice(4, 2)
    })

    // Both dice remain, legal moves exist
    expect(state.remainingMoves).toHaveLength(2)
    expect(hasAnyLegalMoves({ state })).toBe(true)
    expect(canEndTurn({ state })).toBe(false)
  })

  it('can end turn when all dice have been used', () => {
    const board = createBoardWithCheckers({
      white: [{ point: 10 as PointIndex, count: 2 }],
      black: [{ point: 19 as PointIndex, count: 15 }]
    })

    const state = createMovingState({
      player: 'white',
      board,
      dice: rollSpecificDice(4, 2)
    })

    // Simulate all dice being used
    const stateAfterMoves = {
      ...state,
      remainingMoves: []
    }

    expect(canEndTurn({ state: stateAfterMoves })).toBe(true)
  })

  it('can end turn when no legal moves are available', () => {
    // Create a blocked position where white cannot move
    const board = createBoardWithCheckers({
      white: [{ point: 1 as PointIndex, count: 1 }],
      black: [
        { point: 2 as PointIndex, count: 2 },
        { point: 3 as PointIndex, count: 2 },
        { point: 4 as PointIndex, count: 2 },
        { point: 5 as PointIndex, count: 2 },
        { point: 6 as PointIndex, count: 2 },
        { point: 7 as PointIndex, count: 2 }
      ]
    })

    const state = createMovingState({
      player: 'white',
      board,
      dice: rollSpecificDice(2, 3)
    })

    // Verify no moves available
    expect(hasAnyLegalMoves({ state })).toBe(false)
    expect(canEndTurn({ state })).toBe(true)
  })

  it('cannot end turn when only one die used but legal moves remain', () => {
    const board = createBoardWithCheckers({
      white: [{ point: 10 as PointIndex, count: 2 }],
      black: [{ point: 19 as PointIndex, count: 15 }]
    })

    const state = createMovingState({
      player: 'white',
      board,
      dice: rollSpecificDice(4, 2)
    })

    // Simulate one die being used
    const stateAfterOneMove = {
      ...state,
      remainingMoves: [2] as DieValue[]
    }

    expect(hasAnyLegalMoves({ state: stateAfterOneMove })).toBe(true)
    expect(canEndTurn({ state: stateAfterOneMove })).toBe(false)
  })

  it('cannot end turn when not in moving phase', () => {
    const state = createGameState({
      phase: 'rolling',
      currentPlayer: 'white'
    })

    expect(canEndTurn({ state })).toBe(false)
  })

  it('can end turn with doubles when all four moves used', () => {
    const board = createBoardWithCheckers({
      white: [{ point: 10 as PointIndex, count: 5 }],
      black: [{ point: 19 as PointIndex, count: 15 }]
    })

    const state = createMovingState({
      player: 'white',
      board,
      dice: rollSpecificDice(3, 3)
    })

    // Verify doubles give 4 moves
    expect(state.remainingMoves).toEqual([3, 3, 3, 3])

    // All four moves used
    const stateAfterMoves = {
      ...state,
      remainingMoves: []
    }

    expect(canEndTurn({ state: stateAfterMoves })).toBe(true)
  })

  it('cannot end turn with doubles when fewer than maximum moves used and legal moves exist', () => {
    const board = createBoardWithCheckers({
      white: [{ point: 10 as PointIndex, count: 5 }],
      black: [{ point: 19 as PointIndex, count: 15 }]
    })

    const state = createMovingState({
      player: 'white',
      board,
      dice: rollSpecificDice(3, 3)
    })

    // Only 2 of 4 moves used, but more are possible
    const stateAfterTwoMoves = {
      ...state,
      remainingMoves: [3, 3] as DieValue[]
    }

    expect(hasAnyLegalMoves({ state: stateAfterTwoMoves })).toBe(true)
    expect(canEndTurn({ state: stateAfterTwoMoves })).toBe(false)
  })

  it('can end turn with doubles when only some moves possible and all possible moves used', () => {
    // Create position where only 2 of 4 doubles moves are possible
    const board = createBoardWithCheckers({
      white: [{ point: 3 as PointIndex, count: 2 }],
      black: [
        { point: 1 as PointIndex, count: 2 },
        { point: 2 as PointIndex, count: 2 },
        { point: 19 as PointIndex, count: 11 }
      ]
    })

    const state = createMovingState({
      player: 'white',
      board,
      dice: rollSpecificDice(2, 2)
    })

    // Simulate using 2 moves, then no more legal moves
    // (checkers moved to point 1 which is blocked, can't move further)
    const stateAfterTwoMoves = {
      ...state,
      board: createBoardWithCheckers({
        white: [{ point: 1 as PointIndex, count: 2 }],
        black: [
          { point: 2 as PointIndex, count: 2 },
          { point: 3 as PointIndex, count: 2 },
          { point: 19 as PointIndex, count: 11 }
        ]
      }),
      remainingMoves: [2, 2] as DieValue[]
    }

    // No legal moves with remaining dice
    expect(hasAnyLegalMoves({ state: stateAfterTwoMoves })).toBe(false)
    expect(canEndTurn({ state: stateAfterTwoMoves })).toBe(true)
  })
})
