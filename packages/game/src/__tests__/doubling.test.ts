/**
 * Tests for doubling cube operations
 *
 * Tests performProposeDouble and performRespondToDouble operations
 * with a real Redux store.
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
  performProposeDouble,
  performRespondToDouble,
  selectCanDouble,
  selectDoublingCube,
  selectDoubleProposedBy,
  getValidMoves,
  type GameState,
  type DieValue,
  type Player
} from '../index'

// =============================================================================
// Test Utilities
// =============================================================================

function createTestStore() {
  return configureStore({
    reducer: { game: gameReducer },
    middleware: getDefaultMiddleware =>
      getDefaultMiddleware({
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

function getFirstValidMove(
  state: GameState
): { from: number; to: number; dieUsed: DieValue } | null {
  const moves = getValidMoves({ state })
  for (const move of moves) {
    if (move.from === 'bar') continue
    for (const dest of move.destinations) {
      if (dest.to === 'off') continue
      return { from: move.from, to: dest.to, dieUsed: dest.dieValue }
    }
  }
  return null
}

function makeAllAvailableMoves(store: TestStore): number {
  let movesMade = 0
  const maxIterations = 10

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

/**
 * Start a game with the doubling cube enabled and advance to the second
 * player's rolling phase (where they can propose a double).
 */
function startGameAndAdvanceToRolling(store: TestStore): void {
  store.dispatch(performStartGame({ enableDoublingCube: true, isCrawfordGame: false }))
  makeAllAvailableMoves(store)
  store.dispatch(performEndTurn())
}

// =============================================================================
// performStartGame with doubling cube
// =============================================================================

describe('performStartGame with doubling cube', () => {
  let store: TestStore

  beforeEach(() => {
    store = createTestStore()
  })

  it('should initialize doublingCube when enabled', () => {
    store.dispatch(performStartGame({ enableDoublingCube: true, isCrawfordGame: false }))
    const state = getState(store)

    expect(state.doublingCube).toEqual({ value: 1, owner: 'centered' })
    expect(state.doubleProposedBy).toBeNull()
  })

  it('should not initialize doublingCube when disabled', () => {
    store.dispatch(performStartGame({ enableDoublingCube: false, isCrawfordGame: false }))
    const state = getState(store)

    expect(state.doublingCube).toBeNull()
  })

  it('should not initialize doublingCube when called without options', () => {
    store.dispatch(performStartGame())
    const state = getState(store)

    expect(state.doublingCube).toBeNull()
  })

  it('should disable cube when Crawford game even if cube is enabled', () => {
    store.dispatch(performStartGame({ enableDoublingCube: true, isCrawfordGame: true }))
    const state = getState(store)

    expect(state.doublingCube).toBeNull()
  })
})

// =============================================================================
// selectCanDouble
// =============================================================================

describe('selectCanDouble', () => {
  let store: TestStore

  beforeEach(() => {
    store = createTestStore()
  })

  it('should be false when cube is disabled', () => {
    store.dispatch(performStartGame())
    makeAllAvailableMoves(store)
    store.dispatch(performEndTurn())

    expect(getState(store).phase).toBe('rolling')
    expect(selectCanDouble(store.getState())).toBe(false)
  })

  it('should be true in rolling phase with cube enabled and centered', () => {
    startGameAndAdvanceToRolling(store)

    expect(getState(store).phase).toBe('rolling')
    expect(selectCanDouble(store.getState())).toBe(true)
  })

  it('should be false in moving phase', () => {
    store.dispatch(performStartGame({ enableDoublingCube: true, isCrawfordGame: false }))

    // In moving phase after start
    expect(getState(store).phase).toBe('moving')
    expect(selectCanDouble(store.getState())).toBe(false)
  })

  it('should be false when cube value is at max (64)', () => {
    startGameAndAdvanceToRolling(store)

    // Manually set cube to 64
    const state = getState(store)
    const rootState = {
      game: {
        ...state,
        doublingCube: { value: 64 as const, owner: 'centered' as const }
      }
    }
    expect(selectCanDouble(rootState)).toBe(false)
  })

  it('should be false when opponent owns the cube', () => {
    startGameAndAdvanceToRolling(store)

    const currentPlayer = getState(store).currentPlayer!
    const opponent: Player = currentPlayer === 'white' ? 'black' : 'white'

    // Manually set cube owner to opponent
    const state = getState(store)
    const rootState = {
      game: {
        ...state,
        doublingCube: { value: 2 as const, owner: opponent }
      }
    }
    expect(selectCanDouble(rootState)).toBe(false)
  })

  it('should be true when current player owns the cube', () => {
    startGameAndAdvanceToRolling(store)

    const currentPlayer = getState(store).currentPlayer!

    const state = getState(store)
    const rootState = {
      game: {
        ...state,
        doublingCube: { value: 2 as const, owner: currentPlayer }
      }
    }
    expect(selectCanDouble(rootState)).toBe(true)
  })
})

