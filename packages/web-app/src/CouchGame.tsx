import type React from 'react'
import { useState } from 'react'
import type { MoveFrom, MoveTo, PointIndex, Player } from '@backgammon/game'
import { useAppDispatch, useAppSelector } from './hooks'
import {
  resetGame,
  selectValidMoves,
  selectCanEndTurn,
  selectCanUndo,
  selectPhase,
  selectCurrentPlayer,
  selectBoard,
  selectLastAction,
  selectCanDouble,
  selectMatchState,
  selectMatchScore,
  selectIsCrawfordGame,
  selectMatchWinner,
  selectMatchGameNumber,
  performStartGame,
  performRollDice,
  performMove,
  performEndTurn,
  performUndoMove,
  performProposeDouble,
  performRespondToDouble,
  startMatch,
  recordGameResult,
  resetMatch
} from '@backgammon/game'
import { BoardView } from '@backgammon/viewer'

type GameMode =
  | { mode: 'single'; enableDoublingCube: boolean }
  | { mode: 'match'; targetScore: number; enableDoublingCube: boolean }

export function CouchGame(): React.JSX.Element {
  const dispatch = useAppDispatch()
  const gameState = useAppSelector(state => state.game)

  const [selectedSource, setSelectedSource] = useState<
    PointIndex | 'bar' | null
  >(null)
  const [validDestinations, setValidDestinations] = useState<readonly MoveTo[]>(
    []
  )

  // Game setup state
  const [gameMode, setGameMode] = useState<GameMode>({
    mode: 'single',
    enableDoublingCube: false
  })
  const [matchTargetInput, setMatchTargetInput] = useState('7')

  const phase = useAppSelector(selectPhase)
  const currentPlayer = useAppSelector(selectCurrentPlayer)
  const board = useAppSelector(selectBoard)

  // Use memoized selectors for expensive computations
  const availableMoves = useAppSelector(selectValidMoves)
  const canEndTurnNow = useAppSelector(selectCanEndTurn)
  const canUndoNow = useAppSelector(selectCanUndo)
  const lastAction = useAppSelector(selectLastAction)
  const canDoubleNow = useAppSelector(selectCanDouble)

  // Match selectors
  const matchState = useAppSelector(selectMatchState)
  const matchScore = useAppSelector(selectMatchScore)
  const isCrawfordGame = useAppSelector(selectIsCrawfordGame)
  const matchWinner = useAppSelector(selectMatchWinner)
  const matchGameNumber = useAppSelector(selectMatchGameNumber)

  // Handle starting the game using the new operation
  const handleStartGame = (): void => {
    // If match mode, start the match first
    if (gameMode.mode === 'match') {
      const targetScore = parseInt(matchTargetInput, 10) || 7
      dispatch(startMatch({ targetScore, enableDoublingCube: gameMode.enableDoublingCube }))
    }

    dispatch(performStartGame({
      enableDoublingCube: gameMode.enableDoublingCube,
      isCrawfordGame: false
    }))
  }

  // Handle rolling dice
  const handleRollClick = (): void => {
    if (phase !== 'rolling') return
    const action = dispatch(performRollDice())
    const result = action.meta.result
    if (result?.ok !== true) {
      console.error(
        'Roll failed:',
        result?.ok === false ? result.error.message : 'unknown error'
      )
      return
    }
    setSelectedSource(null)
    setValidDestinations([])
  }

  // Handle end turn
  const handleEndTurnClick = (): void => {
    if (phase !== 'moving') return
    const action = dispatch(performEndTurn())
    const result = action.meta.result
    if (result?.ok !== true) {
      console.error(
        'End turn failed:',
        result?.ok === false ? result.error.message : 'unknown error'
      )
      return
    }
    setSelectedSource(null)
    setValidDestinations([])
  }

  // Handle undo
  const handleUndoClick = (): void => {
    if (phase !== 'moving') return
    const action = dispatch(performUndoMove())
    const result = action.meta.result
    if (result?.ok !== true) {
      console.error(
        'Undo failed:',
        result?.ok === false ? result.error.message : 'unknown error'
      )
      return
    }
    setSelectedSource(null)
    setValidDestinations([])
  }

  // Handle proposing a double
  const handleDoubleClick = (): void => {
    const action = dispatch(performProposeDouble())
    const result = action.meta.result
    if (result?.ok !== true) {
      console.error(
        'Double failed:',
        result?.ok === false ? result.error.message : 'unknown error'
      )
    }
  }

  // Handle responding to a double
  const handleDoubleResponse = (response: 'accept' | 'decline'): void => {
    const action = dispatch(performRespondToDouble({ response }))
    const result = action.meta.result
    if (result?.ok !== true) {
      console.error(
        'Double response failed:',
        result?.ok === false ? result.error.message : 'unknown error'
      )
    }
  }

  // Handle reset/new game
  const handleNewGame = (): void => {
    dispatch(resetGame())
    dispatch(resetMatch())
    setSelectedSource(null)
    setValidDestinations([])
  }

  // Handle next game in match
  const handleNextGame = (): void => {
    // Record the completed game's result in the match
    if (gameState.result && matchState) {
      dispatch(recordGameResult(gameState.result))
    }

    // Reset for next game
    dispatch(resetGame())
    setSelectedSource(null)
    setValidDestinations([])

    // Start next game with appropriate settings
    // We need to check if the next game is a Crawford game
    // The match state will have been updated by recordGameResult
    // Use a small timeout to ensure state is updated, or read directly
    const currentMatchState = matchState
    if (currentMatchState && currentMatchState.phase === 'in_progress') {
      dispatch(performStartGame({
        enableDoublingCube: currentMatchState.config.enableDoublingCube,
        isCrawfordGame: currentMatchState.isCrawfordGame
      }))
    }
  }

  // Get valid destinations for a source position
  const getDestinationsForSource = (source: MoveFrom): MoveTo[] => {
    if (availableMoves.length === 0) return []
    const available = availableMoves.find(am => am.from === source)
    if (!available) return []
    return available.destinations.map(d => d.to)
  }

  // Handle point click
  const handlePointClick = (pointIndex: PointIndex): void => {
    if (phase !== 'moving' || !currentPlayer) return

    // Check if this point is a valid destination for the selected source
    if (selectedSource !== null && validDestinations.includes(pointIndex)) {
      // Make the move
      const source = selectedSource
      const availableMove = availableMoves.find(am => am.from === source)
      const destination = availableMove?.destinations.find(
        d => d.to === pointIndex
      )

      if (destination) {
        const action = dispatch(
          performMove({
            from: source,
            to: pointIndex,
            dieUsed: destination.dieValue
          })
        )
        const result = action.meta.result
        if (result?.ok !== true) {
          console.error(
            'Move failed:',
            result?.ok === false ? result.error.message : 'unknown error'
          )
          return
        }
        setSelectedSource(null)
        setValidDestinations([])
      }
      return
    }

    // Check if this point has the current player's checker and can be selected
    const pointValue = board.points[pointIndex - 1]
    const hasCurrentPlayerChecker =
      (currentPlayer === 'white' && pointValue > 0) ||
      (currentPlayer === 'black' && pointValue < 0)

    // If player has checkers on bar, they must move from bar first
    if (board.bar[currentPlayer] > 0) {
      // Cannot select points when checkers are on bar
      setSelectedSource(null)
      setValidDestinations([])
      return
    }

    if (hasCurrentPlayerChecker) {
      const destinations = getDestinationsForSource(pointIndex)
      if (destinations.length > 0) {
        // Select this point
        setSelectedSource(pointIndex)
        setValidDestinations(destinations)
      } else {
        // No valid moves from this point
        setSelectedSource(null)
        setValidDestinations([])
      }
    } else {
      // Clicked on empty or opponent's point - deselect
      setSelectedSource(null)
      setValidDestinations([])
    }
  }

  // Handle bar click
  const handleBarClick = (player: Player): void => {
    if (phase !== 'moving' || player !== currentPlayer) return

    if (board.bar[player] > 0) {
      const destinations = getDestinationsForSource('bar')
      if (destinations.length > 0) {
        setSelectedSource('bar')
        setValidDestinations(destinations)
      }
    }
  }

  // Handle borne-off area click (for bearing off moves)
  const handleBorneOffClick = (_player: Player): void => {
    if (
      phase !== 'moving' ||
      selectedSource === null ||
      !validDestinations.includes('off')
    )
      return

    // Make bearing off move
    const availableMove = availableMoves.find(am => am.from === selectedSource)
    const destination = availableMove?.destinations.find(d => d.to === 'off')

    if (destination) {
      const action = dispatch(
        performMove({
          from: selectedSource,
          to: 'off',
          dieUsed: destination.dieValue
        })
      )
      const result = action.meta.result
      if (result?.ok !== true) {
        console.error(
          'Bear off failed:',
          result?.ok === false ? result.error.message : 'unknown error'
        )
        return
      }
      setSelectedSource(null)
      setValidDestinations([])
    }
  }

  return (
    <div className="couch-game">
      <h1>Backgammon</h1>

      {phase === 'not_started' && !matchWinner && (
        <div className="couch-game__setup">
          <div className="couch-game__options">
            <label className="couch-game__option">
              <input
                type="radio"
                name="gameMode"
                checked={gameMode.mode === 'single'}
                onChange={() => setGameMode({ mode: 'single', enableDoublingCube: gameMode.enableDoublingCube })}
              />
              Single Game
            </label>
            <label className="couch-game__option">
              <input
                type="radio"
                name="gameMode"
                checked={gameMode.mode === 'match'}
                onChange={() => setGameMode({
                  mode: 'match',
                  targetScore: parseInt(matchTargetInput, 10) || 7,
                  enableDoublingCube: gameMode.enableDoublingCube
                })}
              />
              Match Play
            </label>
            {gameMode.mode === 'match' && (
              <label className="couch-game__option">
                Target Score:
                <input
                  type="number"
                  min="1"
                  max="25"
                  value={matchTargetInput}
                  onChange={e => setMatchTargetInput(e.target.value)}
                  className="couch-game__target-input"
                />
              </label>
            )}
            <label className="couch-game__option">
              <input
                type="checkbox"
                checked={gameMode.enableDoublingCube}
                onChange={e => setGameMode({ ...gameMode, enableDoublingCube: e.target.checked })}
              />
              Doubling Cube
            </label>
          </div>
          <button
            className="couch-game__start-button"
            onClick={handleStartGame}
          >
            Start Game
          </button>
        </div>
      )}

      {phase !== 'not_started' && (
        <BoardView
          gameState={gameState}
          selectedSource={selectedSource}
          validDestinations={validDestinations}
          canEndTurn={canEndTurnNow}
          validMoves={availableMoves}
          lastAction={lastAction}
          onPointClick={handlePointClick}
          onBarClick={handleBarClick}
          onBorneOffClick={handleBorneOffClick}
          canUndo={canUndoNow}
          onRollClick={handleRollClick}
          onEndTurnClick={handleEndTurnClick}
          onUndoClick={handleUndoClick}
          canDouble={canDoubleNow}
          onDoubleClick={handleDoubleClick}
          onDoubleResponse={handleDoubleResponse}
          matchScore={matchScore}
          matchTargetScore={gameMode.mode === 'match' ? (parseInt(matchTargetInput, 10) || 7) : null}
          isCrawfordGame={isCrawfordGame}
          matchGameNumber={matchGameNumber}
        />
      )}

      {phase === 'game_over' && matchState && !matchWinner && (
        <div className="couch-game__game-over">
          <button
            className="couch-game__new-game-button"
            onClick={handleNextGame}
          >
            Next Game
          </button>
        </div>
      )}

      {matchWinner && (
        <div className="couch-game__match-over">
          <p className="couch-game__match-winner">
            {matchWinner.charAt(0).toUpperCase() + matchWinner.slice(1)} wins the match!
          </p>
          <button
            className="couch-game__new-game-button"
            onClick={handleNewGame}
          >
            New Match
          </button>
        </div>
      )}

      {phase === 'game_over' && !matchState && (
        <div className="couch-game__game-over">
          <button
            className="couch-game__new-game-button"
            onClick={handleNewGame}
          >
            New Game
          </button>
        </div>
      )}
    </div>
  )
}
