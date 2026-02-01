import type { Player, PointIndex } from '@/game'
import { Checker } from './Checker'

interface PointProps {
  pointIndex: PointIndex
  checkerCount: number
  position: 'top' | 'bottom'
}

function getCheckerPlayer(checkerCount: number): Player | null {
  if (checkerCount > 0) return 'white'
  if (checkerCount < 0) return 'black'
  return null
}

export function Point({ pointIndex, checkerCount, position }: PointProps) {
  const player = getCheckerPlayer(checkerCount)
  const count = Math.abs(checkerCount)
  const isOdd = pointIndex % 2 === 1

  const checkers = player
    ? Array.from({ length: count }, (_, i) => (
        <Checker key={i} player={player} />
      ))
    : null

  return (
    <div
      className={`point point--${position} point--${isOdd ? 'odd' : 'even'}`}
      data-point={pointIndex}
    >
      <div className="point__triangle" />
      <div className="point__checkers">{checkers}</div>
      <span className="point__label">{pointIndex}</span>
    </div>
  )
}
