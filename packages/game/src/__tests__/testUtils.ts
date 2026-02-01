/**
 * Test Utilities for Backgammon Game Logic
 *
 * Provides factory functions and helpers for creating test game states.
 */

import type {
  BoardState,
  DiceRoll,
  DieValue,
  GamePhase,
  GameState,
  Player,
  PointIndex,
} from '../types'
import { createInitialBoard } from '../rules'

// =============================================================================
// Types for Test Configuration
// =============================================================================

/** Position specification for setting up checkers */
export type CheckerPosition =
  | { point: PointIndex; count: number }
  | { bar: true; count: number }
  | { borneOff: true; count: number }

/** Configuration for creating a custom board state */
export interface BoardConfig {
  white?: CheckerPosition[]
  black?: CheckerPosition[]
}

/** Partial game state overrides */
export interface GameStateOverrides {
  board?: BoardState
  currentPlayer?: Player | null
  phase?: GamePhase
  diceRoll?: DiceRoll | null
  remainingMoves?: DieValue[]
}

// =============================================================================
// Dice Helpers
// =============================================================================

/**
 * Create a deterministic dice roll for testing.
 */
export function rollSpecificDice(die1: DieValue, die2: DieValue): DiceRoll {
  return { die1, die2 }
}

/**
 * Get remaining moves from a dice roll.
 */
export function getRemainingMovesFromRoll(roll: DiceRoll): DieValue[] {
  if (roll.die1 === roll.die2) {
    return [roll.die1, roll.die1, roll.die1, roll.die1]
  }
  return [roll.die1, roll.die2]
}

// =============================================================================
// Board Helpers
// =============================================================================

/**
 * Create an empty board (no checkers anywhere).
 */
export function createEmptyBoard(): BoardState {
  return {
    points: [
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ],
    bar: { white: 0, black: 0 },
    borneOff: { white: 0, black: 0 },
  }
}

/**
 * Create a board with checkers at specific positions.
 *
 * @example
 * // White has 2 checkers on point 6, black has 5 on point 19
 * const board = createBoardWithCheckers({
 *   white: [{ point: 6, count: 2 }],
 *   black: [{ point: 19, count: 5 }]
 * })
 */
export function createBoardWithCheckers(config: BoardConfig): BoardState {
  const board = createEmptyBoard()

  const mutablePoints = [...board.points] as [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
  ]
  const mutableBar = { ...board.bar }
  const mutableBorneOff = { ...board.borneOff }

  // Place white checkers (positive values)
  if (config.white) {
    for (const pos of config.white) {
      if ('point' in pos) {
        mutablePoints[pos.point - 1] = pos.count
      } else if ('bar' in pos) {
        mutableBar.white = pos.count
      } else if ('borneOff' in pos) {
        mutableBorneOff.white = pos.count
      }
    }
  }

  // Place black checkers (negative values)
  if (config.black) {
    for (const pos of config.black) {
      if ('point' in pos) {
        mutablePoints[pos.point - 1] = -pos.count
      } else if ('bar' in pos) {
        mutableBar.black = pos.count
      } else if ('borneOff' in pos) {
        mutableBorneOff.black = pos.count
      }
    }
  }

  return {
    points: mutablePoints,
    bar: mutableBar,
    borneOff: mutableBorneOff,
  }
}

// =============================================================================
// Game State Helpers
// =============================================================================

/**
 * Create a new game state with standard initial board.
 */
export function createNewGameState(): GameState {
  return {
    board: createInitialBoard(),
    currentPlayer: null,
    phase: 'not_started',
    diceRoll: null,
    remainingMoves: [],
    turnNumber: 0,
    movesThisTurn: [],
    result: null,
    history: [],
  }
}

/**
 * Create a game state with overrides for testing specific scenarios.
 *
 * @example
 * // White's turn, moving phase with 3-1 rolled
 * const state = createGameState({
 *   currentPlayer: 'white',
 *   phase: 'moving',
 *   diceRoll: rollSpecificDice(3, 1),
 *   remainingMoves: [3, 1]
 * })
 */
