/**
 * Backgammon MCP Server
 *
 * Main entry point for the MCP server. Sets up the server with stdio transport
 * and registers all backgammon tools.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { store } from './store'
import { renderAvailableMoves, renderFullGameState } from './asciiBoard'
import {
  performStartGame,
  performRollDice,
  performMove,
  performEndTurn,
  resetGame
} from '@backgammon/game'

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

// =============================================================================
// Server Setup
// =============================================================================

const server = new McpServer({
  name: 'backgammon',
  version: '1.0.0'
})

// =============================================================================
// Tool: Start Game
// =============================================================================

server.tool(
  'backgammon_start_game',
  'Start a new backgammon game. Initializes the board with standard starting positions, rolls dice to determine who goes first, and begins the first turn.',
  {},
  () => {
    const action = store.dispatch(performStartGame())
    const result = action.meta.result

    if (result?.ok !== true) {
      return errorResponse('Failed to start game')
    }

    const { firstPlayer, diceRoll, validMoves } = result.value
    const state = store.getState().game
    const boardText = renderFullGameState({ state })

    const movesText =
      validMoves.length > 0
        ? renderAvailableMoves({ state })
        : 'No legal moves available.'

    const text = `Game started!

${firstPlayer.charAt(0).toUpperCase() + firstPlayer.slice(1)} goes first with a roll of ${String(diceRoll.die1)}-${String(diceRoll.die2)}.

${boardText}

${movesText}

Use backgammon_make_move to move checkers, then backgammon_end_turn when done.`

    return textResponse(text)
  }
)

// =============================================================================
// Tool: Roll Dice
// =============================================================================

server.tool(
  'backgammon_roll_dice',
  "Roll the dice for the current player's turn. Use at the beginning of each turn (except the first turn after start_game where dice are already rolled).",
  {},
  () => {
    const action = store.dispatch(performRollDice())
    const result = action.meta.result

    if (!result) {
      return errorResponse('Failed to roll dice')
    }

    if (!result.ok) {
      return errorResponse(result.error.message)
    }

    const { diceRoll, turnForfeited } = result.value
    const state = store.getState().game

    if (turnForfeited) {
      const text = `Rolled ${String(diceRoll.die1)}-${String(diceRoll.die2)}. No legal moves available - turn forfeited!

${renderFullGameState({ state })}

It's now ${state.currentPlayer ?? 'unknown'}'s turn. Use backgammon_roll_dice to roll.`

      return textResponse(text)
    }

    const boardText = renderFullGameState({ state })
    const movesText = renderAvailableMoves({ state })

    const text = `Rolled ${String(diceRoll.die1)}-${String(diceRoll.die2)}${diceRoll.die1 === diceRoll.die2 ? ' (doubles!)' : ''}.

${boardText}

${movesText}`

    return textResponse(text)
  }
)

// =============================================================================
// Tool: Make Move
// =============================================================================

server.tool(
  'backgammon_make_move',
  "Make a single checker move. 'from' is the starting point (1-24) or 'bar'. 'to' is the destination (1-24) or 'off' to bear off. 'dieUsed' is which die value (1-6) you're using.",
  {
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
  ({ from, to, dieUsed }) => {
    const action = store.dispatch(performMove({ from, to, dieUsed }))
    const result = action.meta.result

    if (!result) {
      return errorResponse('Failed to make move')
    }

    if (!result.ok) {
      return errorResponse(result.error.message)
    }

    const { move, hit, gameOver, remainingMoves, validMoves } = result.value
    const state = store.getState().game
    const boardText = renderFullGameState({ state })

    let text = `Moved ${String(move.from)} -> ${String(move.to)} using ${String(move.dieUsed)}`
    if (hit) {
      text += ' (HIT!)'
    }
    text += '\n\n' + boardText

    if (gameOver) {
      text += `\n\nGame over! ${gameOver.winner} wins with a ${gameOver.victoryType}!`
      return textResponse(text)
    }

    if (remainingMoves.length > 0) {
      text += `\n\nRemaining dice: ${remainingMoves.join(', ')}`
      if (validMoves.length > 0) {
        text += '\n' + renderAvailableMoves({ state })
      } else {
        text +=
          '\nNo more legal moves. Use backgammon_end_turn to end your turn.'
      }
    } else {
      text += '\n\nAll dice used. Use backgammon_end_turn to end your turn.'
    }

    return textResponse(text)
  }
)

// =============================================================================
// Tool: End Turn
// =============================================================================

server.tool(
  'backgammon_end_turn',
  "End the current player's turn after all moves are made. Control passes to opponent who must use backgammon_roll_dice.",
  {},
  () => {
    const action = store.dispatch(performEndTurn())
    const result = action.meta.result

    if (!result) {
      return errorResponse('Failed to end turn')
    }

    if (!result.ok) {
      return errorResponse(result.error.message)
    }

    const { nextPlayer, turnNumber } = result.value
    const state = store.getState().game
    const boardText = renderFullGameState({ state })

    const text = `Turn ended.

${boardText}

It's now ${nextPlayer}'s turn (turn ${String(turnNumber)}). Use backgammon_roll_dice to roll.`

    return textResponse(text)
  }
)

// =============================================================================
// Tool: Get Game State
// =============================================================================

server.tool(
  'backgammon_get_game_state',
  'Get the current state of the game including board position, current player, dice, and available moves.',
  {},
  () => {
    const state = store.getState().game

    if (state.phase === 'not_started') {
      return errorResponse(
        'No game in progress. Use backgammon_start_game first.'
      )
    }

    const boardText = renderFullGameState({ state })

    let text = boardText

    if (state.phase === 'moving') {
      text += '\n\n' + renderAvailableMoves({ state })
    }

    return textResponse(text)
  }
)

// =============================================================================
// Tool: Reset Game
// =============================================================================

server.tool(
  'backgammon_reset_game',
  'Reset the game to its initial state. Use this to start fresh.',
  {},
  () => {
    store.dispatch(resetGame())
    return textResponse(
      'Game reset. Use backgammon_start_game to begin a new game.'
    )
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
