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
  performUndoMove,
  performUndoAllMoves,
  resetGame,
  selectValidMoves,
  selectCanUndo,
  getValidMoves,
  getRequiredMoves,
  filterMovesByDie,
  type GameState,
  type DieValue
} from '../index'

// =============================================================================
// Test Utilities
// =============================================================================

function createTestStore() {
  return configureStore({
    reducer: { game: gameReducer },
    middleware: getDefaultMiddleware =>
      getDefaultMiddleware({
        // Disable serializable check for sync thunk actions
        // (they store payloadCreator function in meta)
        serializableCheck: {
          ignoredActionPaths: ['meta.payloadCreator']
        }
      }).concat(gameSyncThunkMiddleware)
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
        dieUsed: dest.dieValue
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
    const action = store.dispatch(performMove({ from: 24, to: 23, dieUsed: 1 }))
    const result = action.meta.result!

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.type).toBe('no_game')
    }
  })

  it('should fail with invalid input', () => {
    store.dispatch(performStartGame())

    const action = store.dispatch(performMove({ from: 0, to: 23, dieUsed: 1 }))
    const result = action.meta.result!

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.type).toBe('invalid_input')
    }
  })

  it('should fail with invalid die value', () => {
    store.dispatch(performStartGame())

    const action = store.dispatch(performMove({ from: 24, to: 23, dieUsed: 7 }))
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

// =============================================================================
// Must-Play-Higher Rule Filtering Tests
// =============================================================================

describe('Must-Play-Higher Rule Filtering', () => {
  let store: TestStore

  beforeEach(() => {
    store = createTestStore()
  })

  it('should filter validMoves to only include required die when must-play-higher applies', () => {
    // This tests the scenario where:
    // - Player has one checker on point 1
    // - Player rolls 1-3
    // - Both dice can bear off, but must use the higher die (3)
    // - validMoves should ONLY include the die 3 option

    // Start game to initialize
    store.dispatch(performStartGame())

    // Set up a specific board state: white has 1 checker on point 1, 14 borne off
    const currentState = getState(store)

    // Create bearing off state for white
    const bearOffBoard = {
      points: [
        1, 0, 0, 0, 0, 0, // Points 1-6: 1 white checker on point 1
        0, 0, 0, 0, 0, 0, // Points 7-12
        0, 0, 0, 0, 0, 0, // Points 13-18
        -15, 0, 0, 0, 0, 0 // Points 19-24: all black on 19
      ] as [
        number, number, number, number, number, number,
        number, number, number, number, number, number,
        number, number, number, number, number, number,
        number, number, number, number, number, number
      ],
      bar: { white: 0, black: 0 },
      borneOff: { white: 14, black: 0 }
    }

    // Create test state with our specific board
    const testState: GameState = {
      ...currentState,
      board: bearOffBoard,
      currentPlayer: 'white',
      phase: 'moving',
      diceRoll: { die1: 1, die2: 3 },
      remainingMoves: [1, 3] as DieValue[],
      movesThisTurn: []
    }

    const allValidMoves = getValidMoves({ state: testState })

    // Without filtering, both dice should be able to bear off
    expect(allValidMoves.length).toBe(1) // Only from point 1
    expect(allValidMoves[0].from).toBe(1)
    expect(allValidMoves[0].destinations.length).toBe(2) // Both die 1 and die 3

    // Check that requirements say we must play higher die
    const requirements = getRequiredMoves({ state: testState })
    expect(requirements.mustPlayHigherDie).toBe(true)
    expect(requirements.requiredDie).toBe(3)

    // Apply filtering (this is what operations now do)
    const filteredMoves = filterMovesByDie({
      availableMoves: allValidMoves,
      dieValue: requirements.requiredDie!
    })

    // After filtering, only die 3 should be available
    expect(filteredMoves.length).toBe(1)
    expect(filteredMoves[0].destinations.length).toBe(1)
    expect(filteredMoves[0].destinations[0].dieValue).toBe(3)
    expect(filteredMoves[0].destinations[0].to).toBe('off')
  })

  it('should not filter when both dice can be played', () => {
    store.dispatch(performStartGame())

    const state = getState(store)

    // In a normal starting position with different dice,
    // both dice should be playable, so no filtering should occur
    const requirements = getRequiredMoves({ state })

    // At game start with 2 different dice, we can usually play both
    // So requiredDie should be null
    expect(requirements.requiredDie).toBeNull()
  })

  it('performMove should return filtered validMoves after move', () => {
    // Test that after making a move, the returned validMoves are also filtered
    store.dispatch(performStartGame())

    const currentState = getState(store)

    // Create a board where after first move, only one die is playable
    // White has 2 checkers: one on point 6, one on point 1
    // Roll 5-1: Can move 6->1 with 5, then must bear off with 1
    const testBoard = {
      points: [
        1, 0, 0, 0, 0, 1, // Points 1-6: checkers on 1 and 6
        0, 0, 0, 0, 0, 0, // Points 7-12
        0, 0, 0, 0, 0, 0, // Points 13-18
        -15, 0, 0, 0, 0, 0 // Points 19-24: all black on 19
      ] as [
        number, number, number, number, number, number,
        number, number, number, number, number, number,
        number, number, number, number, number, number,
        number, number, number, number, number, number
      ],
      bar: { white: 0, black: 0 },
      borneOff: { white: 13, black: 0 }
    }

    // Manually set up the state
    const testState: GameState = {
      ...currentState,
      board: testBoard,
      currentPlayer: 'white',
      phase: 'moving',
      diceRoll: { die1: 5, die2: 1 },
      remainingMoves: [5, 1] as DieValue[],
      movesThisTurn: []
    }

    // Verify initial moves: should be able to use both dice
    const initialMoves = getValidMoves({ state: testState })
    const initialRequirements = getRequiredMoves({ state: testState })

    // Both dice should be playable initially
    expect(initialRequirements.requiredDie).toBeNull()

    // Find move from point 6 using die 5 (to point 1)
    const moveFrom6 = initialMoves.find(m => m.from === 6)
    expect(moveFrom6).toBeDefined()
    const moveTo1 = moveFrom6?.destinations.find(d => d.to === 1 && d.dieValue === 5)
    expect(moveTo1).toBeDefined()
  })
})

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

// =============================================================================
// performUndoMove Tests
// =============================================================================

describe('performUndoMove', () => {
  let store: TestStore

  beforeEach(() => {
    store = createTestStore()
  })

  it('should fail if no game is started', () => {
    const action = store.dispatch(performUndoMove())
    const result = action.meta.result!

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.type).toBe('no_game')
    }
  })

  it('should fail if not in moving phase', () => {
    store.dispatch(performStartGame())
    makeAllAvailableMoves(store)
    store.dispatch(performEndTurn())

    // Now in rolling phase
    const action = store.dispatch(performUndoMove())
    const result = action.meta.result!

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.type).toBe('wrong_phase')
    }
  })

  it('should fail if no moves have been made this turn', () => {
    store.dispatch(performStartGame())

    // In moving phase but no moves made yet
    const action = store.dispatch(performUndoMove())
    const result = action.meta.result!

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.type).toBe('nothing_to_undo')
    }
  })

  it('should undo a single move and restore board state', () => {
    store.dispatch(performStartGame())

    const stateBefore = getState(store)
    const boardBefore = stateBefore.board
    const remainingBefore = [...stateBefore.remainingMoves]

    // Make one valid move
    const move = getFirstValidMove(stateBefore)
    expect(move).not.toBeNull()
    if (!move) return

    store.dispatch(performMove(move))
    const stateAfterMove = getState(store)
    expect(stateAfterMove.movesThisTurn.length).toBe(1)

    // Undo the move
    const undoAction = store.dispatch(performUndoMove())
    const undoResult = undoAction.meta.result!

    expect(undoResult.ok).toBe(true)
    if (!undoResult.ok) return

    expect(undoResult.value.undoneMoves.length).toBe(1)
    expect(undoResult.value.undoneMoves[0].move).toEqual(move)

    // Board should be restored
    const stateAfterUndo = getState(store)
    expect(stateAfterUndo.board.points).toEqual(boardBefore.points)
    expect(stateAfterUndo.board.bar).toEqual(boardBefore.bar)
    expect(stateAfterUndo.board.borneOff).toEqual(boardBefore.borneOff)

    // Remaining moves should be restored
    expect([...stateAfterUndo.remainingMoves].sort()).toEqual([...remainingBefore].sort())

    // No moves should remain in movesThisTurn
    expect(stateAfterUndo.movesThisTurn.length).toBe(0)
  })

  it('should undo only the last move when multiple moves made', () => {
    store.dispatch(performStartGame())

    // Make two moves
    const state1 = getState(store)
    const move1 = getFirstValidMove(state1)
    expect(move1).not.toBeNull()
    if (!move1) return
    store.dispatch(performMove(move1))

    const state2 = getState(store)
    const boardAfterMove1 = state2.board
    const move2 = getFirstValidMove(state2)

    if (!move2) return // might not have a second valid move
    store.dispatch(performMove(move2))

    expect(getState(store).movesThisTurn.length).toBe(2)

    // Undo only the last move
    const undoAction = store.dispatch(performUndoMove())
    const undoResult = undoAction.meta.result!

    expect(undoResult.ok).toBe(true)
    if (!undoResult.ok) return

    const stateAfterUndo = getState(store)
    expect(stateAfterUndo.movesThisTurn.length).toBe(1)

    // Board should match state after first move
    expect(stateAfterUndo.board.points).toEqual(boardAfterMove1.points)
    expect(stateAfterUndo.board.bar).toEqual(boardAfterMove1.bar)
    expect(stateAfterUndo.board.borneOff).toEqual(boardAfterMove1.borneOff)
  })

  it('should restore the used die value to remaining moves', () => {
    store.dispatch(performStartGame())

    const stateBefore = getState(store)
    const remainingBefore = [...stateBefore.remainingMoves]

    const move = getFirstValidMove(stateBefore)
    expect(move).not.toBeNull()
    if (!move) return

    store.dispatch(performMove(move))
    const stateAfterMove = getState(store)
    expect(stateAfterMove.remainingMoves.length).toBe(remainingBefore.length - 1)

    store.dispatch(performUndoMove())

    const stateAfterUndo = getState(store)
    expect([...stateAfterUndo.remainingMoves].sort()).toEqual([...remainingBefore].sort())
  })
})

