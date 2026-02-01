/**
 * ASCII Board Renderer
 *
 * Renders the game state as ASCII text for display in text-only contexts.
 */

import type { GameState } from '@backgammon/game'
import { getValidMoves } from '@backgammon/game'

// =============================================================================
// Constants
// =============================================================================

const WHITE_CHECKER = 'O'
const BLACK_CHECKER = 'X'
const EMPTY = '.'
const MAX_VISIBLE_CHECKERS = 5

// =============================================================================
// Helper Functions
// =============================================================================

function getCheckerChar(value: number): string {
  if (value > 0) return WHITE_CHECKER
  if (value < 0) return BLACK_CHECKER
  return EMPTY
}

function formatPointNumber(n: number): string {
  return n.toString().padStart(2, ' ')
}

function formatOverflowCount(count: number): string {
  // Keep single character width to maintain board alignment
  if (count >= 10) return '+'
  return count.toString()
}

function formatCheckerStack(value: number, row: number): string {
  const absValue = Math.abs(value)
  if (row < absValue && row < MAX_VISIBLE_CHECKERS) {
    return getCheckerChar(value)
  }
  if (row === MAX_VISIBLE_CHECKERS - 1 && absValue > MAX_VISIBLE_CHECKERS) {
    // Show count for overflow (single char to maintain alignment)
    return formatOverflowCount(absValue)
  }
  return ' '
}

// =============================================================================
// Main Renderer
// =============================================================================

export function renderAsciiBoard({ state }: { state: GameState }): string {
  const { board } = state
  const lines: string[] = []

  // Top point numbers (13-24)
  const topPointNumbers = Array.from({ length: 12 }, (_, i) => formatPointNumber(13 + i))
  lines.push(`    ${topPointNumbers.slice(0, 6).join(' ')}   BAR   ${topPointNumbers.slice(6).join(' ')}`)

  // Top separator
  lines.push('   +' + '-'.repeat(17) + '+-----+' + '-'.repeat(17) + '+')

  // Top half of board (points 13-24, shown from top)
  // These show black's home quadrant on the right, white's on the left (from white's perspective)
  for (let row = 0; row < MAX_VISIBLE_CHECKERS; row++) {
    const leftQuadrant = []
    const rightQuadrant = []

    // Points 13-18 (left quadrant, top half)
    for (let point = 13; point <= 18; point++) {
      const value = board.points[point - 1]
      leftQuadrant.push(formatCheckerStack(value, row))
    }

    // Points 19-24 (right quadrant, top half - black's home)
    for (let point = 19; point <= 24; point++) {
      const value = board.points[point - 1]
      rightQuadrant.push(formatCheckerStack(value, row))
    }

    // Bar (show black's bar checkers on top half)
    const barChar = row < board.bar.black && row < MAX_VISIBLE_CHECKERS
      ? BLACK_CHECKER
      : (row === MAX_VISIBLE_CHECKERS - 1 && board.bar.black > MAX_VISIBLE_CHECKERS
        ? formatOverflowCount(board.bar.black)
        : ' ')

    lines.push(`   | ${leftQuadrant.join('  ')} | ${barChar} | ${rightQuadrant.join('  ')} |`)
  }

  // Middle separator
  lines.push('   |' + '-'.repeat(17) + '+-----+' + '-'.repeat(17) + '|')

  // Bottom half of board (points 12-1, shown from bottom up)
  for (let row = MAX_VISIBLE_CHECKERS - 1; row >= 0; row--) {
    const leftQuadrant = []
    const rightQuadrant = []

    // Points 12-7 (left quadrant, bottom half)
    for (let point = 12; point >= 7; point--) {
      const value = board.points[point - 1]
      leftQuadrant.push(formatCheckerStack(value, row))
    }

    // Points 6-1 (right quadrant, bottom half - white's home)
    for (let point = 6; point >= 1; point--) {
      const value = board.points[point - 1]
      rightQuadrant.push(formatCheckerStack(value, row))
    }

    // Bar (show white's bar checkers on bottom half)
    const barChar = row < board.bar.white && row < MAX_VISIBLE_CHECKERS
      ? WHITE_CHECKER
      : (row === MAX_VISIBLE_CHECKERS - 1 && board.bar.white > MAX_VISIBLE_CHECKERS
        ? formatOverflowCount(board.bar.white)
        : ' ')

    lines.push(`   | ${leftQuadrant.join('  ')} | ${barChar} | ${rightQuadrant.join('  ')} |`)
  }

  // Bottom separator
  lines.push('   +' + '-'.repeat(17) + '+-----+' + '-'.repeat(17) + '+')

  // Bottom point numbers (12-1)
  const bottomPointNumbers = Array.from({ length: 12 }, (_, i) => formatPointNumber(12 - i))
  lines.push(`    ${bottomPointNumbers.slice(0, 6).join(' ')}   BAR   ${bottomPointNumbers.slice(6).join(' ')}`)

  // Borne off area
  lines.push('')
  lines.push(`   Borne off: White: ${board.borneOff.white}  Black: ${board.borneOff.black}`)

  return lines.join('\n')
}

/**
 * Render a summary of the current game state
 */
export function renderGameSummary({ state }: { state: GameState }): string {
  const lines: string[] = []

  lines.push(`Turn ${state.turnNumber}`)
  lines.push(`Current player: ${state.currentPlayer ?? 'none'}`)
  lines.push(`Phase: ${state.phase}`)

  if (state.diceRoll) {
    lines.push(`Dice: ${state.diceRoll.die1}-${state.diceRoll.die2}`)
    if (state.remainingMoves.length > 0) {
      lines.push(`Remaining moves: ${state.remainingMoves.join(', ')}`)
    }
  }

  if (state.movesThisTurn.length > 0) {
    const movesStr = state.movesThisTurn
      .map((m) => `${m.from}->${m.to}`)
      .join(', ')
    lines.push(`Moves this turn: ${movesStr}`)
  }

  if (state.result) {
    lines.push(`Game over! ${state.result.winner} wins with a ${state.result.victoryType}!`)
  }

  return lines.join('\n')
}

/**
 * Render the full game state (board + summary)
 */
export function renderFullGameState({ state }: { state: GameState }): string {
  return renderAsciiBoard({ state }) + '\n\n' + renderGameSummary({ state })
}

/**
 * Render available moves in a readable format
 */
export function renderAvailableMoves({ state }: { state: GameState }): string {
  const availableMoves = getValidMoves({ state })

  if (!availableMoves || availableMoves.length === 0) {
    return 'No legal moves available.'
  }

  const lines: string[] = ['Available moves:']

  for (const am of availableMoves) {
    for (const dest of am.destinations) {
      const hitIndicator = dest.wouldHit ? ' (hit!)' : ''
      lines.push(`  ${am.from} -> ${dest.to} using ${dest.dieValue}${hitIndicator}`)
    }
  }

  return lines.join('\n')
}
