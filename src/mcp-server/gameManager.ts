/**
 * Game Manager - Server-side game state management
 *
 * Singleton that holds the current game state and provides methods
 * to manipulate it. Uses the rules engine for validation.
 */

import type {
  BoardState,
  DiceRoll,
  DieValue,
  GameResult,
  GameState,
  Move,
  MoveFrom,
  MoveTo,
  Player,
  PointIndex,
  Turn,
} from '../game/types'

import {
  checkGameOver,
  createInitialBoard,
  getRequiredMoves,
  getValidMoves,
  hasAnyLegalMoves,
  isValidMove,
} from '../game/rules'

// =============================================================================
// Types
// =============================================================================

type GameManagerResult<T> =
  | { success: true; data: T }
  | { success: false; error: string }

interface RollDiceResult {
  diceRoll: DiceRoll
  validMoves: ReturnType<typeof getValidMoves>
  turnForfeited: boolean
}

interface MakeMoveInput {
  from: number | 'bar'
  to: number | 'off'
  dieUsed: number
}

// =============================================================================
// Helper Functions
// =============================================================================

function rollDie(): DieValue {
  return (Math.floor(Math.random() * 6) + 1) as DieValue
}

function createDiceRoll(): DiceRoll {
  return {
    die1: rollDie(),
    die2: rollDie(),
  }
}

function getRemainingMovesFromDice(diceRoll: DiceRoll): DieValue[] {
  if (diceRoll.die1 === diceRoll.die2) {
    // Doubles: 4 moves
    return [diceRoll.die1, diceRoll.die1, diceRoll.die1, diceRoll.die1]
  }
  return [diceRoll.die1, diceRoll.die2]
}

function getOpponent(player: Player): Player {
  return player === 'white' ? 'black' : 'white'
}

type MutablePoints = [
  number, number, number, number, number, number,
  number, number, number, number, number, number,
  number, number, number, number, number, number,
  number, number, number, number, number, number,
]

function applyMoveToBoard({
  board,
  move,
  player,
}: {
  board: BoardState
  move: Move
  player: Player
}): BoardState {
  const { from, to } = move

  // Create mutable copies
  const newPoints: MutablePoints = [...board.points] as MutablePoints
  const newBar = { ...board.bar }
  const newBorneOff = { ...board.borneOff }

  // Remove checker from source
  if (from === 'bar') {
    newBar[player]--
  } else {
    const fromIndex = from - 1
    if (player === 'white') {
      newPoints[fromIndex]--
    } else {
      newPoints[fromIndex]++
    }
  }

  // Place checker at destination
  if (to === 'off') {
    newBorneOff[player]++
  } else {
    const toIndex = to - 1
    const pointValue = newPoints[toIndex]

    // Check for hitting a blot
    if (player === 'white' && pointValue === -1) {
      newPoints[toIndex] = 1
      newBar.black++
    } else if (player === 'black' && pointValue === 1) {
      newPoints[toIndex] = -1
      newBar.white++
    } else {
      if (player === 'white') {
        newPoints[toIndex]++
      } else {
        newPoints[toIndex]--
      }
    }
  }

  return {
    points: newPoints,
    bar: newBar,
    borneOff: newBorneOff,
  }
}

function isValidPointIndex(n: number): n is PointIndex {
  return Number.isInteger(n) && n >= 1 && n <= 24
}

function isValidDieValue(n: number): n is DieValue {
  return Number.isInteger(n) && n >= 1 && n <= 6
}

// =============================================================================
// Game Manager
// =============================================================================