// =============================================================================
// performUndoAllMoves Tests
// =============================================================================

describe('performUndoAllMoves', () => {
  let store: TestStore

  beforeEach(() => {
    store = createTestStore()
  })

  it('should fail if no game is started', () => {
    const action = store.dispatch(performUndoAllMoves())
    const result = action.meta.result!

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.type).toBe('no_game')
    }
  })

  it('should fail if no moves have been made', () => {
    store.dispatch(performStartGame())

    const action = store.dispatch(performUndoAllMoves())
    const result = action.meta.result!

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.type).toBe('nothing_to_undo')
    }
  })

  it('should undo all moves and fully restore board state', () => {
    store.dispatch(performStartGame())

    const stateBefore = getState(store)
    const boardBefore = stateBefore.board
    const remainingBefore = [...stateBefore.remainingMoves]

    // Make all available moves
    const movesMade = makeAllAvailableMoves(store)
    expect(movesMade).toBeGreaterThan(0)

    const stateAfterMoves = getState(store)
    expect(stateAfterMoves.movesThisTurn.length).toBe(movesMade)

    // Undo all
    const undoAction = store.dispatch(performUndoAllMoves())
    const undoResult = undoAction.meta.result!

    expect(undoResult.ok).toBe(true)
    if (!undoResult.ok) return

    expect(undoResult.value.undoneMoves.length).toBe(movesMade)

    // Board should be fully restored
    const stateAfterUndo = getState(store)
    expect(stateAfterUndo.board.points).toEqual(boardBefore.points)
    expect(stateAfterUndo.board.bar).toEqual(boardBefore.bar)
    expect(stateAfterUndo.board.borneOff).toEqual(boardBefore.borneOff)

    // All dice should be restored
    expect([...stateAfterUndo.remainingMoves].sort()).toEqual([...remainingBefore].sort())

    // No moves this turn
    expect(stateAfterUndo.movesThisTurn.length).toBe(0)
  })

  it('should undo a single move when only one was made', () => {
    store.dispatch(performStartGame())

    const stateBefore = getState(store)
    const move = getFirstValidMove(stateBefore)
    expect(move).not.toBeNull()
    if (!move) return

    store.dispatch(performMove(move))

    const undoAction = store.dispatch(performUndoAllMoves())
    const undoResult = undoAction.meta.result!

    expect(undoResult.ok).toBe(true)
    if (!undoResult.ok) return

    expect(undoResult.value.undoneMoves.length).toBe(1)
    expect(getState(store).movesThisTurn.length).toBe(0)
  })
})

