/**
 * Backgammon MCP Server
 *
 * Main entry point for the MCP server. Sets up the server with stdio transport
 * and registers all backgammon tools.
 */

import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import {
  registerAppTool,
  registerAppResource,
  RESOURCE_MIME_TYPE
} from '@modelcontextprotocol/ext-apps/server'
import { store, setGameConfig } from './store'
import type {
  BackgammonStructuredContent,
  GameConfig,
  TurnSummary
} from './types'
import {
  performStartGame,
  performRollDice,
  performMove,
  performEndTurn,
  resetGame,
  getValidMoves,
  type GameState
} from '@backgammon/game'

// =============================================================================
// Constants
// =============================================================================

const __dirname = dirname(fileURLToPath(import.meta.url))
const RESOURCE_URI = 'ui://backgammon/board'

// =============================================================================
// Output Schemas (Zod schemas for tool output validation)
// =============================================================================

const PlayerSchema = z.enum(['white', 'black'])

const DieValueSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6)
])

const PointIndexSchema = z.number().int().min(1).max(24)

const CheckerCountsSchema = z.object({
  white: z.number().int().min(0),
  black: z.number().int().min(0)
})

const BoardStateSchema = z.object({
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

const DiceRollSchema = z.object({
  die1: DieValueSchema,
  die2: DieValueSchema
})

const MoveFromSchema = z.union([PointIndexSchema, z.literal('bar')])

const MoveToSchema = z.union([PointIndexSchema, z.literal('off')])

const MoveSchema = z.object({
  from: MoveFromSchema,
  to: MoveToSchema,
  dieUsed: DieValueSchema
})

const TurnSchema = z.object({
  player: PlayerSchema,
  diceRoll: DiceRollSchema,
  moves: z.array(MoveSchema)
})

const GamePhaseSchema = z.enum([
  'not_started',
  'rolling_for_first',
  'rolling',
  'moving',
  'game_over'
])

const VictoryTypeSchema = z.enum(['single', 'gammon', 'backgammon'])

const GameResultSchema = z.object({
  winner: PlayerSchema,
  victoryType: VictoryTypeSchema
})

const GameActionSchema = z.discriminatedUnion('type', [
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
  })
])

const GameStateSchema = z.object({
  board: BoardStateSchema,
  currentPlayer: PlayerSchema.nullable(),
  phase: GamePhaseSchema,
  diceRoll: DiceRollSchema.nullable(),
  remainingMoves: z.array(DieValueSchema),
  turnNumber: z.number().int().min(0),
  movesThisTurn: z.array(MoveSchema),
  result: GameResultSchema.nullable(),
  history: z.array(TurnSchema),
  actionHistory: z.array(GameActionSchema)
})

const MoveDestinationSchema = z.object({
  to: MoveToSchema,
  dieValue: DieValueSchema,
  wouldHit: z.boolean()
})

const AvailableMovesSchema = z.object({
  from: MoveFromSchema,
  destinations: z.array(MoveDestinationSchema)
})

const GameConfigSchema = z.object({
  whiteControl: z.enum(['human', 'ai']),
  blackControl: z.enum(['human', 'ai'])
})

/** Output schema shape for tools that return game state with valid moves and config */
const GameResponseOutputSchema = {
  gameState: GameStateSchema,
  validMoves: z.array(AvailableMovesSchema).optional(),
  config: GameConfigSchema.optional()
}

// =============================================================================
// Helpers
// =============================================================================

function errorResponse(message: string): {
  content: { type: 'text'; text: string }[]
  isError: true
} {
  return {
    content: [{ type: 'text' as const, text: `Error: ${message}` }],
    isError: true
  }
}

function textResponse(text: string): {
  content: { type: 'text'; text: string }[]
} {
  return {
    content: [{ type: 'text' as const, text }]
  }
}

/**
 * Format valid moves as readable text for the model.
 * Example: "From 24: 21, 19. From 13: 8 (hit), 7."
 */
