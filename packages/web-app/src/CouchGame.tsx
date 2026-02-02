import type React from 'react'
import { useState } from 'react'
import type { MoveFrom, MoveTo, PointIndex, Player } from '@backgammon/game'
import { useAppDispatch, useAppSelector } from './hooks'
import {
  resetGame,
  selectValidMoves,
  selectCanEndTurn,
  selectPhase,
  selectCurrentPlayer,
  selectBoard,
  selectLastAction,
  performStartGame,
  performRollDice,
  performMove,
  performEndTurn
} from '@backgammon/game'
import { BoardView } from '@backgammon/viewer'

export function CouchGame(): React.JSX.Element {
  const dispatch = useAppDispatch()
  const gameState = useAppSelector(state => state.game)

  const [selectedSource, setSelectedSource] = useState<
    PointIndex | 'bar' | null
  >(null)
  const [validDestinations, setValidDestinations] = useState<readonly MoveTo[]>(
    []
  )

  const phase = useAppSelector(selectPhase)
  const currentPlayer = useAppSelector(selectCurrentPlayer)
  const board = useAppSelector(selectBoard)

  // Use memoized selectors for expensive computations
  const availableMoves = useAppSelector(selectValidMoves)
  const canEndTurnNow = useAppSelector(selectCanEndTurn)
  const lastAction = useAppSelector(selectLastAction)

  // Handle starting the game using the new operation
  const handleStartGame = (): void => {
    dispatch(performStartGame())
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

  // Handle reset/new game
  const handleNewGame = (): void => {
    dispatch(resetGame())
    setSelectedSource(null)
    setValidDestinations([])
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

      {phase === 'not_started' && (
        <div className="couch-game__start">
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
          onRollClick={handleRollClick}
          onEndTurnClick={handleEndTurnClick}
        />
      )}

      {phase === 'game_over' && (
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
