import type { GameState } from '@/game'
import { GameInfo } from './components/GameInfo'
import { BoardSurface } from './components/BoardSurface'
import './BoardView.css'

interface BoardViewProps {
  gameState: GameState
}

export function BoardView({ gameState }: BoardViewProps) {
  const {
    board,
    currentPlayer,
    phase,
    turnNumber,
    diceRoll,
    remainingMoves,
  } = gameState

  return (
    <div className="board-view">
      <GameInfo
        currentPlayer={currentPlayer}
        phase={phase}
        turnNumber={turnNumber}
        diceRoll={diceRoll}
        remainingMoves={remainingMoves}
      />
      <BoardSurface board={board} />
    </div>
  )
}
