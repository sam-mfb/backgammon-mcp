/**
 * Integration tests for game operations
 *
 * Tests the sync thunk operations with a real Redux store
 * to verify state transitions and Result values.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { configureStore } from '@reduxjs/toolkit'
import {
  gameReducer,
  gameSyncThunkMiddleware,
  performStartGame,
  performRollDice,
  performMove,
  performEndTurn,
  resetGame,
  getValidMoves,
  type GameState,
  type DieValue,
} from '../index'

// =============================================================================
// Test Utilities
// =============================================================================

function createTestStore() {
  return configureStore({
    reducer: { game: gameReducer },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        // Disable serializable check for sync thunk actions
        // (they store payloadCreator function in meta)
        serializableCheck: {
          ignoredActionPaths: ['meta.payloadCreator'],
        },
      }).concat(gameSyncThunkMiddleware),
  })
}

type TestStore = ReturnType<typeof createTestStore>

function getState(store: TestStore): GameState {
  return store.getState().game
}

/**
 * Get a valid move from the current game state.
 * Returns null if no moves are available.
 * Only returns point-to-point moves (not bar entry or bearing off).
 */
function getFirstValidMove(
  state: GameState
): { from: number; to: number; dieUsed: DieValue } | null {
  const moves = getValidMoves({ state })

  for (const move of moves) {
    // Skip bar moves
    if (move.from === 'bar') continue

    for (const dest of move.destinations) {
      // Skip bearing off moves
      if (dest.to === 'off') continue

      return {
        from: move.from,
        to: dest.to,
        dieUsed: dest.dieValue,
      }
    }
  }

  return null
}

/**
 * Make all available moves until no moves remain.
 * Returns the number of moves made.
 */
function makeAllAvailableMoves(store: TestStore): number {
  let movesMade = 0
  const maxIterations = 10 // Safety limit

  while (movesMade < maxIterations) {
    const state = getState(store)
    if (state.remainingMoves.length === 0) break

    const move = getFirstValidMove(state)
    if (!move) break

    const action = store.dispatch(performMove(move))
    const result = action.meta.result
    if (!result?.ok) break

    movesMade++
  }

  return movesMade
}

// =============================================================================
// performStartGame Tests
// =============================================================================

describe('performStartGame', () => {
  let store: TestStore

  beforeEach(() => {
    store = createTestStore()
  })

  it('should start a new game with initial board', () => {
    const action = store.dispatch(performStartGame())
    const result = action.meta.result!

    expect(result.ok).toBe(true)
    if (!result.ok) return

    // Verify result structure
    expect(['white', 'black']).toContain(result.value.firstPlayer)
    expect(result.value.diceRoll.die1).toBeGreaterThanOrEqual(1)
    expect(result.value.diceRoll.die1).toBeLessThanOrEqual(6)
    expect(result.value.diceRoll.die2).toBeGreaterThanOrEqual(1)
    expect(result.value.diceRoll.die2).toBeLessThanOrEqual(6)
    expect(result.value.diceRoll.die1).not.toBe(result.value.diceRoll.die2)
    expect(result.value.validMoves.length).toBeGreaterThan(0)

    // Verify state was updated correctly
    const state = getState(store)
    expect(state.phase).toBe('moving')
    expect(state.currentPlayer).toBe(result.value.firstPlayer)
    expect(state.diceRoll).toEqual(result.value.diceRoll)
    expect(state.turnNumber).toBe(1)
    expect(state.movesThisTurn).toEqual([])
    expect(state.result).toBeNull()

    // Verify initial board setup (15 checkers per side)
    const board = state.board
    expect(board.bar.white).toBe(0)
    expect(board.bar.black).toBe(0)
    expect(board.borneOff.white).toBe(0)
    expect(board.borneOff.black).toBe(0)

    // Verify remaining moves match dice
    const { die1, die2 } = result.value.diceRoll
    expect(state.remainingMoves).toContain(die1)
    expect(state.remainingMoves).toContain(die2)
    expect(state.remainingMoves.length).toBe(2)
  })

  it('should set up valid moves for the starting position', () => {
    const action = store.dispatch(performStartGame())
    const result = action.meta.result!

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.validMoves.length).toBeGreaterThan(0)
    }
  })
})

