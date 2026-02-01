import type React from 'react'

interface ControlsProps {
  canRoll: boolean
  canEndTurn: boolean
  isGameOver: boolean
  noMovesAvailable?: boolean
  onRollClick?: () => void
  onEndTurnClick?: () => void
}

export function Controls({
  canRoll,
  canEndTurn,
  isGameOver,
  noMovesAvailable = false,
  onRollClick,
  onEndTurnClick
}: ControlsProps): React.JSX.Element {
  if (isGameOver) {
    return (
      <div className="controls">
        <span className="controls__message">Game Over</span>
      </div>
    )
  }

  return (
    <div className="controls">
      {noMovesAvailable && (
        <span className="controls__message">No moves available</span>
      )}
      <button
        className="controls__button controls__button--roll"
        disabled={!canRoll}
        onClick={onRollClick}
      >
        Roll Dice
      </button>
      <button
        className="controls__button controls__button--end-turn"
        disabled={!canEndTurn}
        onClick={onEndTurnClick}
      >
        End Turn
      </button>
    </div>
  )
}