function formatValidMovesForModel(
  validMoves: readonly {
    from: number | 'bar'
    destinations: readonly {
      to: number | 'off'
      dieValue: number
      wouldHit: boolean
    }[]
  }[]
): string {
  if (validMoves.length === 0) return 'No valid moves.'
  return (
    validMoves
      .map(m => {
        const dests = m.destinations
          .map(d => {
            const hitStr = d.wouldHit ? ' (hit)' : ''
            return `${String(d.to)}${hitStr}`
          })
          .join(', ')
        return `From ${String(m.from)}: ${dests}`
      })
      .join('. ') + '.'
  )
}

/**
 * Create a response with both text content (for non-App hosts) and
 * structured content (for UI rendering).
 */
function gameResponse(
  text: string,
  structured?: BackgammonStructuredContent
): {
  content: { type: 'text'; text: string }[]
  structuredContent?: BackgammonStructuredContent
} {
  return {
    content: [{ type: 'text' as const, text }],
    structuredContent: structured
  }
}

/**
 * Check if it's currently the human player's turn
 */
function isHumanTurn(state: GameState, config: GameConfig): boolean {
  if (!state.currentPlayer) return false
  const control =
    state.currentPlayer === 'white' ? config.whiteControl : config.blackControl
  return control === 'human'
}

/**
 * Check if it's currently the AI player's turn
 */
function isAITurn(state: GameState, config: GameConfig): boolean {
  if (!state.currentPlayer) return false
  const control =
    state.currentPlayer === 'white' ? config.whiteControl : config.blackControl
  return control === 'ai'
}

/**
 * Build a turn summary for model context updates.
 * Called when view_end_turn informs the model of the user's completed turn.
 */
function buildTurnSummary(
  state: GameState,
  movesWithHits: readonly { hit: boolean }[]
): TurnSummary {
  const lastTurn = state.history[state.history.length - 1]
  const nextPlayer = state.currentPlayer
  if (!nextPlayer) {
    throw new Error('No current player - cannot build turn summary')
  }

  const movesWithHitInfo = lastTurn.moves.map((move, i) => ({
    ...move,
    hit: movesWithHits[i]?.hit ?? false
  }))

  return {
    player: lastTurn.player,
    diceRoll: lastTurn.diceRoll,
    moves: movesWithHitInfo,
    boardSummary: {
      whiteHome: state.board.borneOff.white,
      blackHome: state.board.borneOff.black,
      whiteBar: state.board.bar.white,
      blackBar: state.board.bar.black
    },
    nextPlayer
  }
}

/**
 * Format a turn summary as markdown text for model context
 */
function formatTurnSummaryForModel(summary: TurnSummary): string {
  const playerName =
    summary.player.charAt(0).toUpperCase() + summary.player.slice(1)
  const diceStr = `${String(summary.diceRoll.die1)}-${String(summary.diceRoll.die2)}`

  let movesStr: string
  if (summary.moves.length === 0) {
    movesStr = '(no valid moves - turn forfeited)'
  } else {
    movesStr = summary.moves
      .map(m => {
        const hitStr = m.hit ? ' (hit!)' : ''
        return `${String(m.from)}→${String(m.to)}${hitStr}`
      })
      .join(', ')
  }

  const nextPlayerName =
    summary.nextPlayer.charAt(0).toUpperCase() + summary.nextPlayer.slice(1)

  return `${playerName} (${summary.player}) completed turn:
- Rolled: ${diceStr}
- Moves: ${movesStr}
- Board: White ${String(summary.boardSummary.whiteHome)} home, Black ${String(summary.boardSummary.blackHome)} home, White ${String(summary.boardSummary.whiteBar)} bar, Black ${String(summary.boardSummary.blackBar)} bar
- ${nextPlayerName}'s turn (${summary.nextPlayer}) to roll.`
}

// =============================================================================
// Server Setup
// =============================================================================

const server = new McpServer({
  name: 'backgammon',
  version: '1.0.0'
})

// =============================================================================
// Resource: UI
// =============================================================================

registerAppResource(
  server,
  'Backgammon Board',
  RESOURCE_URI,
  {
    mimeType: RESOURCE_MIME_TYPE,
    description: 'Interactive backgammon game board'
  },
  () => {
    // Path resolves relative to src/ where this file lives, going up to package root then into dist/
    const htmlPath = join(__dirname, '../dist/client/index.html')
    const html = readFileSync(htmlPath, 'utf-8')
    return {
      contents: [
        {
          uri: RESOURCE_URI,
          mimeType: RESOURCE_MIME_TYPE,
          text: html
        }
      ]
    }
  }
)

