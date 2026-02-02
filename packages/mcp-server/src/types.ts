/**
 * Shared type definitions for backgammon MCP server and client.
 *
 * This file provides a single source of truth for types used across
 * both the server (src/server.ts) and client (src/client/McpAppShim.tsx).
 */

import type { GameState, AvailableMoves } from '@backgammon/game'

export type PlayerControl = 'human' | 'ai'

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
}
