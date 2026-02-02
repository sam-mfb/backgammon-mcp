import {
  useApp,
  useHostStyles,
  type McpUiHostContext,
  type McpUiToolResultNotification
} from '@modelcontextprotocol/ext-apps/react'
import { BoardView } from '@backgammon/viewer'
import {
  selectLastAction,
  type Player,
  type PointIndex,
  type MoveTo,
  type MoveFrom
} from '@backgammon/game'
import { useState, useEffect, useCallback, useMemo } from 'react'
import type { BackgammonStructuredContent, GameConfig } from '../types'

const DEFAULT_CONFIG: GameConfig = {
  whiteControl: 'human',
  blackControl: 'ai'
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
  // State for tool results and host context - populated via callbacks
  const [toolResult, setToolResult] = useState<{
    structuredContent?: BackgammonStructuredContent
  } | null>(null)
  const [hostContext, setHostContext] = useState<McpUiHostContext | undefined>(
    undefined
  )

  const { app, error } = useApp({
    appInfo: { name: 'Backgammon', version: '1.0.0' },
    capabilities: {},
    onAppCreated: createdApp => {
      // Register handler for tool results
      createdApp.ontoolresult = (
        params: McpUiToolResultNotification['params']
      ) => {
        setToolResult({
          structuredContent:
            params.structuredContent as BackgammonStructuredContent
        })
      }
      // Register handler for host context changes
      createdApp.onhostcontextchanged = params => {
        setHostContext(prev => ({ ...prev, ...params }))
      }
    }
  })

  const [selectedSource, setSelectedSource] = useState<
    PointIndex | 'bar' | null
  >(null)
  const [validDestinations, setValidDestinations] = useState<readonly MoveTo[]>(
    []
  )
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Store config from start_game/get_game_state, persists across subsequent tool results
  const [config, setConfig] = useState<GameConfig>(DEFAULT_CONFIG)

  const structuredContent = toolResult?.structuredContent

  // Extract values we need for hooks - these must be computed before any conditionals
  const gameState = structuredContent?.gameState
  const validMoves = useMemo(
    () => structuredContent?.validMoves ?? [],
    [structuredContent?.validMoves]
  )
  const currentPlayer = gameState?.currentPlayer ?? null
  const board = gameState?.board
  const phase = gameState?.phase

  // Automatically applies theme, variables, and fonts from host context
  useHostStyles(hostContext)

  // Apply safe area insets for devices with notches or system UI
  useEffect(() => {
    if (hostContext?.safeAreaInsets) {
      const { top, right, bottom, left } = hostContext.safeAreaInsets
      document.documentElement.style.setProperty('--safe-area-top', `${top}px`)
      document.documentElement.style.setProperty(
        '--safe-area-right',
        `${right}px`
      )
      document.documentElement.style.setProperty(
        '--safe-area-bottom',
        `${bottom}px`
      )
      document.documentElement.style.setProperty('--safe-area-left', `${left}px`)
    }
  }, [hostContext])

  // Capture config when start_game or get_game_state returns it
  useEffect(() => {
    if (structuredContent?.config) {
      setConfig(structuredContent.config)
    }
  }, [structuredContent?.config])

  // Handle errors from tool calls
  useEffect(() => {
    if (error) {
      setErrorMessage(error.message)
      // Clear error after 3 seconds
      const timer = setTimeout(() => {
        setErrorMessage(null)
      }, 3000)
      return () => {
        clearTimeout(timer)
      }
    }
  }, [error])

  // Clear selection when game state changes (new moves made)
  useEffect(() => {
    setSelectedSource(null)
    setValidDestinations([])
  }, [gameState])

  // Derive values from state
  const humanControlled = useMemo(
    () => deriveHumanControlled(config),
    [config]
  )
  const lastAction = useMemo(
    () => (gameState ? selectLastAction(gameState) : null),
    [gameState]
  )

  // Get valid destinations for a source position - memoized helper
  const getDestinationsForSource = useCallback(
    (source: MoveFrom): MoveTo[] => {
      if (validMoves.length === 0) return []
      const available = validMoves.find(am => am.from === source)
      if (!available) return []
      return available.destinations.map(d => d.to)
    },
    [validMoves]
  )

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
      if (phase !== 'moving' || !currentPlayer || !board) return

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
      app,
      getDestinationsForSource
    ]
  )

  // Handle bar click
  const handleBarClick = useCallback(
    (player: Player): void => {
      if (phase !== 'moving' || player !== currentPlayer || !board) return

      if (board.bar[player] > 0) {
        const destinations = getDestinationsForSource('bar')
        if (destinations.length > 0) {
          setSelectedSource('bar')
          setValidDestinations(destinations)
        }
      }
    },
    [phase, currentPlayer, board, getDestinationsForSource]
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

  // Show waiting state when no game state is available
  if (!gameState) {
    return <div className="waiting">Waiting for game to start...</div>
  }

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