function createGameManager() {
  let gameState: GameState | null = null

  function getState(): GameManagerResult<GameState> {
    if (!gameState) {
      return { success: false, error: 'No game in progress. Use startGame first.' }
    }
    return { success: true, data: gameState }
  }

  function startGame({ humanColor }: { humanColor?: Player } = {}): GameManagerResult<{
    state: GameState
    firstPlayer: Player
    diceRoll: DiceRoll
  }> {
    // Roll for first player
    let die1 = rollDie()
    let die2 = rollDie()

    // Re-roll if tied
    while (die1 === die2) {
      die1 = rollDie()
      die2 = rollDie()
    }

    // Higher die goes first (white uses die1, black uses die2 in the opening roll)
    const firstPlayer: Player = die1 > die2 ? 'white' : 'black'
    const diceRoll: DiceRoll =
      firstPlayer === 'white'
        ? { die1, die2 }
        : { die1: die2, die2: die1 }

    const initialBoard = createInitialBoard()

    const initialState: GameState = {
      board: initialBoard,
      currentPlayer: firstPlayer,
      phase: 'moving',
      diceRoll,
      remainingMoves: getRemainingMovesFromDice(diceRoll),
      turnNumber: 1,
      movesThisTurn: [],
      result: null,
      history: [],
      availableMoves: null,
    }

    // Compute available moves
    const availableMoves = getValidMoves({ state: initialState })

    gameState = {
      ...initialState,
      availableMoves,
    }

    return {
      success: true,
      data: {
        state: gameState,
        firstPlayer,
        diceRoll,
      },
    }
  }

  function rollDice(): GameManagerResult<RollDiceResult> {
    if (!gameState) {
      return { success: false, error: 'No game in progress. Use startGame first.' }
    }

    if (gameState.phase === 'game_over') {
      return { success: false, error: 'Game is already over.' }
    }

    if (gameState.phase !== 'rolling') {
      return {
        success: false,
        error: `Cannot roll dice in ${gameState.phase} phase. Current phase requires: ${
          gameState.phase === 'moving' ? 'making moves or ending turn' : 'starting a game'
        }`,
      }
    }

    const diceRoll = createDiceRoll()
    const remainingMoves = getRemainingMovesFromDice(diceRoll)

    const newState: GameState = {
      ...gameState,
      phase: 'moving',
      diceRoll,
      remainingMoves,
      movesThisTurn: [],
      availableMoves: null,
    }

    // Check if player has any legal moves
    const validMoves = getValidMoves({ state: newState })
    const turnForfeited = validMoves.length === 0

    if (turnForfeited) {
      // Auto-forfeit turn - switch to opponent's rolling phase
      const opponent = getOpponent(gameState.currentPlayer!)

      gameState = {
        ...newState,
        currentPlayer: opponent,
        phase: 'rolling',
        diceRoll: null,
        remainingMoves: [],
        movesThisTurn: [],
        turnNumber: gameState.turnNumber + 1,
        availableMoves: null,
        history: [
          ...gameState.history,
          {
            player: gameState.currentPlayer!,
            diceRoll,
            moves: [],
          },
        ],
      }
    } else {
      gameState = {
        ...newState,
        availableMoves: validMoves,
      }
    }

    return {
      success: true,
      data: {
        diceRoll,
        validMoves,
        turnForfeited,
      },
    }
  }

  function makeMove(input: MakeMoveInput): GameManagerResult<{
    move: Move
    hit: boolean
    gameOver: GameResult | null
    remainingMoves: DieValue[]
    validMoves: ReturnType<typeof getValidMoves>
  }> {
    if (!gameState) {
      return { success: false, error: 'No game in progress. Use startGame first.' }
    }

    if (gameState.phase !== 'moving') {
      return {
        success: false,
        error: `Cannot make move in ${gameState.phase} phase. ${
          gameState.phase === 'rolling' ? 'Roll dice first.' : ''
        }`,
      }
    }

    // Validate input types
    const from: MoveFrom =
      input.from === 'bar'
        ? 'bar'
        : isValidPointIndex(input.from)
          ? (input.from as PointIndex)
          : (null as never)

    const to: MoveTo =
      input.to === 'off'
        ? 'off'
        : isValidPointIndex(input.to)
          ? (input.to as PointIndex)
          : (null as never)

    if (input.from !== 'bar' && !isValidPointIndex(input.from)) {
      return {
        success: false,
        error: `Invalid 'from' value: ${input.from}. Must be 'bar' or a number 1-24.`,
      }
    }

    if (input.to !== 'off' && !isValidPointIndex(input.to)) {
      return {
        success: false,
        error: `Invalid 'to' value: ${input.to}. Must be 'off' or a number 1-24.`,
      }
    }

    if (!isValidDieValue(input.dieUsed)) {
      return {
        success: false,
        error: `Invalid 'dieUsed' value: ${input.dieUsed}. Must be 1-6.`,
      }
    }

    const move: Move = {
      from,
      to,
      dieUsed: input.dieUsed,
    }

    // Validate the move using rules engine
    if (!isValidMove({ state: gameState, move })) {
      // Provide helpful error message
      const validMoves = getValidMoves({ state: gameState })
      const validMovesStr = validMoves
        .flatMap((vm) =>
          vm.destinations.map(
            (d) => `${vm.from} -> ${d.to} (die: ${d.dieValue})`
          )
        )
        .join(', ')

      return {
        success: false,
        error: `Invalid move: ${from} -> ${to} with die ${input.dieUsed}. Valid moves: ${validMovesStr || 'none'}`,
      }
    }

    // Check for must-play rules
    const requirements = getRequiredMoves({ state: gameState })
    if (requirements.requiredDie && move.dieUsed !== requirements.requiredDie) {
      return {
        success: false,
        error: `Must play the ${requirements.requiredDie} (${
          requirements.mustPlayHigherDie ? 'higher die rule' : 'only legal die'
        }).`,
      }
    }

    // Apply the move
    const player = gameState.currentPlayer!
    const newBoard = applyMoveToBoard({ board: gameState.board, move, player })

    // Check if this was a hit
    const hit =
      to !== 'off' &&
      ((player === 'white' && gameState.board.points[to - 1] === -1) ||
        (player === 'black' && gameState.board.points[to - 1] === 1))

    // Update remaining moves
    const newRemainingMoves = [...gameState.remainingMoves]
    const dieIndex = newRemainingMoves.indexOf(move.dieUsed)
    if (dieIndex !== -1) {
      newRemainingMoves.splice(dieIndex, 1)
    }

    const newState: GameState = {
      ...gameState,
      board: newBoard,
      remainingMoves: newRemainingMoves,
      movesThisTurn: [...gameState.movesThisTurn, move],
      availableMoves: null,
    }

    // Check for game over
    const gameOver = checkGameOver({ state: newState })

    if (gameOver) {
      gameState = {
        ...newState,
        phase: 'game_over',
        result: gameOver,
        availableMoves: null,
      }

      return {
        success: true,
        data: {
          move,
          hit,
          gameOver,
          remainingMoves: [],
          validMoves: [],
        },
      }
    }

    // Compute new valid moves
    const validMoves = getValidMoves({ state: newState })

    // If no more moves available, stay in moving phase but with empty valid moves
    gameState = {
      ...newState,
      availableMoves: validMoves,
    }

    return {
      success: true,
      data: {
        move,
        hit,
        gameOver: null,
        remainingMoves: newRemainingMoves,
        validMoves,
      },
    }
  }

  function endTurn(): GameManagerResult<{
    nextPlayer: Player
    turnNumber: number
  }> {
    if (!gameState) {
      return { success: false, error: 'No game in progress. Use startGame first.' }
    }

    if (gameState.phase === 'game_over') {
      return { success: false, error: 'Game is already over.' }
    }

    if (gameState.phase !== 'moving') {
      return {
        success: false,
        error: `Cannot end turn in ${gameState.phase} phase.`,
      }
    }

    // Check if player still has legal moves they must play
    const validMoves = getValidMoves({ state: gameState })
    if (validMoves.length > 0 && gameState.remainingMoves.length > 0) {
      return {
        success: false,
        error: 'You still have legal moves available. You must play all possible dice.',
      }
    }

    const currentPlayer = gameState.currentPlayer!
    const nextPlayer = getOpponent(currentPlayer)

    // Record the completed turn in history
    const completedTurn: Turn = {
      player: currentPlayer,
      diceRoll: gameState.diceRoll!,
      moves: [...gameState.movesThisTurn],
    }

    gameState = {
      ...gameState,
      currentPlayer: nextPlayer,
      phase: 'rolling',
      diceRoll: null,
      remainingMoves: [],
      movesThisTurn: [],
      turnNumber: gameState.turnNumber + 1,
      availableMoves: null,
      history: [...gameState.history, completedTurn],
    }

    return {
      success: true,
      data: {
        nextPlayer,
        turnNumber: gameState.turnNumber,
      },
    }
  }

  function resetGame(): void {
    gameState = null
  }

  return {
    getState,
    startGame,
    rollDice,
    makeMove,
    endTurn,
    resetGame,
  }
}

// Export singleton instance
export const gameManager = createGameManager()

// Export types for tools
export type { GameManagerResult, MakeMoveInput, RollDiceResult }
