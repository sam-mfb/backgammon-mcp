import type { Player } from '@/game'
import { Checker } from './Checker'

interface BorneOffAreaProps {
  player: Player
  count: number
}

export function BorneOffArea({ player, count }: BorneOffAreaProps) {
  const checkers = Array.from({ length: count }, (_, i) => (
    <Checker key={i} player={player} />
  ))

  return (
    <div className={`borne-off borne-off--${player}`}>
      <div className="borne-off__label">{player}</div>
      <div className="borne-off__checkers">{checkers}</div>
      <div className="borne-off__count">{count}</div>
    </div>
  )
}