// =============================================================================
// performProposeDouble
// =============================================================================

describe('performProposeDouble', () => {
  let store: TestStore

  beforeEach(() => {
    store = createTestStore()
  })

  it('should fail if no game is started', () => {
    const action = store.dispatch(performProposeDouble())
    const result = action.meta.result!

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.type).toBe('no_game')
    }
  })

  it('should fail if not in rolling phase', () => {
    store.dispatch(performStartGame({ enableDoublingCube: true, isCrawfordGame: false }))

    // In moving phase
    const action = store.dispatch(performProposeDouble())
    const result = action.meta.result!

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.type).toBe('wrong_phase')
    }
  })

  it('should fail if cube is disabled', () => {
    store.dispatch(performStartGame())
    makeAllAvailableMoves(store)
    store.dispatch(performEndTurn())

    const action = store.dispatch(performProposeDouble())
    const result = action.meta.result!

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.type).toBe('cannot_double')
    }
  })

  it('should succeed and transition to doubling_proposed phase', () => {
    startGameAndAdvanceToRolling(store)

    const playerBefore = getState(store).currentPlayer

    const action = store.dispatch(performProposeDouble())
    const result = action.meta.result!

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.value.proposedBy).toBe(playerBefore)
    expect(result.value.newCubeValue).toBe(2)

    const state = getState(store)
    expect(state.phase).toBe('doubling_proposed')
    expect(state.doubleProposedBy).toBe(playerBefore)
  })

  it('should record double_proposed action in history', () => {
    startGameAndAdvanceToRolling(store)

    store.dispatch(performProposeDouble())

    const state = getState(store)
    const lastAction = state.actionHistory[state.actionHistory.length - 1]
    expect(lastAction.type).toBe('double_proposed')
    if (lastAction.type === 'double_proposed') {
      expect(lastAction.newValue).toBe(2)
    }
  })
})

// =============================================================================
// performRespondToDouble - Accept
// =============================================================================

describe('performRespondToDouble - Accept', () => {
  let store: TestStore

  beforeEach(() => {
    store = createTestStore()
    startGameAndAdvanceToRolling(store)
    store.dispatch(performProposeDouble())
  })

  it('should accept the double and update cube', () => {
    const proposer = getState(store).doubleProposedBy!
    const responder = proposer === 'white' ? 'black' : 'white'

    const action = store.dispatch(performRespondToDouble({ response: 'accept' }))
    const result = action.meta.result!

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.value.response).toBe('accept')
    if (result.value.response === 'accept') {
      expect(result.value.newCubeValue).toBe(2)
      expect(result.value.newOwner).toBe(responder)
    }

    const state = getState(store)
    expect(state.phase).toBe('rolling')
    expect(state.doublingCube).toEqual({ value: 2, owner: responder })
    expect(state.doubleProposedBy).toBeNull()
  })

  it('should record double_accepted action in history', () => {
    store.dispatch(performRespondToDouble({ response: 'accept' }))

    const state = getState(store)
    const lastAction = state.actionHistory[state.actionHistory.length - 1]
    expect(lastAction.type).toBe('double_accepted')
    if (lastAction.type === 'double_accepted') {
      expect(lastAction.cubeValue).toBe(2)
    }
  })

  it('should allow the game to continue after accepting', () => {
    store.dispatch(performRespondToDouble({ response: 'accept' }))

    // Should be in rolling phase, can now roll dice
    const rollAction = store.dispatch(performRollDice())
    const rollResult = rollAction.meta.result!
    expect(rollResult.ok).toBe(true)

    const state = getState(store)
    expect(state.phase).toBe('moving')
  })
})

// =============================================================================
// performRespondToDouble - Decline
// =============================================================================

describe('performRespondToDouble - Decline', () => {
  let store: TestStore

  beforeEach(() => {
    store = createTestStore()
    startGameAndAdvanceToRolling(store)
    store.dispatch(performProposeDouble())
  })

  it('should decline the double and end the game', () => {
    const proposer = getState(store).doubleProposedBy!

    const action = store.dispatch(performRespondToDouble({ response: 'decline' }))
    const result = action.meta.result!

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.value.response).toBe('decline')
    if (result.value.response === 'decline') {
      expect(result.value.winner).toBe(proposer)
      expect(result.value.gameResult.winner).toBe(proposer)
      expect(result.value.gameResult.victoryType).toBe('single')
      expect(result.value.gameResult.cubeValue).toBe(1) // current value before double
      expect(result.value.gameResult.points).toBe(1)
    }

    const state = getState(store)
    expect(state.phase).toBe('game_over')
    expect(state.result).not.toBeNull()
    expect(state.result!.winner).toBe(proposer)
  })

  it('should record double_declined action in history', () => {
    store.dispatch(performRespondToDouble({ response: 'decline' }))

    const state = getState(store)
    const lastAction = state.actionHistory[state.actionHistory.length - 1]
    expect(lastAction.type).toBe('double_declined')
  })
})

