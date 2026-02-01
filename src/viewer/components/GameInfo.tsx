import type { DiceRoll, DieValue, GamePhase, GameResult, Player } from '@/game'
import { DiceDisplay } from './DiceDisplay'

interface GameInfoProps {
  currentPlayer: Player | null
  phase: GamePhase
  turnNumber: number
  diceRoll: DiceRoll | null
  remainingMoves: readonly DieValue[]
  result: GameResult | null
}

function phaseLabel(phase: GamePhase): string {
  switch (phase) {
    case 'not_started': return 'Not Started'
    case 'rolling_for_first': return 'Rolling for First'
    case 'rolling': return 'Roll Dice'
    case 'moving': return 'Make Moves'
    case 'game_over': return 'Game Over'
  }
}

function victoryLabel(victoryType: GameResult['victoryType']): string {
  switch (victoryType) {
    case 'single': return ''
    case 'gammon': return ' (Gammon!)'
    case 'backgammon': return ' (Backgammon!)'
  }
}

export function GameInfo({
  currentPlayer,
  phase,
  turnNumber,
  diceRoll,
  remainingMoves,
  result,
}: GameInfoProps) {
  return (
    <div className="game-info">
      {result ? (
        <div className="game-info__result">
          <span className={`game-info__winner game-info__winner--${result.winner}`}>
            {result.winner} wins{victoryLabel(result.victoryType)}
          </span>
        </div>
      ) : (
        <>
          <div className="game-info__player">
            <span className="game-info__label">Player:</span>
            <span className={`game-info__value game-info__value--${currentPlayer ?? 'none'}`}>
              {currentPlayer ?? '—'}
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
          <DiceDisplay diceRoll={diceRoll} remainingMoves={remainingMoves} />
        </>
      )}
    </div>
  )
}
