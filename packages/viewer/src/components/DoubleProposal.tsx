import type React from 'react'
import type { CubeValue, Player } from '@backgammon/game'

interface DoubleProposalProps {
  proposedBy: Player
  newValue: CubeValue
  onAccept: () => void
  onDecline: () => void
}

function titleCase(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export function DoubleProposal({
  proposedBy,
  newValue,
  onAccept,
  onDecline
}: DoubleProposalProps): React.JSX.Element {
  return (
    <div className="double-proposal">
      <div className="double-proposal__message">
        {titleCase(proposedBy)} proposes to double to{' '}
        <strong>{newValue}</strong>
      </div>
      <div className="double-proposal__actions">
        <button
          className="controls__button controls__button--roll double-proposal__button"
          onClick={onAccept}
        >
          Accept
        </button>
        <button
          className="controls__button controls__button--end-turn double-proposal__button"
          onClick={onDecline}
        >
          Decline
        </button>
      </div>
    </div>
  )
}
