import type { CheckerCounts, Player } from '@/game'
import { Checker } from './Checker'

interface BarProps {
  bar: CheckerCounts
  currentPlayer: Player | null
  isSelected: boolean
  onBarClick?: (player: Player) => void
}

export function Bar({ bar, currentPlayer, isSelected, onBarClick }: BarProps) {
  const handleWhiteClick = () => {
    if (bar.white > 0) {
      onBarClick?.('white')
    }
  }

  const handleBlackClick = () => {
    if (bar.black > 0) {
      onBarClick?.('black')
    }
  }

  const whiteCheckers = Array.from({ length: bar.white }, (_, i) => (
    <Checker key={`white-${i}`} player="white" />
  ))
  const blackCheckers = Array.from({ length: bar.black }, (_, i) => (
    <Checker key={`black-${i}`} player="black" />
  ))

  const whiteClickable = bar.white > 0 && currentPlayer === 'white' && onBarClick
  const blackClickable = bar.black > 0 && currentPlayer === 'black' && onBarClick
  const whiteSelected = isSelected && currentPlayer === 'white'
  const blackSelected = isSelected && currentPlayer === 'black'

  const blackSectionClasses = [
    'bar__section',
    'bar__section--top',
    blackClickable && 'bar__section--clickable',
    blackSelected && 'bar__section--selected',
  ]
    .filter(Boolean)
    .join(' ')

  const whiteSectionClasses = [
    'bar__section',
    'bar__section--bottom',
    whiteClickable && 'bar__section--clickable',
    whiteSelected && 'bar__section--selected',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="bar">
      <div
        className={blackSectionClasses}
        onClick={handleBlackClick}
        role={blackClickable ? 'button' : undefined}
        tabIndex={blackClickable ? 0 : undefined}
        onKeyDown={(e) => {
          if (blackClickable && (e.key === 'Enter' || e.key === ' ')) {
            handleBlackClick()
          }
        }}
      >
        {blackCheckers}
      </div>
      <div
        className={whiteSectionClasses}
        onClick={handleWhiteClick}
        role={whiteClickable ? 'button' : undefined}
        tabIndex={whiteClickable ? 0 : undefined}
        onKeyDown={(e) => {
          if (whiteClickable && (e.key === 'Enter' || e.key === ' ')) {
            handleWhiteClick()
          }
        }}
      >
        {whiteCheckers}
      </div>
    </div>
  )
}
