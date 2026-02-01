import { useState, useCallback, useEffect, useMemo } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import type { RootState, AppDispatch } from './store'
import type { DieValue, MoveFrom, MoveTo, PointIndex, Player } from '@backgammon/game'
import {
  startGame,
  setFirstPlayer,
  rollDice,
  makeMove,
  endTurn,
  resetGame,
  getValidMoves,
  canEndTurn,
} from '@backgammon/game'
import { BoardView, type SelectedSource } from '@backgammon/viewer'

/** Generate a random die roll (1-6) */
function rollDie(): DieValue {
  return (Math.floor(Math.random() * 6) + 1) as DieValue
}

export function CouchGame() {
  const dispatch = useDispatch<AppDispatch>()
  const gameState = useSelector((state: RootState) => state.game)

  const [selectedSource, setSelectedSource] = useState<SelectedSource>(null)
  const [validDestinations, setValidDestinations] = useState<readonly MoveTo[]>([])

  const { phase, currentPlayer, board, remainingMoves } = gameState

  // Compute available moves on-demand (derived state)
  const availableMoves = useMemo(() => {
    if (phase === 'moving' && remainingMoves.length > 0) {
      return getValidMoves({ state: gameState })
    }
    return null
  }, [phase, remainingMoves, board, currentPlayer])

  // Check if player can end their turn (must use all legal moves)
  const canEndTurnNow = useMemo(
    () => canEndTurn({ state: gameState }),
    [gameState]
  )

  // Auto-end turn if no moves available
  useEffect(() => {
    if (phase === 'moving' && availableMoves && availableMoves.length === 0) {
      // No moves possible - auto end turn
      dispatch(endTurn())
    }
  }, [phase, availableMoves, dispatch])

  // Handle starting the game
  const handleStartGame = useCallback(() => {
    dispatch(startGame())
    // Roll to determine first player
    let whiteDie = rollDie()
    let blackDie = rollDie()
    // Re-roll if tied
    while (whiteDie === blackDie) {
      whiteDie = rollDie()
      blackDie = rollDie()
    }
    const firstPlayer: Player = whiteDie > blackDie ? 'white' : 'black'
    dispatch(setFirstPlayer(firstPlayer))
  }, [dispatch])

  // Handle rolling dice
  const handleRollClick = useCallback(() => {
    if (phase !== 'rolling') return
    const die1 = rollDie()
    const die2 = rollDie()
    dispatch(rollDice({ die1, die2 }))
    setSelectedSource(null)
    setValidDestinations([])
  }, [phase, dispatch])

  // Handle end turn
  const handleEndTurnClick = useCallback(() => {
    if (phase !== 'moving') return
    dispatch(endTurn())
    setSelectedSource(null)
    setValidDestinations([])
  }, [phase, dispatch])

  // Handle reset/new game
  const handleNewGame = useCallback(() => {
    dispatch(resetGame())
    setSelectedSource(null)
    setValidDestinations([])
  }, [dispatch])

  // Get valid destinations for a source position
  const getDestinationsForSource = useCallback(
    (source: MoveFrom): MoveTo[] => {
      if (!availableMoves) return []
      const available = availableMoves.find((am) => am.from === source)
      if (!available) return []
      return available.destinations.map((d) => d.to)
    },
    [availableMoves]
  )

  // Handle point click
  const handlePointClick = useCallback(
    (pointIndex: PointIndex) => {
      if (phase !== 'moving' || !currentPlayer) return

      // Check if this point is a valid destination for the selected source
      if (selectedSource !== null && validDestinations.includes(pointIndex)) {
        // Make the move
        const source = selectedSource
        const availableMove = availableMoves?.find((am) => am.from === source)
        const destination = availableMove?.destinations.find(
          (d) => d.to === pointIndex
        )

        if (destination) {
          dispatch(
            makeMove({
              from: source,
              to: pointIndex,
              dieUsed: destination.dieValue,
            })
          )
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
    },
    [
      phase,
      currentPlayer,
      selectedSource,
      validDestinations,
      availableMoves,
      board,
      dispatch,
      getDestinationsForSource,
    ]
  )

  // Handle bar click
  const handleBarClick = useCallback(
    (player: Player) => {
      if (phase !== 'moving' || player !== currentPlayer) return

      if (board.bar[player] > 0) {
        const destinations = getDestinationsForSource('bar')
        if (destinations.length > 0) {
          setSelectedSource('bar')
          setValidDestinations(destinations)
        }
      }
    },
    [phase, currentPlayer, board.bar, getDestinationsForSource]
  )

  // Handle borne-off area click (for bearing off moves)
  const handleBorneOffClick = useCallback(
    (_player: Player) => {
      if (
        phase !== 'moving' ||
        selectedSource === null ||
        !validDestinations.includes('off')
      )
        return

      // Make bearing off move
      const availableMove = availableMoves?.find(
        (am) => am.from === selectedSource
      )
      const destination = availableMove?.destinations.find((d) => d.to === 'off')

      if (destination) {
        dispatch(
          makeMove({
            from: selectedSource,
            to: 'off',
            dieUsed: destination.dieValue,
          })
        )
        setSelectedSource(null)
        setValidDestinations([])
      }
    },
    [phase, selectedSource, validDestinations, availableMoves, dispatch]
  )

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
          onPointClick={handlePointClick}
          onBarClick={handleBarClick}
          onBorneOffClick={handleBorneOffClick}
          onRollClick={handleRollClick}
          onEndTurnClick={handleEndTurnClick}
        />
      )}

      {phase === 'game_over' && (
        <div className="couch-game__game-over">
          <button className="couch-game__new-game-button" onClick={handleNewGame}>
            New Game
          </button>
        </div>
      )}
    </div>
  )
}
