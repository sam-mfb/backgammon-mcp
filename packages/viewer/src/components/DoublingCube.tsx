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
  const ownerClass =
    owner === 'centered'
      ? 'doubling-cube--centered'
      : owner === 'white'
        ? 'doubling-cube--owner-white'
        : 'doubling-cube--owner-black'

  const ownerLabel =
    owner === 'centered' ? null : owner === 'white' ? 'W' : 'B'

  return (
    <div
      className={`doubling-cube ${ownerClass}${canDouble ? ' doubling-cube--clickable' : ''}`}
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
      aria-label={`Doubling cube: ${String(value)}, ${owner === 'centered' ? 'centered' : `owned by ${owner}`}${canDouble ? ' (click to double)' : ''}`}
    >
      <span className="doubling-cube__value">{value}</span>
      {ownerLabel && (
        <span className={`doubling-cube__owner doubling-cube__owner--${owner}`}>
          {ownerLabel}
        </span>
      )}
    </div>
  )
}
