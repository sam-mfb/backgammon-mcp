import type React from 'react'
import type {
  DiceRoll,
  DieValue,
  DoublingCubeState,
  GamePhase,
  GameResult,
  Player,
  Turn
} from '@backgammon/game'
import { DiceDisplay } from './DiceDisplay'

interface GameInfoProps {
  currentPlayer: Player | null
  phase: GamePhase
  turnNumber: number
  diceRoll: DiceRoll | null
  remainingMoves: readonly DieValue[]
  result: GameResult | null
  previousTurn: Turn | null
  doublingCube?: DoublingCubeState | null
}

function phaseLabel(phase: GamePhase): string {
  switch (phase) {
    case 'not_started':
      return 'Not Started'
    case 'rolling_for_first':
      return 'Rolling for First'
    case 'rolling':
      return 'Roll Dice'
    case 'doubling_proposed':
      return 'Double Proposed'
    case 'moving':
      return 'Make Moves'
    case 'game_over':
      return 'Game Over'
  }
}

function victoryLabel(result: GameResult): string {
  const parts: string[] = []

  if (result.victoryType === 'gammon') {
    parts.push('Gammon!')
  } else if (result.victoryType === 'backgammon') {
    parts.push('Backgammon!')
  }

  if (result.points > 1) {
    parts.push(`${String(result.points)} pts`)
  }

  return parts.length > 0 ? ` (${parts.join(' — ')})` : ''
}

function titleCase(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export function GameInfo({
  currentPlayer,
  phase,
  turnNumber,
  diceRoll,
  remainingMoves,
  result,
  previousTurn,
  doublingCube
}: GameInfoProps): React.JSX.Element {
  return (
    <div className="game-info">
      {result ? (
        <div className="game-info__result">
          <span
            className={`game-info__winner game-info__winner--${result.winner}`}
          >
            {titleCase(result.winner)} wins{victoryLabel(result)}
          </span>
        </div>
      ) : (
        <>
          <div className="game-info__player">
            <span className="game-info__label">Player:</span>
            <span
              className={`game-info__value game-info__value--${currentPlayer ?? 'none'}`}
            >
              {currentPlayer ? titleCase(currentPlayer) : '—'}
            </span>
          </div>
          <div className="game-info__phase">
            <span className="game-info__label">Phase:</span>
            <span className="game-info__value">{phaseLabel(phase)}</span>
          </div>
          <div className="game-info__turn">
            <span className="game-info__label">Turn:</span>
            <span className="game-info__value">{turnNumber}</span>
          </div>
          {doublingCube && (
            <div className="game-info__cube">
              <span className="game-info__label">Cube:</span>
              <span className="game-info__value">{doublingCube.value}</span>
            </div>
          )}
          <DiceDisplay
            diceRoll={diceRoll}
            remainingMoves={remainingMoves}
            previousTurn={previousTurn}
          />
        </>
      )}
    </div>
  )
}
