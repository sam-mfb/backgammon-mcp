import type React from 'react'
import type { Player, PointIndex } from '@backgammon/game'
import { Checker } from './Checker'

interface PointProps {
  pointIndex: PointIndex
  checkerCount: number
  position: 'top' | 'bottom'
  isSelected?: boolean
  isValidDestination?: boolean
  isLastMoveSource?: boolean
  isLastMoveDestination?: boolean
  onClick?: (pointIndex: PointIndex) => void
}

function getCheckerPlayer(checkerCount: number): Player | null {
  if (checkerCount > 0) return 'white'
  if (checkerCount < 0) return 'black'
  return null
}

export function Point({
  pointIndex,
  checkerCount,
  position,
  isSelected = false,
  isValidDestination = false,
  isLastMoveSource = false,
  isLastMoveDestination = false,
  onClick
}: PointProps): React.JSX.Element {
  const player = getCheckerPlayer(checkerCount)
  const count = Math.abs(checkerCount)
  const isOdd = pointIndex % 2 === 1

  const checkers = player
    ? Array.from({ length: count }, (_, i) => (
        <Checker key={i} player={player} />
      ))
    : null

  const handleClick = (): void => {
    onClick?.(pointIndex)
  }

  const classNames = [
    'point',
    `point--${position}`,
    `point--${isOdd ? 'odd' : 'even'}`,
    isSelected && 'point--selected',
    isValidDestination && 'point--valid-destination',
    isLastMoveSource && 'point--last-move-source',
    isLastMoveDestination && 'point--last-move-destination',
    onClick && 'point--clickable'
  ]
    .filter(Boolean)
    .join(' ')

  const blackPointIndex = 25 - pointIndex

  return (
    <div
      className={classNames}
      data-point={pointIndex}
      onClick={handleClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={e => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          handleClick()
        }
      }}
    >
      <div className="point__triangle" />
      <div className="point__checkers">{checkers}</div>
      <div className="point__labels">
        <span className="point__label point__label--white">{pointIndex}</span>
        <span className="point__label point__label--black">{blackPointIndex}</span>
      </div>
    </div>
  )
}