// =============================================================================
// performRollDice Tests
// =============================================================================

describe('performRollDice', () => {
  let store: TestStore

  beforeEach(() => {
    store = createTestStore()
  })

  it('should fail if no game is started', () => {
    const action = store.dispatch(performRollDice())
    const result = action.meta.result!

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.type).toBe('no_game')
    }
  })

  it('should fail if not in rolling phase', () => {
    // Start game - puts us in moving phase
    store.dispatch(performStartGame())

    const action = store.dispatch(performRollDice())
    const result = action.meta.result!

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.type).toBe('wrong_phase')
    }
  })

  it('should succeed in rolling phase', () => {
    // Start game (puts us in moving phase)
    store.dispatch(performStartGame())

    const stateAfterStart = getState(store)
    expect(stateAfterStart.phase).toBe('moving')
    const firstPlayer = stateAfterStart.currentPlayer

    // Make all available moves to use up the dice
    const movesMade = makeAllAvailableMoves(store)
    expect(movesMade).toBeGreaterThan(0)

    // Now end the turn
    const endTurnAction = store.dispatch(performEndTurn())
    const endTurnResult = endTurnAction.meta.result!
    expect(endTurnResult.ok).toBe(true)

    // Should now be in rolling phase for the other player
    const stateAfterEndTurn = getState(store)
    expect(stateAfterEndTurn.phase).toBe('rolling')
    expect(stateAfterEndTurn.currentPlayer).not.toBe(firstPlayer)

    // Now test performRollDice succeeds
    const rollAction = store.dispatch(performRollDice())
    const rollResult = rollAction.meta.result!

    expect(rollResult.ok).toBe(true)
    if (!rollResult.ok) return

    // Verify the result contains dice values
    expect(rollResult.value.diceRoll.die1).toBeGreaterThanOrEqual(1)
    expect(rollResult.value.diceRoll.die1).toBeLessThanOrEqual(6)
    expect(rollResult.value.diceRoll.die2).toBeGreaterThanOrEqual(1)
    expect(rollResult.value.diceRoll.die2).toBeLessThanOrEqual(6)

    // Verify state transitioned to moving phase
    const stateAfterRoll = getState(store)
    expect(stateAfterRoll.phase).toBe('moving')
    expect(stateAfterRoll.diceRoll).toEqual(rollResult.value.diceRoll)
    expect(stateAfterRoll.remainingMoves.length).toBeGreaterThan(0)
  })
})

// =============================================================================
// performMove Tests
// =============================================================================