export function createGameState(overrides: GameStateOverrides = {}): GameState {
  const baseState = createNewGameState()

  return {
    ...baseState,
    ...overrides,
    board: overrides.board ?? baseState.board,
    currentPlayer: overrides.currentPlayer ?? baseState.currentPlayer,
    phase: overrides.phase ?? baseState.phase,
    diceRoll: overrides.diceRoll ?? baseState.diceRoll,
    remainingMoves: overrides.remainingMoves ?? baseState.remainingMoves,
  }
}

/**
 * Create a game state ready for a player to move.
 * Shorthand for creating a moving-phase state with dice rolled.
 */
export function createMovingState({
  player,
  board,
  dice,
}: {
  player: Player
  board?: BoardState
  dice: DiceRoll
}): GameState {
  return createGameState({
    board: board ?? createInitialBoard(),
    currentPlayer: player,
    phase: 'moving',
    diceRoll: dice,
    remainingMoves: getRemainingMovesFromRoll(dice),
  })
}

/**
 * Create a game state with a player ready to bear off.
 * Places all 15 checkers in the player's home board.
 */
export function createBearingOffState({
  player,
  dice,
  positions,
}: {
  player: Player
  dice: DiceRoll
  positions?: CheckerPosition[]
}): GameState {
  // Default: all checkers on the 6-point
  const defaultPositions: CheckerPosition[] =
    player === 'white'
      ? [{ point: 6 as PointIndex, count: 15 }]
      : [{ point: 19 as PointIndex, count: 15 }]

  const config: BoardConfig = {
    [player]: positions ?? defaultPositions,
  }

  return createMovingState({
    player,
    board: createBoardWithCheckers(config),
    dice,
  })
}

/**
 * Create a game state with a player having checkers on the bar.
 */
export function createBarEntryState({
  player,
  barCount,
  dice,
  opponentBlocks,
}: {
  player: Player
  barCount: number
  dice: DiceRoll
  opponentBlocks?: PointIndex[]
}): GameState {
  const opponent = player === 'white' ? 'black' : 'white'

  const playerConfig: CheckerPosition[] = [
    { bar: true, count: barCount },
    // Put remaining checkers somewhere on the board
    player === 'white'
      ? { point: 6 as PointIndex, count: 15 - barCount }
      : { point: 19 as PointIndex, count: 15 - barCount },
  ]

  const opponentConfig: CheckerPosition[] = []

  // Add opponent's blocking points (2 checkers each)
  if (opponentBlocks) {
    for (const point of opponentBlocks) {
      opponentConfig.push({ point, count: 2 })
    }
  }

  // Make sure opponent has 15 checkers total
  const opponentBlockCount = (opponentBlocks?.length ?? 0) * 2
  const remainingCount = 15 - opponentBlockCount
  if (remainingCount > 0) {
    // Put remaining on a non-blocking point
    const safePoint = (opponent === 'white' ? 6 : 19) as PointIndex
    opponentConfig.push({ point: safePoint, count: remainingCount })
  }

  const config: BoardConfig = {
    [player]: playerConfig,
    [opponent]: opponentConfig,
  }

  return createMovingState({
    player,
    board: createBoardWithCheckers(config),
    dice,
  })
}

// =============================================================================
// Assertion Helpers
// =============================================================================

/**
 * Get checker count at a point from board state.
 * Returns positive for white, negative for black.
 */
export function getPointValue(board: BoardState, point: PointIndex): number {
  return board.points[point - 1]
}

/**
 * Count checkers for a player at a specific point.
 */
export function countCheckersAt(
  board: BoardState,
  point: PointIndex,
  player: Player
): number {
  const value = board.points[point - 1]
  if (player === 'white') {
    return value > 0 ? value : 0
  } else {
    return value < 0 ? -value : 0
  }
}

/**
 * Get total checker count for a player.
 */
export function getTotalCheckerCount(board: BoardState, player: Player): number {
  let count = board.bar[player] + board.borneOff[player]

  for (let i = 0; i < 24; i++) {
    const value = board.points[i]
    if (player === 'white' && value > 0) {
      count += value
    } else if (player === 'black' && value < 0) {
      count += -value
    }
  }

  return count
}