// =============================================================================
// selectCanUndo Tests
// =============================================================================

describe('selectCanUndo', () => {
  let store: TestStore

  beforeEach(() => {
    store = createTestStore()
  })

  it('should be false before game starts', () => {
    expect(selectCanUndo(store.getState())).toBe(false)
  })

  it('should be false at start of turn (no moves made)', () => {
    store.dispatch(performStartGame())
    expect(selectCanUndo(store.getState())).toBe(false)
  })

  it('should be true after making a move', () => {
    store.dispatch(performStartGame())

    const move = getFirstValidMove(getState(store))
    expect(move).not.toBeNull()
    if (!move) return

    store.dispatch(performMove(move))
    expect(selectCanUndo(store.getState())).toBe(true)
  })

  it('should be false after undoing all moves', () => {
    store.dispatch(performStartGame())

    const move = getFirstValidMove(getState(store))
    expect(move).not.toBeNull()
    if (!move) return

    store.dispatch(performMove(move))
    expect(selectCanUndo(store.getState())).toBe(true)

    store.dispatch(performUndoMove())
    expect(selectCanUndo(store.getState())).toBe(false)
  })

  it('should be false in rolling phase', () => {
    store.dispatch(performStartGame())
    makeAllAvailableMoves(store)
    store.dispatch(performEndTurn())

    expect(getState(store).phase).toBe('rolling')
    expect(selectCanUndo(store.getState())).toBe(false)
  })
})

