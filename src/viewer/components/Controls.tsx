interface ControlsProps {
  canRoll: boolean
  canEndTurn: boolean
  isGameOver: boolean
  onRollClick?: () => void
  onEndTurnClick?: () => void
}

export function Controls({
  canRoll,
  canEndTurn,
  isGameOver,
  onRollClick,
  onEndTurnClick,
}: ControlsProps) {
  if (isGameOver) {
    return (
      <div className="controls">
        <span className="controls__message">Game Over</span>
      </div>
    )
  }

  return (
    <div className="controls">
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
