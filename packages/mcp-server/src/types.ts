/**
 * Shared type definitions for backgammon MCP server and client.
 *
 * This file provides a single source of truth for types used across
 * both the server (src/server.ts) and client (src/client/McpAppShim.tsx).
 */

import type { GameState, AvailableMoves, Move, Player, MatchState } from '@backgammon/game'

export type PlayerControl = 'human' | 'ai'

/**
 * Summary of a completed turn for model context updates.
 * Used when view_end_turn informs the model of the user's complete turn.
 */
export interface TurnSummary {
  readonly player: Player
  readonly diceRoll: { die1: number; die2: number }
  readonly moves: readonly (Move & { hit: boolean })[]
  readonly boardSummary: {
    readonly whiteHome: number
    readonly blackHome: number
    readonly whiteBar: number
    readonly blackBar: number
  }
  readonly nextPlayer: Player
}

export interface GameConfig {
  readonly whiteControl: PlayerControl
  readonly blackControl: PlayerControl
}

/**
 * Structured content returned by game tools for UI rendering.
 * Contains the full game state and available moves for the current position.
 *
 * The index signature is required by the MCP SDK's structuredContent type.
 */
export interface BackgammonStructuredContent {
  [key: string]: unknown
  gameState: GameState
  validMoves?: readonly AvailableMoves[]
  config?: GameConfig
  turnSummary?: string
  matchState?: MatchState | null
}
