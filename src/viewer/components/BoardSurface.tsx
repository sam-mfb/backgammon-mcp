import type { BoardState, Player, PointIndex, MoveTo } from '@/game'
import type { SelectedSource } from '../BoardView'
import { Quadrant } from './Quadrant'
import { Bar } from './Bar'
import { BorneOffArea } from './BorneOffArea'

interface BoardSurfaceProps {
  board: BoardState
  currentPlayer: Player | null
  selectedSource: SelectedSource
  validDestinations: readonly MoveTo[]
  onPointClick?: (pointIndex: PointIndex) => void
  onBarClick?: (player: Player) => void
  onBorneOffClick?: (player: Player) => void
}

export function BoardSurface({
  board,
  currentPlayer,
  selectedSource,
  validDestinations,
  onPointClick,
  onBarClick,
  onBorneOffClick,
}: BoardSurfaceProps) {
  const { points, bar, borneOff } = board

  // Determine if bearing off is a valid destination
  const canBearOff = validDestinations.includes('off')

  return (
    <div className="board-surface">
      {/* White borne-off (left side) */}
      <BorneOffArea
        player="white"
        count={borneOff.white}
        isValidDestination={canBearOff && currentPlayer === 'white'}
        onClick={onBorneOffClick}
      />

      {/* Top row: Points 13-18, Bar, Points 19-24 */}
      <div className="board-surface__row board-surface__row--top">
        <Quadrant
          startPoint={13}
          endPoint={18}
          position="top"
          points={points}
          selectedSource={selectedSource}
          validDestinations={validDestinations}
          onPointClick={onPointClick}
        />
        <Bar
          bar={bar}
          currentPlayer={currentPlayer}
          isSelected={selectedSource === 'bar'}
          onBarClick={onBarClick}
        />
        <Quadrant
          startPoint={19}
          endPoint={24}
          position="top"
          points={points}
          selectedSource={selectedSource}
          validDestinations={validDestinations}
          onPointClick={onPointClick}
        />
      </div>

      {/* Bottom row: Points 12-7, Bar placeholder, Points 6-1 */}
      <div className="board-surface__row board-surface__row--bottom">
        <Quadrant
          startPoint={12}
          endPoint={7}
          position="bottom"
          points={points}
          selectedSource={selectedSource}
          validDestinations={validDestinations}
          onPointClick={onPointClick}
        />
        <div className="bar-placeholder" />
        <Quadrant
          startPoint={6}
          endPoint={1}
          position="bottom"
          points={points}
          selectedSource={selectedSource}
          validDestinations={validDestinations}
          onPointClick={onPointClick}
        />
      </div>

      {/* Black borne-off (right side) */}
      <BorneOffArea
        player="black"
        count={borneOff.black}
        isValidDestination={canBearOff && currentPlayer === 'black'}
        onClick={onBorneOffClick}
      />
    </div>
  )
}
