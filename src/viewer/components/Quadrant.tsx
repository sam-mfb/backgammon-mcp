import type { BoardState, PointIndex } from '@/game'
import { Point } from './Point'

interface QuadrantProps {
  startPoint: PointIndex
  endPoint: PointIndex
  position: 'top' | 'bottom'
  points: BoardState['points']
}

export function Quadrant({ startPoint, endPoint, position, points }: QuadrantProps) {
  const step = startPoint < endPoint ? 1 : -1
  const pointIndices: PointIndex[] = []

  for (let i = startPoint; step > 0 ? i <= endPoint : i >= endPoint; i += step) {
    pointIndices.push(i as PointIndex)
  }

  return (
    <div className={`quadrant quadrant--${position}`}>
      {pointIndices.map((pointIndex) => (
        <Point
          key={pointIndex}
          pointIndex={pointIndex}
          checkerCount={points[pointIndex - 1]}
          position={position}
        />
      ))}
    </div>
  )
}
