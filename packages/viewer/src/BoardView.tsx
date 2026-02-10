import type React from 'react'
import type {
  GameState,
  GameAction,
  Player,
  PointIndex,
  MoveTo,
  Turn
} from '@backgammon/game'
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
  /** Last action for highlighting (optional) */
  lastAction?: GameAction | null
  /** Which player(s) the UI controls. 'white', 'black', 'both', or null (spectator mode) */
  humanControlled?: Player | 'both' | null
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
  /** Whether undo is available (moves have been made this turn) */
  canUndo?: boolean
  /** Callback when the undo button is clicked */
  onUndoClick?: () => void
}

export function BoardView({
  gameState,
  selectedSource = null,
  validDestinations = [],
  canEndTurn: canEndTurnProp,
  validMoves,
  lastAction,
  humanControlled,
  onPointClick,
  onBarClick,
  onBorneOffClick,
  onRollClick,
  onEndTurnClick,
  canUndo: canUndoProp,
  onUndoClick
}: BoardViewProps): React.JSX.Element {
  const {
    board,
    currentPlayer,
    phase,
    turnNumber,
    diceRoll,
    remainingMoves,
    result,
    history
  } = gameState

  const canRoll = phase === 'rolling'
  // Use provided canEndTurn prop if available, otherwise fall back to simple phase check
  const canEndTurn = canEndTurnProp ?? phase === 'moving'
  const isGameOver = phase === 'game_over'
  const noMovesAvailable =
    phase === 'moving' &&
    remainingMoves.length > 0 &&
    (validMoves?.length ?? 0) === 0

  // Get the last completed turn for showing previous dice and move highlights
  const previousTurn: Turn | null =
    history.length > 0 ? history[history.length - 1] : null

  // Determine if it's a human's turn (for AI control)
  // undefined means backward-compatible mode (all interactions enabled)
  const isHumanTurn =
    humanControlled === undefined ||
    humanControlled === 'both' ||
    humanControlled === currentPlayer

  return (
    <div className="board-view">
      <GameInfo
        currentPlayer={currentPlayer}
        phase={phase}
        turnNumber={turnNumber}
        diceRoll={diceRoll}
        remainingMoves={remainingMoves}
        result={result}
        previousTurn={previousTurn}
      />
      <BoardSurface
        board={board}
        currentPlayer={currentPlayer}
        selectedSource={selectedSource}
        validDestinations={validDestinations}
        lastAction={lastAction}
        previousTurn={previousTurn}
        onPointClick={isHumanTurn ? onPointClick : undefined}
        onBarClick={isHumanTurn ? onBarClick : undefined}
        onBorneOffClick={isHumanTurn ? onBorneOffClick : undefined}
      />
      <Controls
        canRoll={canRoll}
        canEndTurn={canEndTurn}
        isGameOver={isGameOver}
        noMovesAvailable={noMovesAvailable}
        disabled={!isHumanTurn}
        canUndo={canUndoProp ?? false}
        onRollClick={onRollClick}
        onEndTurnClick={onEndTurnClick}
        onUndoClick={onUndoClick}
      />
    </div>
  )
}
