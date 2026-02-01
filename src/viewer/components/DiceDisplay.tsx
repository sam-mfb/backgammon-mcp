import type { DiceRoll, DieValue } from '@/game'

interface DiceDisplayProps {
  diceRoll: DiceRoll | null
  remainingMoves: readonly DieValue[]
}

interface DieProps {
  value: DieValue
  used: boolean
}

function Die({ value, used }: DieProps) {
  return (
    <div className={`die die--${value} ${used ? 'die--used' : ''}`}>
      <span className="die__value">{value}</span>
    </div>
  )
}

export function DiceDisplay({ diceRoll, remainingMoves }: DiceDisplayProps) {
  if (!diceRoll) {
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
    : remainingMoves.includes(die1) ? 0 : 1
  const die2UsedCount = isDoubles
    ? die1UsedCount // Same for doubles
    : remainingMoves.includes(die2) ? 0 : 1

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