describe('performMove', () => {
  let store: TestStore

  beforeEach(() => {
    store = createTestStore()
  })

  it('should fail if no game is started', () => {
    const action = store.dispatch(
      performMove({ from: 24, to: 23, dieUsed: 1 })
    )
    const result = action.meta.result!

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.type).toBe('no_game')
    }
  })

  it('should fail with invalid input', () => {
    store.dispatch(performStartGame())

    const action = store.dispatch(
      performMove({ from: 0, to: 23, dieUsed: 1 })
    )
    const result = action.meta.result!

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.type).toBe('invalid_input')
    }
  })

  it('should fail with invalid die value', () => {
    store.dispatch(performStartGame())

    const action = store.dispatch(
      performMove({ from: 24, to: 23, dieUsed: 7 })
    )
    const result = action.meta.result!

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.type).toBe('invalid_input')
    }
  })

  it('should succeed with a valid move', () => {
    store.dispatch(performStartGame())

    const stateBefore = getState(store)
    expect(stateBefore.diceRoll).not.toBeNull()
    expect(stateBefore.currentPlayer).not.toBeNull()

    // Get an actual valid move from the rules engine
    const move = getFirstValidMove(stateBefore)
    expect(move).not.toBeNull()
    if (!move) return

    const remainingMovesBefore = [...stateBefore.remainingMoves]
    const boardBefore = stateBefore.board

    // Execute the move
    const action = store.dispatch(performMove(move))
    const result = action.meta.result!

    // Verify the operation succeeded
    expect(result.ok).toBe(true)
    if (!result.ok) return

    // Verify the result contains expected data
    expect(result.value.move).toEqual(move)
    expect(typeof result.value.hit).toBe('boolean')
    expect(Array.isArray(result.value.remainingMoves)).toBe(true)
    expect(Array.isArray(result.value.validMoves)).toBe(true)

    // Verify state was updated correctly
    const stateAfter = getState(store)

    // Remaining moves should have one fewer die value
    expect(stateAfter.remainingMoves.length).toBe(
      remainingMovesBefore.length - 1
    )

    // The move should be recorded in movesThisTurn
    expect(stateAfter.movesThisTurn).toContainEqual(move)

    // Board should have changed - checker moved from source
    const fromIndex = move.from - 1
    const toIndex = move.to - 1
    const player = stateBefore.currentPlayer!
    const direction = player === 'white' ? 1 : -1

    // Source point should have one fewer checker
    expect(Math.abs(stateAfter.board.points[fromIndex])).toBe(
      Math.abs(boardBefore.points[fromIndex]) - 1
    )

    // Destination point should have one more checker (unless bearing off)
    if (move.to >= 1 && move.to <= 24) {
      const destValueAfter = stateAfter.board.points[toIndex]
      // Account for hitting: if opponent had a blot, it's now our checker
      expect(destValueAfter * direction).toBeGreaterThan(0)
    }
  })
})

// =============================================================================
// performEndTurn Tests
// =============================================================================

describe('performEndTurn', () => {
  let store: TestStore

  beforeEach(() => {
    store = createTestStore()
  })

  it('should fail if no game is started', () => {
    const action = store.dispatch(performEndTurn())
    const result = action.meta.result!

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.type).toBe('no_game')
    }
  })

  it('should fail if moves are still available', () => {
    store.dispatch(performStartGame())

    const action = store.dispatch(performEndTurn())
    const result = action.meta.result!

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.type).toBe('moves_remaining')
    }
  })
})

// =============================================================================
// Full Game Flow Tests
// =============================================================================

describe('Full Game Flow', () => {
  let store: TestStore

  beforeEach(() => {
    store = createTestStore()
  })

  it('should handle start -> move -> end turn -> roll cycle', () => {
    // Start game
    const startAction = store.dispatch(performStartGame())
    const startResult = startAction.meta.result!
    expect(startResult.ok).toBe(true)

    let state = getState(store)
    expect(state.phase).toBe('moving')
    expect(state.currentPlayer).not.toBeNull()

    const firstPlayer = state.currentPlayer
    const initialTurnNumber = state.turnNumber

    // Make all available moves
    const movesMade = makeAllAvailableMoves(store)
    expect(movesMade).toBeGreaterThan(0)

    state = getState(store)
    expect(state.remainingMoves.length).toBe(0)
    expect(state.movesThisTurn.length).toBe(movesMade)

    // End turn
    const endTurnAction = store.dispatch(performEndTurn())
    const endTurnResult = endTurnAction.meta.result!
    expect(endTurnResult.ok).toBe(true)

    state = getState(store)
    expect(state.phase).toBe('rolling')
    expect(state.currentPlayer).not.toBe(firstPlayer)
    expect(state.turnNumber).toBe(initialTurnNumber + 1)
    expect(state.movesThisTurn.length).toBe(0) // Reset for new turn

    // Roll dice for second player
    const rollAction = store.dispatch(performRollDice())
    const rollResult = rollAction.meta.result!
    expect(rollResult.ok).toBe(true)

    state = getState(store)
    expect(state.phase).toBe('moving')
    expect(state.diceRoll).not.toBeNull()
    expect(state.remainingMoves.length).toBeGreaterThan(0)

    // Make moves for second player
    const secondPlayerMoves = makeAllAvailableMoves(store)
    expect(secondPlayerMoves).toBeGreaterThan(0)

    // End second player's turn
    const endTurn2Action = store.dispatch(performEndTurn())
    const endTurn2Result = endTurn2Action.meta.result!
    expect(endTurn2Result.ok).toBe(true)

    state = getState(store)
    expect(state.phase).toBe('rolling')
    expect(state.currentPlayer).toBe(firstPlayer) // Back to first player
    expect(state.turnNumber).toBe(initialTurnNumber + 2)
  })

  it('should reset game state', () => {
    store.dispatch(performStartGame())

    let state = getState(store)
    expect(state.phase).toBe('moving')

    store.dispatch(resetGame())

    state = getState(store)
    expect(state.phase).toBe('not_started')
    expect(state.currentPlayer).toBeNull()
    expect(state.diceRoll).toBeNull()
    expect(state.turnNumber).toBe(0)
  })
})

