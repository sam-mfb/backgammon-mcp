import type { Player } from '@backgammon/game'
import { Checker } from './Checker'

interface BorneOffAreaProps {
  player: Player
  count: number
  isValidDestination?: boolean
  onClick?: (player: Player) => void
}

export function BorneOffArea({
  player,
  count,
  isValidDestination = false,
  onClick,
}: BorneOffAreaProps) {
  const checkers = Array.from({ length: count }, (_, i) => (
    <Checker key={i} player={player} />
  ))

  const handleClick = () => {
    onClick?.(player)
  }

  const isClickable = isValidDestination && onClick

  const classNames = [
    'borne-off',
    `borne-off--${player}`,
    isValidDestination && 'borne-off--valid-destination',
    isClickable && 'borne-off--clickable',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      className={classNames}
      onClick={isClickable ? handleClick : undefined}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={(e) => {
        if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
          handleClick()
        }
      }}
    >
      <div className="borne-off__label">{player}</div>
      <div className="borne-off__checkers">{checkers}</div>
      <div className="borne-off__count">{count}</div>
    </div>
  )
}