// =============================================================================
// Tool: Start Game
// =============================================================================

registerAppTool(
  server,
  'backgammon_start_game',
  {
    description: `Start a new backgammon game. Initializes the board with standard starting positions, rolls dice to determine who goes first, and begins the first turn.

When playing, just make your moves without commentary or strategy discussion unless the user asks. Point numbers are from white's perspective: white moves from 24 toward 1, black moves from 1 toward 24.`,
    inputSchema: {
      whiteControl: z
        .enum(['human', 'ai'])
        .optional()
        .default('human')
        .describe("Who controls white: 'human' (UI) or 'ai' (model)"),
      blackControl: z
        .enum(['human', 'ai'])
        .optional()
        .default('ai')
        .describe("Who controls black: 'human' (UI) or 'ai' (model)")
    },
    outputSchema: GameResponseOutputSchema,
    _meta: { ui: { resourceUri: RESOURCE_URI } }
  },
  ({ whiteControl, blackControl }) => {
    const config: GameConfig = { whiteControl, blackControl }
    store.dispatch(setGameConfig(config))

    const action = store.dispatch(performStartGame())
    const result = action.meta.result

    if (result?.ok !== true) {
      return errorResponse('Failed to start game')
    }

    const { firstPlayer, diceRoll, validMoves } = result.value
    const state = store.getState().game

    const playerName =
      firstPlayer.charAt(0).toUpperCase() + firstPlayer.slice(1)
    const text = `Game started. ${playerName} goes first with ${String(diceRoll.die1)}-${String(diceRoll.die2)}.`

    return gameResponse(text, {
      gameState: state,
      validMoves,
      config
    })
  }
)

// =============================================================================
// View-Only Tools (visibility: ['app']) - For human player UI interactions
// =============================================================================

// Track moves with hit info during human turn for turn summary
let movesWithHitsThisTurn: { hit: boolean }[] = []

registerAppTool(
  server,
  'view_roll_dice',
  {
    description:
      "Roll the dice for the human player's turn. If no valid moves exist, the turn is automatically forfeited.",
    outputSchema: {
      ...GameResponseOutputSchema,
      turnForfeited: z.boolean().optional()
    },
    _meta: { ui: { resourceUri: RESOURCE_URI, visibility: ['app'] } }
  },
  () => {
    const config = store.getState().config
    const stateBefore = store.getState().game

    // Verify it's the human's turn
    if (!isHumanTurn(stateBefore, config)) {
      return errorResponse("It's not the human player's turn to roll")
    }

    // Reset hit tracking for new turn
    movesWithHitsThisTurn = []

    const action = store.dispatch(performRollDice())
    const result = action.meta.result

    if (!result) {
      return errorResponse('Failed to roll dice')
    }

    if (!result.ok) {
      return errorResponse(result.error.message)
    }

    const { diceRoll, validMoves, turnForfeited } = result.value
    const state = store.getState().game

    const diceText = `${String(diceRoll.die1)}-${String(diceRoll.die2)}`

    // If turn was forfeited (no valid moves), auto-end and include turn summary
    // for client to send via updateModelContext
    if (turnForfeited) {
      const summary = buildTurnSummary(state, [])
      const summaryText = formatTurnSummaryForModel(summary)

      return {
        content: [
          {
            type: 'text' as const,
            text: `Rolled ${diceText}. No legal moves - turn forfeited.`
          }
        ],
        structuredContent: {
          gameState: state,
          validMoves,
          turnSummary: summaryText
        },
        _meta: { ui: { resourceUri: RESOURCE_URI, visibility: ['app'] } },
        turnForfeited: true
      }
    }

    return {
      content: [{ type: 'text' as const, text: `Rolled ${diceText}.` }],
      structuredContent: {
        gameState: state,
        validMoves
      },
      _meta: { ui: { resourceUri: RESOURCE_URI, visibility: ['app'] } }
    }
  }
)

