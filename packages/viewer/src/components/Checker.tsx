import type { Player } from '@backgammon/game'

interface CheckerProps {
  player: Player
}

export function Checker({ player }: CheckerProps) {
  return <div className={`checker checker--${player}`} />
}
