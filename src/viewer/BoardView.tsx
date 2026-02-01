import type { GameState, Player, PointIndex, MoveTo } from '@/game'
import { GameInfo } from './components/GameInfo'
import { BoardSurface } from './components/BoardSurface'
import { Controls } from './components/Controls'
import './BoardView.css'

/** Source position for a selected checker */
export type SelectedSource = PointIndex | 'bar' | null

interface BoardViewProps {
  gameState: GameState
  /** Currently selected source position */
  selectedSource?: SelectedSource
  /** Valid destinations for the selected checker */
  validDestinations?: readonly MoveTo[]
  /** Callback when a point is clicked */
  onPointClick?: (pointIndex: PointIndex) => void
  /** Callback when the bar is clicked for a player */
  onBarClick?: (player: Player) => void
  /** Callback when a borne-off area is clicked */
  onBorneOffClick?: (player: Player) => void
  /** Callback when the roll dice button is clicked */
  onRollClick?: () => void
  /** Callback when the end turn button is clicked */
  onEndTurnClick?: () => void
}

export function BoardView({
  gameState,
  selectedSource = null,
  validDestinations = [],
  onPointClick,
  onBarClick,
  onBorneOffClick,
  onRollClick,
  onEndTurnClick,
}: BoardViewProps) {
  const {
    board,
    currentPlayer,
    phase,
    turnNumber,
    diceRoll,
    remainingMoves,
    result,
  } = gameState

  const canRoll = phase === 'rolling'
  const canEndTurn = phase === 'moving'
  const isGameOver = phase === 'game_over'

  return (
    <div className="board-view">
      <GameInfo
        currentPlayer={currentPlayer}
        phase={phase}
        turnNumber={turnNumber}
        diceRoll={diceRoll}
        remainingMoves={remainingMoves}
        result={result}
      />
      <BoardSurface
        board={board}
        currentPlayer={currentPlayer}
        selectedSource={selectedSource}
        validDestinations={validDestinations}
        onPointClick={onPointClick}
        onBarClick={onBarClick}
        onBorneOffClick={onBorneOffClick}
      />
      <Controls
        canRoll={canRoll}
        canEndTurn={canEndTurn}
        isGameOver={isGameOver}
        onRollClick={onRollClick}
        onEndTurnClick={onEndTurnClick}
      />
    </div>
  )
}
