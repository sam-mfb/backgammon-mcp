import type { UnknownAction } from '@reduxjs/toolkit'
import {
  startGame,
  setFirstPlayer,
  rollDice,
  makeMove,
  endTurn,
} from '@/game'

export interface DemoStep {
  action: UnknownAction
  description: string
}

export const DEMO_SEQUENCE: DemoStep[] = [
  { action: startGame(), description: 'Game started' },
  { action: setFirstPlayer('white'), description: 'White goes first' },

  // Turn 1: White rolls 3-1
  { action: rollDice({ die1: 3, die2: 1 }), description: 'White rolls 3-1' },
  { action: makeMove({ from: 8, to: 5, dieUsed: 3 }), description: 'White: 8 → 5' },
  { action: makeMove({ from: 6, to: 5, dieUsed: 1 }), description: 'White: 6 → 5' },
  { action: endTurn(), description: 'White ends turn' },

  // Turn 2: Black rolls 6-4
  { action: rollDice({ die1: 6, die2: 4 }), description: 'Black rolls 6-4' },
  { action: makeMove({ from: 1, to: 7, dieUsed: 6 }), description: 'Black: 1 → 7' },
  { action: makeMove({ from: 12, to: 16, dieUsed: 4 }), description: 'Black: 12 → 16' },
  { action: endTurn(), description: 'Black ends turn' },

  // Turn 3: White rolls 5-2
  { action: rollDice({ die1: 5, die2: 2 }), description: 'White rolls 5-2' },
  { action: makeMove({ from: 13, to: 8, dieUsed: 5 }), description: 'White: 13 → 8' },
  { action: makeMove({ from: 13, to: 11, dieUsed: 2 }), description: 'White: 13 → 11' },
  { action: endTurn(), description: 'White ends turn' },

  // Turn 4: Black rolls 3-3 (doubles)
  { action: rollDice({ die1: 3, die2: 3 }), description: 'Black rolls 3-3 (doubles!)' },
  { action: makeMove({ from: 17, to: 20, dieUsed: 3 }), description: 'Black: 17 → 20' },
  { action: makeMove({ from: 17, to: 20, dieUsed: 3 }), description: 'Black: 17 → 20' },
  { action: makeMove({ from: 17, to: 20, dieUsed: 3 }), description: 'Black: 17 → 20' },
  { action: makeMove({ from: 19, to: 22, dieUsed: 3 }), description: 'Black: 19 → 22' },
  { action: endTurn(), description: 'Black ends turn' },

  // Turn 5: White rolls 6-1
  { action: rollDice({ die1: 6, die2: 1 }), description: 'White rolls 6-1' },
  { action: makeMove({ from: 24, to: 18, dieUsed: 6 }), description: 'White: 24 → 18' },
  { action: makeMove({ from: 24, to: 23, dieUsed: 1 }), description: 'White: 24 → 23' },
  { action: endTurn(), description: 'White ends turn' },

  // Turn 6: Black rolls 5-4
  { action: rollDice({ die1: 5, die2: 4 }), description: 'Black rolls 5-4' },
  { action: makeMove({ from: 7, to: 11, dieUsed: 4 }), description: 'Black: 7 → 11 (hits white!)' },
  { action: makeMove({ from: 12, to: 17, dieUsed: 5 }), description: 'Black: 12 → 17' },
  { action: endTurn(), description: 'Black ends turn' },
]