registerAppTool(
  server,
  'view_make_move',
  {
    description:
      "Make a move during the human player's turn. Updates UI only - model is NOT informed until view_end_turn is called.",
    inputSchema: {
      from: z
        .union([z.number().int().min(1).max(24), z.literal('bar')])
        .describe("Starting point (1-24) or 'bar'"),
      to: z
        .union([z.number().int().min(1).max(24), z.literal('off')])
        .describe("Destination point (1-24) or 'off' to bear off"),
      dieUsed: z
        .number()
        .int()
        .min(1)
        .max(6)
        .describe('The die value being used for this move (1-6)')
    },
    outputSchema: GameResponseOutputSchema,
    _meta: { ui: { resourceUri: RESOURCE_URI, visibility: ['app'] } }
  },
  ({ from, to, dieUsed }) => {
    const config = store.getState().config
    const stateBefore = store.getState().game

    // Verify it's the human's turn
    if (!isHumanTurn(stateBefore, config)) {
      return errorResponse("It's not the human player's turn to move")
    }

    const action = store.dispatch(performMove({ from, to, dieUsed }))
    const result = action.meta.result

    if (!result) {
      return errorResponse('Failed to make move')
    }

    if (!result.ok) {
      return errorResponse(result.error.message)
    }

    const { move, hit, gameOver, validMoves } = result.value
    const state = store.getState().game

    // Track hit for turn summary
    movesWithHitsThisTurn.push({ hit })

    // Build text response
    let text: string
    if (move.to === 'off') {
      text = `Bore off from ${String(move.from)} using ${String(move.dieUsed)}.`
    } else {
      text = `Moved ${String(move.from)} → ${String(move.to)} using ${String(move.dieUsed)}`
      if (hit) {
        text += ' (hit!)'
      }
      text += '.'
    }

    if (gameOver) {
      const winnerName =
        gameOver.winner.charAt(0).toUpperCase() + gameOver.winner.slice(1)
      text += ` Game over! ${winnerName} wins with a ${gameOver.victoryType}!`
    }

    return {
      content: [{ type: 'text' as const, text }],
      structuredContent: {
        gameState: state,
        validMoves
      },
      _meta: { ui: { resourceUri: RESOURCE_URI, visibility: ['app'] } }
    }
  }
)

registerAppTool(
  server,
  'view_end_turn',
  {
    description:
      "End the human player's turn and pass control to the next player.",
    outputSchema: GameResponseOutputSchema,
    _meta: { ui: { resourceUri: RESOURCE_URI, visibility: ['app'] } }
  },
  () => {
    const config = store.getState().config
    const stateBefore = store.getState().game

    // Verify it's the human's turn
    if (!isHumanTurn(stateBefore, config)) {
      return errorResponse("It's not the human player's turn to end")
    }

    // Capture moves with hits before ending turn
    const movesWithHits = [...movesWithHitsThisTurn]

    const action = store.dispatch(performEndTurn())
    const result = action.meta.result

    if (!result) {
      return errorResponse('Failed to end turn')
    }

    if (!result.ok) {
      return errorResponse(result.error.message)
    }

    const { nextPlayer } = result.value
    const state = store.getState().game

    // Build turn summary for model
    const summary = buildTurnSummary(state, movesWithHits)
    const summaryText = formatTurnSummaryForModel(summary)

    // Reset hit tracking
    movesWithHitsThisTurn = []

    const playerName = nextPlayer.charAt(0).toUpperCase() + nextPlayer.slice(1)

    return {
      content: [
        { type: 'text' as const, text: `Turn ended. ${playerName} to roll.` }
      ],
      structuredContent: {
        gameState: state,
        turnSummary: summaryText
      },
      _meta: { ui: { resourceUri: RESOURCE_URI, visibility: ['app'] } }
    }
  }
)

// =============================================================================
// Model Tools (visibility: ['model']) - For AI player actions
// =============================================================================

