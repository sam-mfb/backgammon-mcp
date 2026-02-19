/**
 * Tests for match play state management
 *
 * Tests the matchSlice with scoring, Crawford rule, and match completion.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { configureStore } from '@reduxjs/toolkit'
import {
  matchReducer,
  startMatch,
  recordGameResult,
  resetMatch,
  selectMatchState,
  selectMatchScore,
  selectIsCrawfordGame,
  selectMatchWinner,
  selectIsMatchInProgress,
  selectMatchGameNumber,
  type GameResult,
  type MatchState
} from '../index'

function createTestStore() {
  return configureStore({
    reducer: { match: matchReducer }
  })
}

type TestStore = ReturnType<typeof createTestStore>

function getMatchState(store: TestStore): MatchState | null {
  return store.getState().match
}

function makeResult({
  winner,
  victoryType = 'single',
  cubeValue = 1,
  points
}: {
  winner: 'white' | 'black'
  victoryType?: 'single' | 'gammon' | 'backgammon'
  cubeValue?: 1 | 2 | 4 | 8 | 16 | 32 | 64
  points?: number
}): GameResult {
  const multiplier = victoryType === 'single' ? 1 : victoryType === 'gammon' ? 2 : 3
  return {
    winner,
    victoryType,
    cubeValue,
    points: points ?? multiplier * cubeValue
  }
}

// =============================================================================
// startMatch
// =============================================================================

describe('startMatch', () => {
  let store: TestStore

  beforeEach(() => {
    store = createTestStore()
  })

  it('should initialize match state correctly', () => {
    store.dispatch(startMatch({ targetScore: 7, enableDoublingCube: true }))
    const match = getMatchState(store)!

    expect(match.config).toEqual({ targetScore: 7, enableDoublingCube: true })
    expect(match.score).toEqual({ white: 0, black: 0 })
    expect(match.phase).toBe('in_progress')
    expect(match.winner).toBeNull()
    expect(match.gameNumber).toBe(1)
    expect(match.isCrawfordGame).toBe(false)
    expect(match.crawfordGameUsed).toBe(false)
    expect(match.gameHistory).toEqual([])
  })

  it('should be null before starting', () => {
    expect(getMatchState(store)).toBeNull()
  })
})

// =============================================================================
// recordGameResult - Basic Scoring
// =============================================================================

describe('recordGameResult - Basic Scoring', () => {
  let store: TestStore

  beforeEach(() => {
    store = createTestStore()
    store.dispatch(startMatch({ targetScore: 7, enableDoublingCube: true }))
  })

  it('should add points to winner score', () => {
    store.dispatch(recordGameResult(makeResult({ winner: 'white', points: 2 })))
    const match = getMatchState(store)!

    expect(match.score.white).toBe(2)
    expect(match.score.black).toBe(0)
    expect(match.gameNumber).toBe(2)
  })

  it('should accumulate scores across games', () => {
    store.dispatch(recordGameResult(makeResult({ winner: 'white', points: 1 })))
    store.dispatch(recordGameResult(makeResult({ winner: 'black', points: 2 })))
    store.dispatch(recordGameResult(makeResult({ winner: 'white', points: 3 })))

    const match = getMatchState(store)!
    expect(match.score.white).toBe(4)
    expect(match.score.black).toBe(2)
    expect(match.gameNumber).toBe(4)
    expect(match.gameHistory.length).toBe(3)
  })

  it('should track game history', () => {
    const result1 = makeResult({ winner: 'white', victoryType: 'single', cubeValue: 1 })
    const result2 = makeResult({ winner: 'black', victoryType: 'gammon', cubeValue: 2 })

    store.dispatch(recordGameResult(result1))
    store.dispatch(recordGameResult(result2))

    const match = getMatchState(store)!
    expect(match.gameHistory).toEqual([result1, result2])
  })
})

// =============================================================================
// recordGameResult - Match Completion
// =============================================================================

describe('recordGameResult - Match Completion', () => {
  let store: TestStore

  beforeEach(() => {
    store = createTestStore()
    store.dispatch(startMatch({ targetScore: 3, enableDoublingCube: true }))
  })

  it('should complete match when target score reached', () => {
    store.dispatch(recordGameResult(makeResult({ winner: 'white', points: 3 })))

    const match = getMatchState(store)!
    expect(match.phase).toBe('completed')
    expect(match.winner).toBe('white')
  })

  it('should complete match when target score exceeded', () => {
    store.dispatch(recordGameResult(makeResult({ winner: 'black', points: 1 })))
    store.dispatch(recordGameResult(makeResult({ winner: 'white', victoryType: 'gammon', cubeValue: 2 })))

    const match = getMatchState(store)!
    expect(match.phase).toBe('completed')
    expect(match.winner).toBe('white')
    expect(match.score.white).toBe(4) // gammon * 2 cube = 4
  })

  it('should not record results after match is completed', () => {
    store.dispatch(recordGameResult(makeResult({ winner: 'white', points: 3 })))
    store.dispatch(recordGameResult(makeResult({ winner: 'black', points: 5 })))

    const match = getMatchState(store)!
    expect(match.winner).toBe('white')
    expect(match.score.black).toBe(0) // Should not have increased
    expect(match.gameHistory.length).toBe(1) // Should not have increased
  })
})

// =============================================================================
// Crawford Rule
// =============================================================================

describe('Crawford Rule', () => {
  let store: TestStore

  beforeEach(() => {
    store = createTestStore()
    store.dispatch(startMatch({ targetScore: 5, enableDoublingCube: true }))
  })

  it('should trigger Crawford game when a player reaches targetScore - 1', () => {
    // White wins 4 points (1 away from 5)
    store.dispatch(recordGameResult(makeResult({ winner: 'white', victoryType: 'gammon', cubeValue: 2 })))

    const match = getMatchState(store)!
    expect(match.score.white).toBe(4) // 1 away from target
    expect(match.isCrawfordGame).toBe(true)
    expect(match.crawfordGameUsed).toBe(false)
  })

  it('should mark Crawford as used after the Crawford game', () => {
    // Get to Crawford
    store.dispatch(recordGameResult(makeResult({ winner: 'white', points: 4 })))
    expect(getMatchState(store)!.isCrawfordGame).toBe(true)

    // Play the Crawford game (black wins 1 point)
    store.dispatch(recordGameResult(makeResult({ winner: 'black', points: 1 })))

    const match = getMatchState(store)!
    expect(match.isCrawfordGame).toBe(false)
    expect(match.crawfordGameUsed).toBe(true)
  })

  it('should not trigger Crawford again after it has been used', () => {
    // Get to Crawford
    store.dispatch(recordGameResult(makeResult({ winner: 'white', points: 4 })))
    expect(getMatchState(store)!.isCrawfordGame).toBe(true)

    // Play Crawford game
    store.dispatch(recordGameResult(makeResult({ winner: 'black', points: 1 })))
    expect(getMatchState(store)!.crawfordGameUsed).toBe(true)

    // Black scores don't re-trigger Crawford even though white is still at target-1
    store.dispatch(recordGameResult(makeResult({ winner: 'black', points: 1 })))
    const match = getMatchState(store)!
    expect(match.isCrawfordGame).toBe(false)
  })

  it('should not trigger Crawford when score jumps past targetScore - 1', () => {
    // White wins enough to go straight to target
    store.dispatch(recordGameResult(makeResult({ winner: 'white', points: 5 })))

    const match = getMatchState(store)!
    expect(match.phase).toBe('completed')
    expect(match.winner).toBe('white')
    // Crawford was never relevant
    expect(match.crawfordGameUsed).toBe(false)
  })
})

// =============================================================================
// Selectors
// =============================================================================

describe('Match Selectors', () => {
  let store: TestStore

  beforeEach(() => {
    store = createTestStore()
  })

  it('selectMatchState should return null when no match', () => {
    expect(selectMatchState(store.getState())).toBeNull()
  })

  it('selectMatchState should return match state', () => {
    store.dispatch(startMatch({ targetScore: 7, enableDoublingCube: true }))
    expect(selectMatchState(store.getState())).not.toBeNull()
  })

  it('selectMatchScore should return null when no match', () => {
    expect(selectMatchScore(store.getState())).toBeNull()
  })

  it('selectMatchScore should return scores', () => {
    store.dispatch(startMatch({ targetScore: 7, enableDoublingCube: true }))
    store.dispatch(recordGameResult(makeResult({ winner: 'white', points: 3 })))
    expect(selectMatchScore(store.getState())).toEqual({ white: 3, black: 0 })
  })

  it('selectIsCrawfordGame should return false when no match', () => {
    expect(selectIsCrawfordGame(store.getState())).toBe(false)
  })

  it('selectMatchWinner should return null when no match', () => {
    expect(selectMatchWinner(store.getState())).toBeNull()
  })

  it('selectMatchWinner should return winner when completed', () => {
    store.dispatch(startMatch({ targetScore: 3, enableDoublingCube: true }))
    store.dispatch(recordGameResult(makeResult({ winner: 'black', points: 3 })))
    expect(selectMatchWinner(store.getState())).toBe('black')
  })

  it('selectIsMatchInProgress should track match phase', () => {
    expect(selectIsMatchInProgress(store.getState())).toBe(false)

    store.dispatch(startMatch({ targetScore: 3, enableDoublingCube: true }))
    expect(selectIsMatchInProgress(store.getState())).toBe(true)

    store.dispatch(recordGameResult(makeResult({ winner: 'white', points: 3 })))
    expect(selectIsMatchInProgress(store.getState())).toBe(false)
  })

  it('selectMatchGameNumber should return current game number', () => {
    expect(selectMatchGameNumber(store.getState())).toBe(0)

    store.dispatch(startMatch({ targetScore: 7, enableDoublingCube: true }))
    expect(selectMatchGameNumber(store.getState())).toBe(1)

    store.dispatch(recordGameResult(makeResult({ winner: 'white', points: 1 })))
    expect(selectMatchGameNumber(store.getState())).toBe(2)
  })
})

// =============================================================================
// resetMatch
// =============================================================================

describe('resetMatch', () => {
  let store: TestStore

  beforeEach(() => {
    store = createTestStore()
  })

  it('should reset to null', () => {
    store.dispatch(startMatch({ targetScore: 7, enableDoublingCube: true }))
    store.dispatch(recordGameResult(makeResult({ winner: 'white', points: 3 })))

    store.dispatch(resetMatch())
    expect(getMatchState(store)).toBeNull()
  })
})
