import type React from 'react'

interface MatchScoreBoardProps {
  whiteScore: number
  blackScore: number
  targetScore: number
  isCrawfordGame: boolean
  gameNumber: number
}

export function MatchScoreBoard({
  whiteScore,
  blackScore,
  targetScore,
  isCrawfordGame,
  gameNumber
}: MatchScoreBoardProps): React.JSX.Element {
  return (
    <div className="match-scoreboard">
      <div className="match-scoreboard__score">
        <span className="match-scoreboard__player match-scoreboard__player--white">
          White: {whiteScore}
        </span>
        <span className="match-scoreboard__separator">–</span>
        <span className="match-scoreboard__player match-scoreboard__player--black">
          Black: {blackScore}
        </span>
      </div>
      <div className="match-scoreboard__info">
        <span className="match-scoreboard__target">
          First to {targetScore}
        </span>
        <span className="match-scoreboard__game">
          Game {gameNumber}
        </span>
        {isCrawfordGame && (
          <span className="match-scoreboard__crawford">Crawford Game</span>
        )}
      </div>
    </div>
  )
}
