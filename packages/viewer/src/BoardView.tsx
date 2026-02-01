import type React from 'react'
import type { GameState, Player, PointIndex, MoveTo } from '@backgammon/game'
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
  /** Whether ending turn is allowed (according to backgammon rules) */
  canEndTurn?: boolean
  /** Valid moves available for the current player */
  validMoves?: readonly unknown[]
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
  canEndTurn: canEndTurnProp,
  validMoves,
  onPointClick,
  onBarClick,
  onBorneOffClick,
  onRollClick,
  onEndTurnClick
}: BoardViewProps): React.JSX.Element {
  const {
    board,
    currentPlayer,
    phase,
    turnNumber,
    diceRoll,
    remainingMoves,
    result
  } = gameState

  const canRoll = phase === 'rolling'
  // Use provided canEndTurn prop if available, otherwise fall back to simple phase check
  const canEndTurn = canEndTurnProp ?? phase === 'moving'
  const isGameOver = phase === 'game_over'
  const noMovesAvailable =
    phase === 'moving' &&
    remainingMoves.length > 0 &&
    (validMoves?.length ?? 0) === 0

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
        noMovesAvailable={noMovesAvailable}
        onRollClick={onRollClick}
        onEndTurnClick={onEndTurnClick}
      />
    </div>
  )
}
