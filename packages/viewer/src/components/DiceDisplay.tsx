import type React from 'react'
import type { DiceRoll, DieValue, Turn } from '@backgammon/game'

interface DiceDisplayProps {
  diceRoll: DiceRoll | null
  remainingMoves: readonly DieValue[]
  previousTurn: Turn | null
}

interface DieProps {
  value: DieValue
  used: boolean
  faded?: boolean
}

function Die({ value, used, faded = false }: DieProps): React.JSX.Element {
  const classNames = [
    'die',
    `die--${String(value)}`,
    used && 'die--used',
    faded && 'die--faded'
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={classNames}>
      <span className="die__value">{value}</span>
    </div>
  )
}

function titleCase(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export function DiceDisplay({
  diceRoll,
  remainingMoves,
  previousTurn
}: DiceDisplayProps): React.JSX.Element {
  // No current roll - show previous turn's dice in faded state
  if (!diceRoll) {
    if (previousTurn) {
      const { die1, die2 } = previousTurn.diceRoll
      return (
        <div className="dice-display dice-display--previous">
          <span className="dice-display__previous-label">
            {titleCase(previousTurn.player)}&apos;s roll:
          </span>
          <Die value={die1} used={false} faded />
          <Die value={die2} used={false} faded />
        </div>
      )
    }

    return (
      <div className="dice-display dice-display--empty">
        <span>No roll</span>
      </div>
    )
  }

  const { die1, die2 } = diceRoll
  const isDoubles = die1 === die2

  // Count how many of each die value remain
  const die1UsedCount = isDoubles
    ? 4 - remainingMoves.filter(v => v === die1).length
    : remainingMoves.includes(die1)
      ? 0
      : 1
  const die2UsedCount = isDoubles
    ? die1UsedCount // Same for doubles
    : remainingMoves.includes(die2)
      ? 0
      : 1

  return (
    <div className="dice-display">
      <Die value={die1} used={die1UsedCount > 0 && !isDoubles} />
      <Die value={die2} used={die2UsedCount > 0 && !isDoubles} />
      {isDoubles && (
        <span className="dice-display__doubles">
          ({remainingMoves.length} moves left)
        </span>
      )}
    </div>
  )
}