registerAppTool(
  server,
  'model_roll_dice',
  {
    description:
      "Roll the dice for the AI player's turn. Remember: point numbers are from white's perspective (white moves 24→1, black moves 1→24).",
    _meta: { ui: { resourceUri: RESOURCE_URI, visibility: ['model'] } }
  },
  () => {
    const config = store.getState().config
    const stateBefore = store.getState().game

    // Verify it's the AI's turn
    if (!isAITurn(stateBefore, config)) {
      return errorResponse("It's not the AI player's turn to roll")
    }

    const action = store.dispatch(performRollDice())
    const result = action.meta.result

    if (!result) {
      return errorResponse('Failed to roll dice')
    }

    if (!result.ok) {
      return errorResponse(result.error.message)
    }

    const { diceRoll, validMoves, turnForfeited } = result.value

    const diceText = `${String(diceRoll.die1)}-${String(diceRoll.die2)}`
    let text: string
    if (turnForfeited) {
      text = `Rolled ${diceText}. No legal moves - turn forfeited.`
    } else {
      text = `Rolled ${diceText}. ${formatValidMovesForModel(validMoves)}`
    }

    return {
      content: [{ type: 'text' as const, text }],
      _meta: { ui: { resourceUri: RESOURCE_URI, visibility: ['model'] } },
      turnForfeited
    }
  }
)