// =============================================================================
// performRespondToDouble - Error Cases
// =============================================================================

describe('performRespondToDouble - Error Cases', () => {
  let store: TestStore

  beforeEach(() => {
    store = createTestStore()
  })

  it('should fail if no game is in progress', () => {
    const action = store.dispatch(performRespondToDouble({ response: 'accept' }))
    const result = action.meta.result!

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.type).toBe('no_game')
    }
  })

  it('should fail if not in doubling_proposed phase', () => {
    startGameAndAdvanceToRolling(store)

    // In rolling phase, no double proposed
    const action = store.dispatch(performRespondToDouble({ response: 'accept' }))
    const result = action.meta.result!

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.type).toBe('wrong_phase')
    }
  })
})

// =============================================================================
// Multi-Double Scenarios
// =============================================================================

describe('Multi-Double Scenarios', () => {
  let store: TestStore

  beforeEach(() => {
    store = createTestStore()
  })

  it('should allow re-doubling after ownership transfer', () => {
    // Start game with cube
    store.dispatch(performStartGame({ enableDoublingCube: true, isCrawfordGame: false }))

    // Get to rolling phase for player 2
    makeAllAvailableMoves(store)
    store.dispatch(performEndTurn())
    const player2 = getState(store).currentPlayer!

    // Player 2 doubles to 2, player 1 accepts (player 1 now owns cube)
    store.dispatch(performProposeDouble())
    store.dispatch(performRespondToDouble({ response: 'accept' }))
    expect(getState(store).doublingCube).toEqual({ value: 2, owner: player2 === 'white' ? 'black' : 'white' })

    // Player 2 rolls and plays their turn (cube owned by player 1, so player 2 can't double)
    store.dispatch(performRollDice())
    makeAllAvailableMoves(store)
    store.dispatch(performEndTurn())

    // Now it's player 1's turn. Player 1 owns the cube, so they CAN double.
    const player1 = getState(store).currentPlayer!
    expect(getState(store).doublingCube!.owner).toBe(player1)
    expect(selectCanDouble(store.getState())).toBe(true)

    // Player 1 re-doubles to 4
    const action = store.dispatch(performProposeDouble())
    const result = action.meta.result!
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.newCubeValue).toBe(4)
    }

    // Player 2 accepts, now owns the cube at value 4
    store.dispatch(performRespondToDouble({ response: 'accept' }))
    const state = getState(store)
    expect(state.doublingCube).toEqual({ value: 4, owner: player1 === 'white' ? 'black' : 'white' })
  })

  it('should decline at higher cube value with correct points', () => {
    // Start game with cube, get cube to value 2
    store.dispatch(performStartGame({ enableDoublingCube: true, isCrawfordGame: false }))
    makeAllAvailableMoves(store)
    store.dispatch(performEndTurn())

    store.dispatch(performProposeDouble())
    store.dispatch(performRespondToDouble({ response: 'accept' }))

    // Play through a turn
    store.dispatch(performRollDice())
    makeAllAvailableMoves(store)
    store.dispatch(performEndTurn())

    // Now owner can re-double to 4
    store.dispatch(performProposeDouble())

    // Opponent declines — winner gets points at current cube value (2)
    const action = store.dispatch(performRespondToDouble({ response: 'decline' }))
    const result = action.meta.result!
    expect(result.ok).toBe(true)
    if (result.ok && result.value.response === 'decline') {
      expect(result.value.gameResult.cubeValue).toBe(2)
      expect(result.value.gameResult.points).toBe(2) // single * 2
    }
  })
})

// =============================================================================
// selectDoublingCube and selectDoubleProposedBy
// =============================================================================

describe('Doubling Cube Selectors', () => {
  let store: TestStore

  beforeEach(() => {
    store = createTestStore()
  })

  it('selectDoublingCube should return null when cube disabled', () => {
    store.dispatch(performStartGame())
    expect(selectDoublingCube(store.getState())).toBeNull()
  })

  it('selectDoublingCube should return cube state when enabled', () => {
    store.dispatch(performStartGame({ enableDoublingCube: true, isCrawfordGame: false }))
    expect(selectDoublingCube(store.getState())).toEqual({ value: 1, owner: 'centered' })
  })

  it('selectDoubleProposedBy should be null initially', () => {
    store.dispatch(performStartGame({ enableDoublingCube: true, isCrawfordGame: false }))
    expect(selectDoubleProposedBy(store.getState())).toBeNull()
  })

  it('selectDoubleProposedBy should return player after proposal', () => {
    startGameAndAdvanceToRolling(store)
    const player = getState(store).currentPlayer!

    store.dispatch(performProposeDouble())
    expect(selectDoubleProposedBy(store.getState())).toBe(player)
  })
})
