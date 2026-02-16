import type React from 'react'
import type { CubeOwner, CubeValue } from '@backgammon/game'

interface DoublingCubeProps {
  value: CubeValue
  owner: CubeOwner
  canDouble: boolean
  onClick?: () => void
}

export function DoublingCube({
  value,
  owner,
  canDouble,
  onClick
}: DoublingCubeProps): React.JSX.Element {
  const positionClass =
    owner === 'centered'
      ? 'doubling-cube--centered'
      : owner === 'white'
        ? 'doubling-cube--white'
        : 'doubling-cube--black'

  return (
    <div
      className={`doubling-cube ${positionClass}${canDouble ? ' doubling-cube--clickable' : ''}`}
      onClick={canDouble ? onClick : undefined}
      onKeyDown={
        canDouble
          ? (e: React.KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onClick?.()
              }
            }
          : undefined
      }
      role={canDouble ? 'button' : undefined}
      tabIndex={canDouble ? 0 : undefined}
      aria-label={`Doubling cube: ${String(value)}${canDouble ? ' (click to double)' : ''}`}
    >
      <span className="doubling-cube__value">{value}</span>
    </div>
  )
}