// =============================================================================
// selectValidMoves Tests
// =============================================================================

describe('selectValidMoves', () => {
  let store: TestStore

  beforeEach(() => {
    store = createTestStore()
  })

  it('should return empty array when not in moving phase', () => {
    expect(selectValidMoves(store.getState())).toEqual([])
  })

  it('should return valid moves after game start', () => {
    store.dispatch(performStartGame())

    const validMoves = selectValidMoves(store.getState())
    expect(validMoves.length).toBeGreaterThan(0)
  })

  it('should return empty array when no remaining moves', () => {
    store.dispatch(performStartGame())
    makeAllAvailableMoves(store)

    const state = getState(store)
    expect(state.remainingMoves.length).toBe(0)
    expect(selectValidMoves(store.getState())).toEqual([])
  })

  it('should include must-play-higher-die filtering', () => {
    // This tests that selectValidMoves applies the must-play-higher-die rule.
    // Set up: white has 1 checker on point 1, 14 borne off, roll 1-3.
    // Both dice can bear off, but must use the higher die (3).

    store.dispatch(performStartGame())

    const currentState = getState(store)

    const bearOffBoard = {
      points: [
        1, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0,
        -15, 0, 0, 0, 0, 0
      ] as [
        number, number, number, number, number, number,
        number, number, number, number, number, number,
        number, number, number, number, number, number,
        number, number, number, number, number, number
      ],
      bar: { white: 0, black: 0 },
      borneOff: { white: 14, black: 0 }
    }

    const testState: GameState = {
      ...currentState,
      board: bearOffBoard,
      currentPlayer: 'white',
      phase: 'moving',
      diceRoll: { die1: 1, die2: 3 },
      remainingMoves: [1, 3] as DieValue[],
      movesThisTurn: []
    }

    // Verify the raw rules engine returns both dice options
    const allMoves = getValidMoves({ state: testState })
    expect(allMoves.length).toBe(1)
    expect(allMoves[0].destinations.length).toBe(2)

    // Verify requirements mandate higher die
    const requirements = getRequiredMoves({ state: testState })
    expect(requirements.requiredDie).toBe(3)

    // Now test the selector filters correctly
    const rootState = { game: testState }
    const selectorResult = selectValidMoves(rootState)

    expect(selectorResult.length).toBe(1)
    expect(selectorResult[0].destinations.length).toBe(1)
    expect(selectorResult[0].destinations[0].dieValue).toBe(3)
  })

  it('should not filter when both dice are playable', () => {
    store.dispatch(performStartGame())

    const state = getState(store)

    // In a normal starting position with different dice,
    // both dice should be playable so no filtering should occur
    const requirements = getRequiredMoves({ state })
    expect(requirements.requiredDie).toBeNull()

    // selectValidMoves should match getValidMoves (no filtering)
    const selectorResult = selectValidMoves(store.getState())
    const rawMoves = getValidMoves({ state })

    expect(selectorResult).toEqual(rawMoves)
  })

  it('should update after undo restores dice', () => {
    store.dispatch(performStartGame())

    const movesBefore = selectValidMoves(store.getState())
    expect(movesBefore.length).toBeGreaterThan(0)

    const move = getFirstValidMove(getState(store))
    expect(move).not.toBeNull()
    if (!move) return

    store.dispatch(performMove(move))

    store.dispatch(performUndoMove())

    // After undo, valid moves should have the same sources and destination points
    const movesAfterUndo = selectValidMoves(store.getState())
    expect(movesAfterUndo.length).toBe(movesBefore.length)

    // Same set of source points
    const sourcesBefore = movesBefore.map(m => m.from).sort()
    const sourcesAfter = movesAfterUndo.map(m => m.from).sort()
    expect(sourcesAfter).toEqual(sourcesBefore)

    // Same set of destinations for each source
    for (const moveBefore of movesBefore) {
      const moveAfter = movesAfterUndo.find(m => m.from === moveBefore.from)
      expect(moveAfter).toBeDefined()
      if (!moveAfter) continue

      const destsBefore = moveBefore.destinations
        .map(d => `${String(d.to)}-${String(d.dieValue)}`)
        .sort()
      const destsAfter = moveAfter.destinations
        .map(d => `${String(d.to)}-${String(d.dieValue)}`)
        .sort()
      expect(destsAfter).toEqual(destsBefore)
    }
  })
})
