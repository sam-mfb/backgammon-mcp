import { useApp } from '@modelcontextprotocol/ext-apps/react'
import {
  applyHostStyleVariables,
  applyDocumentTheme,
  applyHostFonts
} from '@modelcontextprotocol/ext-apps'
import { BoardView } from '@backgammon/viewer'
import {
  selectLastAction,
  type GameState,
  type Player,
  type PointIndex,
  type MoveTo,
  type MoveFrom,
  type AvailableMoves
} from '@backgammon/game'
import { useState, useEffect, useCallback, useRef } from 'react'

// =============================================================================
// Types
// =============================================================================

type PlayerControl = 'human' | 'ai'

interface GameConfig {
  readonly whiteControl: PlayerControl
  readonly blackControl: PlayerControl
}

interface BackgammonStructuredContent {
  [key: string]: unknown
  gameState: GameState
  validMoves?: readonly AvailableMoves[]
  config?: GameConfig
}

// =============================================================================
// Helpers
// =============================================================================

function deriveHumanControlled(config: GameConfig): Player | 'both' | null {
  if (config.whiteControl === 'human' && config.blackControl === 'human')
    return 'both'
  if (config.whiteControl === 'human') return 'white'
  if (config.blackControl === 'human') return 'black'
  return null // AI vs AI - spectator mode
}

// =============================================================================
// Component
// =============================================================================

export function McpAppShim(): React.JSX.Element {
  const { app, toolResult, hostContext, error } =
    useApp<BackgammonStructuredContent>({
      appInfo: { name: 'Backgammon', version: '1.0.0' },
      capabilities: {}
    })

  const [selectedSource, setSelectedSource] = useState<
    PointIndex | 'bar' | null
  >(null)
  const [validDestinations, setValidDestinations] = useState<readonly MoveTo[]>(
    []
  )
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Store config from start_game/get_game_state, persists across subsequent tool results
  const configRef = useRef<GameConfig>({
    whiteControl: 'human',
    blackControl: 'ai'
  })

  const structuredContent = toolResult?.structuredContent

  // Apply host styling when context changes
  useEffect(() => {
    if (hostContext?.theme) applyDocumentTheme(hostContext.theme)
    if (hostContext?.styles?.variables)
      applyHostStyleVariables(hostContext.styles.variables)
    if (hostContext?.styles?.css?.fonts)
      applyHostFonts(hostContext.styles.css.fonts)
  }, [hostContext])

  // Capture config when start_game or get_game_state returns it
  useEffect(() => {
    if (structuredContent?.config) {
      configRef.current = structuredContent.config
    }
  }, [structuredContent?.config])

  // Handle errors from tool calls
  useEffect(() => {
    if (error) {
      setErrorMessage(error.message)
      // Clear error after 3 seconds
      const timer = setTimeout(() => setErrorMessage(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [error])

  // Clear selection when game state changes (new moves made)
  useEffect(() => {
    setSelectedSource(null)
    setValidDestinations([])
  }, [structuredContent?.gameState])

  // Show waiting state when no game state is available
  if (!structuredContent?.gameState) {
    return <div className="waiting">Waiting for game to start...</div>
  }

  const { gameState, validMoves = [] } = structuredContent
  const humanControlled = deriveHumanControlled(configRef.current)
  const lastAction = selectLastAction(gameState)
  const { currentPlayer, board, phase } = gameState

  // Get valid destinations for a source position
  const getDestinationsForSource = (source: MoveFrom): MoveTo[] => {
    if (validMoves.length === 0) return []
    const available = validMoves.find(am => am.from === source)
    if (!available) return []
    return available.destinations.map(d => d.to)
  }

  // Wire button clicks to MCP tool calls
  const handleRollClick = useCallback(() => {
    app?.callServerTool({ name: 'backgammon_roll_dice', arguments: {} })
  }, [app])

  const handleEndTurnClick = useCallback(() => {
    app?.callServerTool({ name: 'backgammon_end_turn', arguments: {} })
  }, [app])

  // Handle point click
  const handlePointClick = useCallback(
    (pointIndex: PointIndex): void => {
      if (phase !== 'moving' || !currentPlayer) return

      // Check if this point is a valid destination for the selected source
      if (selectedSource !== null && validDestinations.includes(pointIndex)) {
        // Make the move
        const availableMove = validMoves.find(am => am.from === selectedSource)
        const destination = availableMove?.destinations.find(
          d => d.to === pointIndex
        )

        if (destination) {
          app?.callServerTool({
            name: 'backgammon_make_move',
            arguments: {
              from: selectedSource,
              to: pointIndex,
              dieUsed: destination.dieValue
            }
          })
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
      board,
      selectedSource,
      validDestinations,
      validMoves,
      app
    ]
  )

  // Handle bar click
  const handleBarClick = useCallback(
    (player: Player): void => {
      if (phase !== 'moving' || player !== currentPlayer) return

      if (board.bar[player] > 0) {
        const destinations = getDestinationsForSource('bar')
        if (destinations.length > 0) {
          setSelectedSource('bar')
          setValidDestinations(destinations)
        }
      }
    },
    [phase, currentPlayer, board, validMoves]
  )

  // Handle borne-off area click (for bearing off moves)
  const handleBorneOffClick = useCallback(
    (_player: Player): void => {
      if (
        phase !== 'moving' ||
        selectedSource === null ||
        !validDestinations.includes('off')
      )
        return

      // Make bearing off move
      const availableMove = validMoves.find(am => am.from === selectedSource)
      const destination = availableMove?.destinations.find(d => d.to === 'off')

      if (destination) {
        app?.callServerTool({
          name: 'backgammon_make_move',
          arguments: {
            from: selectedSource,
            to: 'off',
            dieUsed: destination.dieValue
          }
        })
      }
    },
    [phase, selectedSource, validDestinations, validMoves, app]
  )

  return (
    <>
      {errorMessage && <div className="error-toast">{errorMessage}</div>}
      <BoardView
        gameState={gameState}
        selectedSource={selectedSource}
        validDestinations={validDestinations}
        validMoves={validMoves}
        humanControlled={humanControlled}
        lastAction={lastAction}
        onPointClick={handlePointClick}
        onBarClick={handleBarClick}
        onBorneOffClick={handleBorneOffClick}
        onRollClick={handleRollClick}
        onEndTurnClick={handleEndTurnClick}
      />
    </>
  )
}