registerAppTool(
  server,
  'model_take_turn',
  {
    description:
      "Execute the AI player's complete turn atomically. Provide all moves upfront. Use after model_roll_dice (unless turn was forfeited). Automatically ends the turn.",
    inputSchema: {
      moves: z
        .array(
          z.object({
            from: z
              .union([z.number().int().min(1).max(24), z.literal('bar')])
              .describe("Starting point (1-24) or 'bar'"),
            to: z
              .union([z.number().int().min(1).max(24), z.literal('off')])
              .describe("Destination point (1-24) or 'off' to bear off"),
            dieUsed: z
              .number()
              .int()
              .min(1)
              .max(6)
              .describe('The die value being used for this move (1-6)')
          })
        )
        .describe(
          'Array of moves to execute in order. Can be 0-4 moves depending on dice and board state.'
        )
    },
    outputSchema: GameResponseOutputSchema,
    _meta: { ui: { resourceUri: RESOURCE_URI } }
  },
  ({ moves }) => {
    const config = store.getState().config
    const stateBefore = store.getState().game

    // Verify it's the AI's turn
    if (!isAITurn(stateBefore, config)) {
      return errorResponse("It's not the AI player's turn")
    }

    // Verify we're in moving phase
    if (stateBefore.phase !== 'moving') {
      return errorResponse(
        'Cannot take turn - not in moving phase. Use model_roll_dice first.'
      )
    }

    // Execute all moves atomically (rollback on failure)
    const executedMoves: {
      from: number | 'bar'
      to: number | 'off'
      dieUsed: number
      hit: boolean
    }[] = []

    for (let i = 0; i < moves.length; i++) {
      const move = moves[i]
      const action = store.dispatch(
        performMove({ from: move.from, to: move.to, dieUsed: move.dieUsed })
      )
      const result = action.meta.result

      if (!result) {
        return errorResponse(`Move ${String(i + 1)} failed: Unknown error`)
      }

      if (!result.ok) {
        // Return error with context about which move failed
        const validMoves = getValidMoves({ state: store.getState().game })
        const validMovesText = formatValidMovesForModel(validMoves)
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error: Move ${String(i + 1)} (${String(move.from)}→${String(move.to)}) failed: ${result.error.message}. Valid moves: ${validMovesText}`
            }
          ],
          structuredContent: {
            gameState: store.getState().game,
            validMoves
          },
          _meta: { ui: { resourceUri: RESOURCE_URI } },
          isError: true
        }
      }

      executedMoves.push({
        from: move.from,
        to: move.to,
        dieUsed: move.dieUsed,
        hit: result.value.hit
      })

      // Check for game over after each move
      if (result.value.gameOver) {
        const state = store.getState().game
        const winnerName =
          result.value.gameOver.winner.charAt(0).toUpperCase() +
          result.value.gameOver.winner.slice(1)

        return {
          content: [
            {
              type: 'text' as const,
              text: `Turn completed. Game over! ${winnerName} wins with a ${result.value.gameOver.victoryType}!`
            }
          ],
          structuredContent: {
            gameState: state
          },
          _meta: { ui: { resourceUri: RESOURCE_URI } },
          executedMoves
        }
      }
    }

    // End the turn
    const endAction = store.dispatch(performEndTurn())
    const endResult = endAction.meta.result

    if (!endResult) {
      return errorResponse('Failed to end turn')
    }

    if (!endResult.ok) {
      return errorResponse(endResult.error.message)
    }

    const { nextPlayer } = endResult.value
    const state = store.getState().game

    const playerName = nextPlayer.charAt(0).toUpperCase() + nextPlayer.slice(1)
    const moveSummary =
      executedMoves.length > 0
        ? executedMoves
            .map(m => {
              const hitStr = m.hit ? ' (hit!)' : ''
              return `${String(m.from)}→${String(m.to)}${hitStr}`
            })
            .join(', ')
        : 'no moves'

    return {
      content: [
        {
          type: 'text' as const,
          text: `Turn completed: ${moveSummary}. ${playerName} to roll.`
        }
      ],
      structuredContent: {
        gameState: state
      },
      _meta: { ui: { resourceUri: RESOURCE_URI } },
      executedMoves
    }
  }
)

registerAppTool(
  server,
  'model_make_move',
  {
    description:
      "Make a single move when the human user VERBALLY asks you to move on their behalf. Do NOT use this for your own AI turn - use model_take_turn instead. This is for when the user says something like 'move from 13 to 8' during their turn.",
    inputSchema: {
      from: z
        .union([z.number().int().min(1).max(24), z.literal('bar')])
        .describe("Starting point (1-24) or 'bar'"),
      to: z
        .union([z.number().int().min(1).max(24), z.literal('off')])
        .describe("Destination point (1-24) or 'off' to bear off"),
      dieUsed: z
        .number()
        .int()
        .min(1)
        .max(6)
        .describe('The die value being used for this move (1-6)')
    },
    _meta: { ui: { resourceUri: RESOURCE_URI, visibility: ['model'] } }
  },
  ({ from, to, dieUsed }) => {
    const action = store.dispatch(performMove({ from, to, dieUsed }))
    const result = action.meta.result

    if (!result) {
      return errorResponse('Failed to make move')
    }

    if (!result.ok) {
      return errorResponse(result.error.message)
    }

    const { move, hit, gameOver, validMoves } = result.value

    // Track hit for turn summary (in case view_end_turn is called later)
    movesWithHitsThisTurn.push({ hit })

    // Build text response
    let text: string
    if (move.to === 'off') {
      text = `Bore off from ${String(move.from)} using ${String(move.dieUsed)}.`
    } else {
      text = `Moved ${String(move.from)} → ${String(move.to)} using ${String(move.dieUsed)}`
      if (hit) {
        text += ' (hit!)'
      }
      text += '.'
    }

    if (gameOver) {
      const winnerName =
        gameOver.winner.charAt(0).toUpperCase() + gameOver.winner.slice(1)
      text += ` Game over! ${winnerName} wins with a ${gameOver.victoryType}!`
    } else if (validMoves.length > 0) {
      text += ` Remaining: ${formatValidMovesForModel(validMoves)}`
    }

    return {
      content: [{ type: 'text' as const, text }],
      _meta: { ui: { resourceUri: RESOURCE_URI, visibility: ['model'] } }
    }
  }
)

// =============================================================================
// Tool: Get Game State
// =============================================================================

registerAppTool(
  server,
  'backgammon_get_game_state',
  {
    description:
      'Get the current state of the game including board position, current player, dice, and available moves.',
    _meta: { ui: { resourceUri: RESOURCE_URI, visibility: ['model'] } }
  },
  () => {
    const state = store.getState().game

    if (state.phase === 'not_started') {
      return errorResponse(
        'No game in progress. Use backgammon_start_game first.'
      )
    }

    // Get valid moves if in moving phase
    const validMoves =
      state.phase === 'moving' ? getValidMoves({ state }) : undefined

    // Build concise text summary (no ASCII board - JSON gamestate is sufficient)
    const playerName = state.currentPlayer
      ? state.currentPlayer.charAt(0).toUpperCase() +
        state.currentPlayer.slice(1)
      : 'None'
    let text = `Turn ${String(state.turnNumber)}, ${playerName} to play, phase: ${state.phase}`

    if (state.diceRoll) {
      text += `, dice: ${String(state.diceRoll.die1)}-${String(state.diceRoll.die2)}`
    }

    if (validMoves && validMoves.length > 0) {
      text += `. Valid moves: ${formatValidMovesForModel(validMoves)}`
    }

    if (state.remainingMoves.length > 0) {
      text += `, remaining: [${state.remainingMoves.join(', ')}]`
    }

    return gameResponse(text)
  }
)

// =============================================================================
// Tool: Reset Game
// =============================================================================

registerAppTool(
  server,
  'backgammon_reset_game',
  {
    description:
      'Reset the game to its initial state. Use this to start fresh.',
    outputSchema: GameResponseOutputSchema,
    _meta: { ui: { resourceUri: RESOURCE_URI } }
  },
  () => {
    store.dispatch(resetGame())
    const state = store.getState().game

    return gameResponse('Game reset.', {
      gameState: state
    })
  }
)

// =============================================================================
// Tool: Get Rules
// =============================================================================

server.tool(
  'backgammon_get_rules',
  'Get information about backgammon rules. Specify a section: overview, movement, dice, hitting, bearing_off, winning, or all.',
  {
    section: z
      .enum([
        'overview',
        'movement',
        'dice',
        'hitting',
        'bearing_off',
        'winning',
        'all'
      ])
      .optional()
      .default('overview')
      .describe('Which section of rules to retrieve')
  },
  ({ section }) => {
    const rules: Record<string, string> = {
      overview: `BACKGAMMON OVERVIEW
==================
- 2-player board game on a board with 24 points (triangles)
- Each player has 15 checkers
- White (O) moves from point 24 toward point 1
- Black (X) moves from point 1 toward point 24
- Goal: Move all checkers to home board, then bear them all off
- First to bear off all 15 checkers wins

POINT NUMBERING:
- Points 1-6: White's home board
- Points 7-12: White's outer board
- Points 13-18: Black's outer board
- Points 19-24: Black's home board`,

      movement: `MOVEMENT RULES
=============
- Roll 2 dice, each die is a separate move
- Can move one checker twice or two checkers once each
- Must move the exact number of pips shown on each die
- Can only land on: empty points, your own checkers, or opponent's single checker (blot)
- Cannot land on points with 2+ opponent checkers (blocked)
- When moving one checker with both dice, intermediate point must be open

DOUBLES:
- Roll same number = 4 moves of that number
- Example: Roll 3-3, you have four moves of 3 pips each`,

      dice: `DICE RULES
==========
OBLIGATION TO PLAY:
1. Must play both dice if legally possible
2. If only one die playable, must play it
3. If either die but not both playable, must play the HIGHER die
4. If neither playable, turn is forfeited

DOUBLES:
- Rolling same number = 4 moves instead of 2
- Must use as many as legally possible`,

      hitting: `HITTING AND THE BAR
==================
BLOTS:
- A single checker on a point is a "blot"
- Landing on a blot "hits" it - sends it to the bar

BAR RULES:
- Hit checkers must re-enter from the bar before any other moves
- White enters on points 19-24 (roll 1 = point 24, roll 6 = point 19)
- Black enters on points 1-6 (roll 1 = point 1, roll 6 = point 6)
- If entry point is blocked, must use other die or forfeit
- Can hit when entering from bar`,

      bearing_off: `BEARING OFF
===========
REQUIREMENTS:
- ALL 15 checkers must be in home board first
- White's home: points 1-6
- Black's home: points 19-24

MECHANICS:
- Exact roll: Remove checker from that point number
- No checker on rolled point: Must move from higher point if possible
- No higher checkers: May bear off from highest occupied point

INTERRUPTION:
- If hit while bearing off, must re-enter and return to home board before continuing`,

      winning: `WINNING
=======
Game ends when one player bears off all 15 checkers.

VICTORY TYPES:
- Single (1x): Opponent has borne off at least 1 checker
- Gammon (2x): Opponent hasn't borne off any checkers
- Backgammon (3x): Opponent hasn't borne off any AND has checker on bar or in winner's home`
    }

    if (section === 'all') {
      const allRules = Object.values(rules).join(
        '\n\n' + '='.repeat(50) + '\n\n'
      )
      return textResponse(allRules)
    }

    const sectionText = rules[section] ?? rules.overview
    return textResponse(sectionText)
  }
)

// =============================================================================
// Start Server
// =============================================================================

async function main(): Promise<void> {
  const transport = new StdioServerTransport()
  await server.connect(transport)

  // Log to stderr so it doesn't interfere with MCP protocol on stdout
  console.error('Backgammon MCP server running on stdio')
}

main().catch((error: unknown) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
