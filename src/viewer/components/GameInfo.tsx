import type { DiceRoll, DieValue, GamePhase, Player } from '@/game'
import { DiceDisplay } from './DiceDisplay'

interface GameInfoProps {
  currentPlayer: Player | null
  phase: GamePhase
  turnNumber: number
  diceRoll: DiceRoll | null
  remainingMoves: readonly DieValue[]
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

export function GameInfo({
  currentPlayer,
  phase,
  turnNumber,
  diceRoll,
  remainingMoves,
}: GameInfoProps) {
  return (
    <div className="game-info">
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
    </div>
  )
}