// =============================================================================
// Error Type Tests
// =============================================================================

describe('Error Types', () => {
  let store: TestStore

  beforeEach(() => {
    store = createTestStore()
  })

  it('should return structured error for no_game', () => {
    const action = store.dispatch(performRollDice())
    const result = action.meta.result!

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toHaveProperty('type')
      expect(result.error).toHaveProperty('message')
      expect(result.error.type).toBe('no_game')
      expect(typeof result.error.message).toBe('string')
    }
  })

  it('should return structured error for wrong_phase', () => {
    store.dispatch(performStartGame())
    const action = store.dispatch(performRollDice())
    const result = action.meta.result!

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.type).toBe('wrong_phase')
      expect(result.error).toHaveProperty('phase')
    }
  })

  it('should return structured error for invalid_input', () => {
    store.dispatch(performStartGame())
    const action = store.dispatch(
      performMove({ from: 100, to: 23, dieUsed: 1 })
    )
    const result = action.meta.result!

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.type).toBe('invalid_input')
      expect(result.error).toHaveProperty('field')
    }
  })
})

// =============================================================================
// Sync Thunk Middleware Tests
// =============================================================================

describe('Sync Thunk Middleware', () => {
  it('should execute payloadCreator and store result in meta', () => {
    const store = createTestStore()

    const action = store.dispatch(performStartGame())

    // The middleware should have executed and stored the result
    expect(action.meta).toHaveProperty('result')
    expect(action.meta.result).toBeDefined()

    // Verify the result is a proper Result type (has ok property)
    const result = action.meta.result!
    expect(typeof result.ok).toBe('boolean')

    // For performStartGame, result should be successful
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toHaveProperty('firstPlayer')
      expect(result.value).toHaveProperty('diceRoll')
      expect(result.value).toHaveProperty('validMoves')
    }
  })

  it('should pass action through to reducer after middleware', () => {
    const store = createTestStore()

    // State should be 'not_started' before
    const stateBefore = getState(store)
    expect(stateBefore.phase).toBe('not_started')
    expect(stateBefore.currentPlayer).toBeNull()
    expect(stateBefore.diceRoll).toBeNull()

    store.dispatch(performStartGame())

    // State should be updated by the reducer after middleware executes
    const stateAfter = getState(store)
    expect(stateAfter.phase).toBe('moving')
    expect(stateAfter.currentPlayer).not.toBeNull()
    expect(stateAfter.diceRoll).not.toBeNull()
    expect(stateAfter.turnNumber).toBe(1)
  })

  it('should store error result when operation fails', () => {
    const store = createTestStore()

    // Try to roll dice without starting a game (should fail)
    const action = store.dispatch(performRollDice())
    const result = action.meta.result!

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toHaveProperty('type')
      expect(result.error).toHaveProperty('message')
      expect(result.error.type).toBe('no_game')
    }
  })
})
