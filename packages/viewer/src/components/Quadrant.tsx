import type React from 'react'
import type { BoardState, PointIndex, MoveTo } from '@backgammon/game'
import type { SelectedSource } from '../BoardView'
import { Point } from './Point'

interface QuadrantProps {
  startPoint: PointIndex
  endPoint: PointIndex
  position: 'top' | 'bottom'
  points: BoardState['points']
  selectedSource: SelectedSource
  validDestinations: readonly MoveTo[]
  onPointClick?: (pointIndex: PointIndex) => void
}

export function Quadrant({
  startPoint,
  endPoint,
  position,
  points,
  selectedSource,
  validDestinations,
  onPointClick
}: QuadrantProps): React.JSX.Element {
  const step = startPoint < endPoint ? 1 : -1
  const pointIndices: number[] = []

  for (
    let i = startPoint as number;
    step > 0 ? i <= endPoint : i >= endPoint;
    i += step
  ) {
    pointIndices.push(i)
  }

  return (
    <div className={`quadrant quadrant--${position}`}>
      {pointIndices.map(pointIndex => (
        <Point
          key={pointIndex}
          pointIndex={pointIndex as PointIndex}
          checkerCount={points[pointIndex - 1]}
          position={position}
          isSelected={selectedSource === pointIndex}
          isValidDestination={validDestinations.includes(pointIndex as PointIndex)}
          onClick={onPointClick}
        />
      ))}
    </div>
  )
}
