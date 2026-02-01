import type React from 'react'
import type { Player } from '@backgammon/game'

interface CheckerProps {
  player: Player
}

export function Checker({ player }: CheckerProps): React.JSX.Element {
  return <div className={`checker checker--${player}`} />
}
