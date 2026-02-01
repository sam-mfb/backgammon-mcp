import type { BoardState } from '@/game'
import { Quadrant } from './Quadrant'
import { Bar } from './Bar'
import { BorneOffArea } from './BorneOffArea'

interface BoardSurfaceProps {
  board: BoardState
}

export function BoardSurface({ board }: BoardSurfaceProps) {
  const { points, bar, borneOff } = board

  return (
    <div className="board-surface">
      {/* White borne-off (left side) */}
      <BorneOffArea player="white" count={borneOff.white} />

      {/* Top row: Points 13-18, Bar, Points 19-24 */}
      <div className="board-surface__row board-surface__row--top">
        <Quadrant startPoint={13} endPoint={18} position="top" points={points} />
        <Bar bar={bar} />
        <Quadrant startPoint={19} endPoint={24} position="top" points={points} />
      </div>

      {/* Bottom row: Points 12-7, Bar placeholder, Points 6-1 */}
      <div className="board-surface__row board-surface__row--bottom">
        <Quadrant startPoint={12} endPoint={7} position="bottom" points={points} />
        <div className="bar-placeholder" />
        <Quadrant startPoint={6} endPoint={1} position="bottom" points={points} />
      </div>

      {/* Black borne-off (right side) */}
      <BorneOffArea player="black" count={borneOff.black} />
    </div>
  )
}
