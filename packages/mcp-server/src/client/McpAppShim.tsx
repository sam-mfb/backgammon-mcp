import {
  useApp,
  useHostStyles,
  type McpUiHostContext
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
import React from 'react'

const DEFAULT_CONFIG: GameConfig = {
  whiteControl: 'human',
  blackControl: 'ai'
}

export function McpAppShim(): React.JSX.Element {
  // State for tool results and host context - populated via callbacks
  const [toolResult, setToolResult] = useState<{
    structuredContent?: BackgammonStructuredContent
  } | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [logMessage, setLogMessage] = useState<string | null>(null)
  const [hostContext, setHostContext] = useState<McpUiHostContext | undefined>(
    undefined
  )

  const { app, error } = useApp({
    appInfo: { name: 'Backgammon', version: '1.0.0' },
    capabilities: {},
    onAppCreated: createdApp => {
      // Register handler for tool results (model-initiated tools)
      createdApp.ontoolresult = params => {
        const structuredContent = params.structuredContent
        if (structuredContent) {
          setToolResult({
            structuredContent: structuredContent as BackgammonStructuredContent
          })
        } else {
          setLogMessage('No structuredContent received')
        }
      }
      // Register handler for host context changes
      createdApp.onhostcontextchanged = params => {
        setHostContext(prev => ({ ...prev, ...params }))
      }
    }
  })

  // Seed initial host context after connection
  useEffect(() => {
    if (app) {
      setHostContext(app.getHostContext())
    }
  }, [app])

  const [selectedSource, setSelectedSource] = useState<
    PointIndex | 'bar' | null
  >(null)
  const [validDestinations, setValidDestinations] = useState<readonly MoveTo[]>(
    []
  )

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
  const remainingMoves = gameState?.remainingMoves ?? []

  // Can end turn when: all dice used, no valid moves, OR game is over (to acknowledge)
  const canEndTurn =
    (phase === 'moving' &&
      (remainingMoves.length === 0 || validMoves.length === 0)) ||
    phase === 'game_over'

  // Automatically applies theme, variables, and fonts from host context
  useHostStyles(app, app?.getHostContext())

  // Apply safe area insets for devices with notches or system UI
  useEffect(() => {
    if (hostContext?.safeAreaInsets) {
      const { top, right, bottom, left } = hostContext.safeAreaInsets
      document.documentElement.style.setProperty(
        '--safe-area-top',
        `${top.toString()}px`
      )
      document.documentElement.style.setProperty(
        '--safe-area-right',
        `${right.toString()}px`
      )
      document.documentElement.style.setProperty(
        '--safe-area-bottom',
        `${bottom.toString()}px`
      )
      document.documentElement.style.setProperty(
        '--safe-area-left',
        `${left.toString()}px`
      )
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
  const humanControlled = useMemo(() => deriveHumanControlled(config), [config])
  const lastAction = useMemo(
    () => (gameState ? selectLastAction({ game: gameState }) : null),
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

  // Wire button clicks to MCP tool calls (view-only tools for human player)
  const handleRollClick = useCallback(() => {
    if (!app) return
    const doRoll = async (): Promise<void> => {
      const result = await app.callServerTool({
        name: 'view_roll_dice',
        arguments: {}
      })
      const content = result.structuredContent as
        | BackgammonStructuredContent
        | undefined
      if (content) {
        setToolResult({ structuredContent: content })
        // If turn was forfeited (no valid moves), notify model it's their turn
        if (content.turnSummary && content.gameState.currentPlayer) {
          // The player who just finished is the opposite of current player
          const finishedPlayer =
            content.gameState.currentPlayer === 'white' ? 'Black' : 'White'

          // Check if host supports model context updates
          const caps = app.getHostCapabilities()
          if (caps?.updateModelContext) {
            try {
              await app.updateModelContext({
                content: [{ type: 'text', text: content.turnSummary }]
              })
            } catch (e) {
              setErrorMessage(
                `Failed to update model context: ${e instanceof Error ? e.message : String(e)}`
              )
            }
          } else {
            setErrorMessage('Host does not support updateModelContext')
          }

          // Send brief trigger message
          await app.sendMessage({
            role: 'user',
            content: [{ type: 'text', text: `${finishedPlayer} turn over.` }]
          })
        }
      }
    }
    void doRoll()
  }, [app])

  const handleEndTurnClick = useCallback(() => {
    if (!app) return
    const doEndTurn = async (): Promise<void> => {
      // If game is over, just notify model without calling view_end_turn
      if (phase === 'game_over') {
        const winner = gameState?.result?.winner
        const winnerName = winner
          ? winner.charAt(0).toUpperCase() + winner.slice(1)
          : 'Unknown'
        await app.sendMessage({
          role: 'user',
          content: [{ type: 'text', text: `Game over. ${winnerName} wins!` }]
        })
        return
      }

      const result = await app.callServerTool({
        name: 'view_end_turn',
        arguments: {}
      })
      const content = result.structuredContent as
        | BackgammonStructuredContent
        | undefined
      if (!content) {
        setErrorMessage('view_end_turn returned no structured content')
        return
      }
      if (!content.turnSummary) {
        setErrorMessage('view_end_turn returned no turn summary')
        return
      }
      if (!content.gameState.currentPlayer) {
        setErrorMessage('view_end_turn returned no current player')
        return
      }
      setToolResult({ structuredContent: content })
      // The player who just finished is the opposite of current player
      const finishedPlayer =
        content.gameState.currentPlayer === 'white' ? 'Black' : 'White'

      // Check if host supports model context updates
      const caps = app.getHostCapabilities()
      if (caps?.updateModelContext) {
        try {
          await app.updateModelContext({
            content: [{ type: 'text', text: content.turnSummary }]
          })
        } catch (e) {
          setErrorMessage(
            `Failed to update model context: ${e instanceof Error ? e.message : String(e)}`
          )
        }
      } else {
        setErrorMessage('Host does not support updateModelContext')
      }

      // Send brief trigger message
      await app.sendMessage({
        role: 'user',
        content: [{ type: 'text', text: `${finishedPlayer} turn over.` }]
      })
    }
    void doEndTurn()
  }, [app, phase, gameState])

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

        if (destination && app) {
          const doMove = async (): Promise<void> => {
            const result = await app.callServerTool({
              name: 'view_make_move',
              arguments: {
                from: selectedSource,
                to: pointIndex,
                dieUsed: destination.dieValue
              }
            })
            if (result.structuredContent) {
              setToolResult({
                structuredContent:
                  result.structuredContent as BackgammonStructuredContent
              })
            }
          }
          void doMove()
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

      if (destination && app) {
        const doBearOff = async (): Promise<void> => {
          const result = await app.callServerTool({
            name: 'view_make_move',
            arguments: {
              from: selectedSource,
              to: 'off',
              dieUsed: destination.dieValue
            }
          })
          if (result.structuredContent) {
            setToolResult({
              structuredContent:
                result.structuredContent as BackgammonStructuredContent
            })
          }
        }
        void doBearOff()
      }
    },
    [phase, selectedSource, validDestinations, validMoves, app]
  )

  // Show loading state when no game state is available
  if (!gameState) {
    return <div className="waiting">Loading game board...</div>
  }

  return (
    <>
      {errorMessage && <div className="error-toast">{errorMessage}</div>}
      <BoardView
        gameState={gameState}
        selectedSource={selectedSource}
        validDestinations={validDestinations}
        validMoves={validMoves}
        canEndTurn={canEndTurn}
        humanControlled={humanControlled}
        lastAction={lastAction}
        onPointClick={handlePointClick}
        onBarClick={handleBarClick}
        onBorneOffClick={handleBorneOffClick}
        onRollClick={handleRollClick}
        onEndTurnClick={handleEndTurnClick}
      />
      {logMessage && <div className="log-toast">{logMessage}</div>}
    </>
  )
}

function deriveHumanControlled(config: GameConfig): Player | 'both' | null {
  if (config.whiteControl === 'human' && config.blackControl === 'human')
    return 'both'
  if (config.whiteControl === 'human') return 'white'
  if (config.blackControl === 'human') return 'black'
  return null // AI vs AI - spectator mode
}
