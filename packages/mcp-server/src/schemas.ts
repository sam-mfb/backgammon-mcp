/**
 * Zod schemas for MCP tool output validation.
 *
 * These schemas define the shape of structuredContent returned by tool handlers.
 * The MCP SDK validates structuredContent against these schemas, so every field
 * returned in structuredContent MUST be declared here.
 *
 * Extracted from server.ts for testability.
 */

import { z } from 'zod'

export const PlayerSchema = z.enum(['white', 'black'])

export const DieValueSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6)
])

export const PointIndexSchema = z.number().int().min(1).max(24)

export const CheckerCountsSchema = z.object({
  white: z.number().int().min(0),
  black: z.number().int().min(0)
})

export const BoardStateSchema = z.object({
  points: z.tuple([
    z.number(),
    z.number(),
    z.number(),
    z.number(),
    z.number(),
    z.number(),
    z.number(),
    z.number(),
    z.number(),
    z.number(),
    z.number(),
    z.number(),
    z.number(),
    z.number(),
    z.number(),
    z.number(),
    z.number(),
    z.number(),
    z.number(),
    z.number(),
    z.number(),
    z.number(),
    z.number(),
    z.number()
  ]),
  bar: CheckerCountsSchema,
  borneOff: CheckerCountsSchema
})

export const DiceRollSchema = z.object({
  die1: DieValueSchema,
  die2: DieValueSchema
})

export const MoveFromSchema = z.union([PointIndexSchema, z.literal('bar')])

export const MoveToSchema = z.union([PointIndexSchema, z.literal('off')])

export const MoveSchema = z.object({
  from: MoveFromSchema,
  to: MoveToSchema,
  dieUsed: DieValueSchema
})

export const TurnSchema = z.object({
  player: PlayerSchema,
  diceRoll: DiceRollSchema,
  moves: z.array(MoveSchema)
})

export const GamePhaseSchema = z.enum([
  'not_started',
  'rolling_for_first',
  'rolling',
  'doubling_proposed',
  'moving',
  'game_over'
])

export const VictoryTypeSchema = z.enum(['single', 'gammon', 'backgammon'])

export const CubeValueSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(4),
  z.literal(8),
  z.literal(16),
  z.literal(32),
  z.literal(64)
])

export const CubeOwnerSchema = z.union([PlayerSchema, z.literal('centered')])

export const DoublingCubeStateSchema = z.object({
  value: CubeValueSchema,
  owner: CubeOwnerSchema
})

export const GameResultSchema = z.object({
  winner: PlayerSchema,
  victoryType: VictoryTypeSchema,
  cubeValue: CubeValueSchema,
  points: z.number().int().min(1)
})

export const GameActionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('game_start'),
    firstPlayer: PlayerSchema,
    whiteRoll: DieValueSchema,
    blackRoll: DieValueSchema
  }),
  z.object({
    type: z.literal('dice_roll'),
    player: PlayerSchema,
    roll: DiceRollSchema,
    turnForfeited: z.boolean()
  }),
  z.object({
    type: z.literal('piece_move'),
    player: PlayerSchema,
    from: MoveFromSchema,
    to: MoveToSchema,
    dieUsed: DieValueSchema,
    hit: z.boolean()
  }),
  z.object({
    type: z.literal('turn_end'),
    player: PlayerSchema
  }),
  z.object({
    type: z.literal('double_proposed'),
    player: PlayerSchema,
    newValue: CubeValueSchema
  }),
  z.object({
    type: z.literal('double_accepted'),
    player: PlayerSchema,
    cubeValue: CubeValueSchema
  }),
  z.object({
    type: z.literal('double_declined'),
    player: PlayerSchema,
    cubeValue: CubeValueSchema
  })
])

export const GameStateSchema = z.object({
  board: BoardStateSchema,
  currentPlayer: PlayerSchema.nullable(),
  phase: GamePhaseSchema,
  diceRoll: DiceRollSchema.nullable(),
  remainingMoves: z.array(DieValueSchema),
  turnNumber: z.number().int().min(0),
  movesThisTurn: z.array(MoveSchema),
  result: GameResultSchema.nullable(),
  history: z.array(TurnSchema),
  actionHistory: z.array(GameActionSchema),
  doublingCube: DoublingCubeStateSchema.nullable(),
  doubleProposedBy: PlayerSchema.nullable()
})

export const MoveDestinationSchema = z.object({
  to: MoveToSchema,
  dieValue: DieValueSchema,
  wouldHit: z.boolean()
})

export const AvailableMovesSchema = z.object({
  from: MoveFromSchema,
  destinations: z.array(MoveDestinationSchema)
})

export const GameConfigSchema = z.object({
  whiteControl: z.enum(['human', 'ai']),
  blackControl: z.enum(['human', 'ai'])
})

export const MatchConfigSchema = z.object({
  targetScore: z.number().int().min(1),
  enableDoublingCube: z.boolean()
})

export const MatchStateSchema = z.object({
  config: MatchConfigSchema,
  score: z.object({ white: z.number().int().min(0), black: z.number().int().min(0) }),
  phase: z.enum(['in_progress', 'completed']),
  winner: PlayerSchema.nullable(),
  gameNumber: z.number().int().min(1),
  isCrawfordGame: z.boolean(),
  crawfordGameUsed: z.boolean(),
  gameHistory: z.array(GameResultSchema)
})

/** Output schema shape for tools that return game state with valid moves and config */
export const GameResponseOutputSchema = {
  gameState: GameStateSchema,
  validMoves: z.array(AvailableMovesSchema).optional(),
  config: GameConfigSchema.optional(),
  matchState: MatchStateSchema.nullable().optional()
}
