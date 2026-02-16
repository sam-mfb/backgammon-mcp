/**
 * Tests that structuredContent payloads match their declared output schemas.
 *
 * Uses z.object(schema).strict() which rejects any extra keys not declared
 * in the schema. This catches the exact bug where a field is added to
 * structuredContent but not to the output schema — causing MCP clients
 * to get "Tool execution error" from schema validation.
 */

import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { GameResponseOutputSchema } from '../schemas'
import type { GameState, MatchState } from '@backgammon/game'

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const INITIAL_BOARD = {
  // Standard backgammon starting position
  points: [-2, 0, 0, 0, 0, 5, 0, 3, 0, 0, 0, -5, 5, 0, 0, 0, -3, 0, -5, 0, 0, 0, 0, 2] as [
    number, number, number, number, number, number,
    number, number, number, number, number, number,
    number, number, number, number, number, number,
    number, number, number, number, number, number
  ],
  bar: { white: 0, black: 0 },
  borneOff: { white: 0, black: 0 }
}

function makeGameState(overrides?: Partial<GameState>): GameState {
  return {
    board: INITIAL_BOARD,
    currentPlayer: 'white',
    phase: 'moving',
    diceRoll: { die1: 3, die2: 5 },
    remainingMoves: [3, 5],
    turnNumber: 1,
    movesThisTurn: [],
    result: null,
    history: [],
    actionHistory: [
      { type: 'game_start', firstPlayer: 'white', whiteRoll: 5, blackRoll: 3 }
    ],
    doublingCube: { value: 1, owner: 'centered' },
    doubleProposedBy: null,
    ...overrides
  }
}

function makeMatchState(overrides?: Partial<MatchState>): MatchState {
  return {
    config: { targetScore: 5, enableDoublingCube: true },
    score: { white: 0, black: 0 },
    phase: 'in_progress',
    winner: null,
    gameNumber: 1,
    isCrawfordGame: false,
    crawfordGameUsed: false,
    gameHistory: [],
    ...overrides
  }
}

function makeValidMoves(): { from: number | 'bar'; destinations: { to: number | 'off'; dieValue: number; wouldHit: boolean }[] }[] {
  return [
    {
      from: 24,
      destinations: [
        { to: 21, dieValue: 3, wouldHit: false },
        { to: 19, dieValue: 5, wouldHit: false }
      ]
    }
  ]
}

const strictSchema = z.object(GameResponseOutputSchema).strict()

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GameResponseOutputSchema', () => {
  it('accepts full response with matchState', () => {
    const payload = {
      gameState: makeGameState(),
      validMoves: makeValidMoves(),
      config: { whiteControl: 'human' as const, blackControl: 'ai' as const },
      matchState: makeMatchState()
    }

    const result = strictSchema.safeParse(payload)
    expect(result.success).toBe(true)
  })

  it('accepts response with matchState: null', () => {
    const payload = {
      gameState: makeGameState(),
      validMoves: makeValidMoves(),
      config: { whiteControl: 'human' as const, blackControl: 'ai' as const },
      matchState: null
    }

    const result = strictSchema.safeParse(payload)
    expect(result.success).toBe(true)
  })

  it('accepts response without matchState (single game)', () => {
    const payload = {
      gameState: makeGameState({ doublingCube: null }),
      validMoves: makeValidMoves(),
      config: { whiteControl: 'human' as const, blackControl: 'ai' as const }
    }

    const result = strictSchema.safeParse(payload)
    expect(result.success).toBe(true)
  })

  it('accepts minimal response (gameState only)', () => {
    const payload = {
      gameState: makeGameState()
    }

    const result = strictSchema.safeParse(payload)
    expect(result.success).toBe(true)
  })

  it('rejects unknown fields in structuredContent', () => {
    const payload = {
      gameState: makeGameState(),
      unknownField: 'should fail'
    }

    const result = strictSchema.safeParse(payload)
    expect(result.success).toBe(false)
  })

  it('accepts completed match state', () => {
    const payload = {
      gameState: makeGameState({ phase: 'game_over', result: { winner: 'white', victoryType: 'gammon', cubeValue: 2, points: 4 } }),
      matchState: makeMatchState({
        phase: 'completed',
        winner: 'white',
        score: { white: 5, black: 3 },
        gameNumber: 4,
        gameHistory: [
          { winner: 'white', victoryType: 'single', cubeValue: 1, points: 1 },
          { winner: 'black', victoryType: 'single', cubeValue: 2, points: 2 },
          { winner: 'white', victoryType: 'gammon', cubeValue: 2, points: 4 }
        ]
      })
    }

    const result = strictSchema.safeParse(payload)
    expect(result.success).toBe(true)
  })
})

describe('Extended schemas (view_roll_dice pattern)', () => {
  it('accepts turnSummary and turnForfeited alongside base fields', () => {
    const extendedSchema = z.object({
      ...GameResponseOutputSchema,
      turnSummary: z.string().optional(),
      turnForfeited: z.boolean().optional()
    }).strict()

    const payload = {
      gameState: makeGameState(),
      validMoves: makeValidMoves(),
      matchState: makeMatchState(),
      turnSummary: 'White moved 24/21, 13/8',
      turnForfeited: false
    }

    const result = extendedSchema.safeParse(payload)
    expect(result.success).toBe(true)
  })
})
