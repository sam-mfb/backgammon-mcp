import type { CheckerCounts } from '@/game'
import { Checker } from './Checker'

interface BarProps {
  bar: CheckerCounts
}

export function Bar({ bar }: BarProps) {
  const whiteCheckers = Array.from({ length: bar.white }, (_, i) => (
    <Checker key={`white-${i}`} player="white" />
  ))
  const blackCheckers = Array.from({ length: bar.black }, (_, i) => (
    <Checker key={`black-${i}`} player="black" />
  ))

  return (
    <div className="bar">
      <div className="bar__section bar__section--top">
        {blackCheckers}
      </div>
      <div className="bar__section bar__section--bottom">
        {whiteCheckers}
      </div>
    </div>
  )
}
