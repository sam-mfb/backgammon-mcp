# MCP App Implementation Plan

This document outlines the plan for converting the backgammon MCP server into a full MCP App with interactive UI support.

## Overview

Transform `packages/mcp-server/` into an MCP App that provides an interactive backgammon UI via the MCP Apps protocol. The viewer will use host CSS variables with fallbacks, tools will return `structuredContent` with game state, and controls will support AI vs human gameplay modes.

### Architecture Principles

- **viewer/** = UI components (BoardView, Controls, etc.) - the source of truth for all game UI
- **mcp-server/** = MCP server + thin shim that wires viewer to MCP tool calls
- **Separation of concerns**: The viewer remains game-logic agnostic; mcp-server provides the MCP integration layer

---

## Phase 0: Action History (packages/game/, packages/viewer/, packages/web-app/)

### Goal
Add a flat history of atomic game actions to GameState. This enables:
- Deriving "last action" for UI highlighting
- Future undo/replay functionality
- Complete game recreation from history (captures all non-determinism: dice + decisions)

### File: `packages/game/src/types.ts`

Add new discriminated union type for atomic actions:

```typescript
/**
 * Atomic game action - captures all non-deterministic events
 * (dice rolls and player decisions)
 */
export type GameAction =
  | {
      readonly type: 'game_start'
      readonly firstPlayer: Player
      readonly whiteRoll: DieValue
      readonly blackRoll: DieValue
    }
  | {
      readonly type: 'dice_roll'
      readonly player: Player
      readonly roll: DiceRoll
      readonly turnForfeited: boolean  // True if no legal moves available
    }
  | {
      readonly type: 'piece_move'
      readonly player: Player
      readonly from: MoveFrom
      readonly to: MoveTo
      readonly dieUsed: DieValue
      readonly hit: boolean
    }
  | {
      readonly type: 'turn_end'
      readonly player: Player
    }
```

Update `GameState` interface:
```typescript
export interface GameState {
  // ... existing fields ...

  /** Chronological history of all game actions (for replay/undo) */
  readonly actionHistory: readonly GameAction[]
}
```

### File: `packages/game/src/reducer.ts`

Update reducer to append actions to `actionHistory`:
- `performStartGame` → append `game_start` action
- `performRollDice` → append `dice_roll` action
- `performMove` → append `piece_move` action
- `performEndTurn` → append `turn_end` action

### File: `packages/game/src/selectors.ts`

Add selector for last action:
```typescript
export function selectLastAction(state: GameState): GameAction | null {
  const { actionHistory } = state
  return actionHistory.length > 0 ? actionHistory[actionHistory.length - 1] : null
}
```

### File: `packages/viewer/src/BoardView.tsx`

Add optional prop for highlighting last action:
```typescript
interface BoardViewProps {
  // ... existing props ...
  /** Last action for highlighting (optional) */
  lastAction?: GameAction | null
}
```

Pass to child components for visual highlighting:
- `piece_move` → highlight source and destination points
- `dice_roll` → could animate dice (future)

### File: `packages/viewer/src/components/Point.tsx` (or similar)

Add CSS classes for last-move highlighting:
- `.point--last-move-source`
- `.point--last-move-destination`

### File: `packages/viewer/src/BoardView.css`

Add styles for last-move highlighting:
```css
.point--last-move-source .point__triangle,
.point--last-move-destination .point__triangle {
  filter: brightness(1.2);
  box-shadow: inset 0 0 10px var(--bgv-last-move-highlight, rgba(255, 200, 0, 0.4));
}
```

### File: `packages/web-app/src/CouchGame.tsx`

Use the new selector and pass to BoardView:
```typescript
const lastAction = selectLastAction(gameState)

<BoardView
  gameState={gameState}
  lastAction={lastAction}
  // ... other props
/>
```

### Deliverables
- [ ] `GameAction` discriminated union type in `types.ts`
- [ ] `actionHistory` field added to `GameState`
- [ ] Reducer appends actions to history
- [ ] `selectLastAction` selector
- [ ] `lastAction` prop on BoardView
- [ ] Last-move highlighting CSS
- [ ] web-app uses lastAction for highlighting

---

## Phase 1: CSS Variables (packages/viewer/)

### Goal
Replace hardcoded colors with CSS custom properties that map to host variables with fallbacks. This enables host theming while maintaining visual consistency when no host styles are provided.

### File: `packages/viewer/src/BoardView.css`

Add a `:root` block at the top with semantic CSS variables:

```css
:root {
  /* UI chrome - map to host variables */
  --bgv-bg-primary: var(--color-background-primary, #2d2d2d);
  --bgv-bg-secondary: var(--color-background-secondary, #3d3d3d);
  --bgv-text-primary: var(--color-text-primary, #fff);
  --bgv-text-secondary: var(--color-text-secondary, #999);
  --bgv-text-muted: var(--color-text-tertiary, #666);
  --bgv-accent: var(--color-accent-primary, #4a90d9);
  --bgv-accent-hover: var(--color-accent-primary-hover, #5aa0e9);
  --bgv-font-family: var(--font-sans, system-ui, sans-serif);

  /* Board theming - also host-customizable */
  --bgv-board-primary: var(--color-surface-primary, #8b4513);
  --bgv-board-border: var(--color-border-primary, #5c2e0a);
  --bgv-point-odd: var(--color-surface-secondary, #d4a574);
  --bgv-point-even: var(--color-surface-tertiary, #8b6914);

  /* Checkers */
  --bgv-checker-white-bg: var(--color-checker-white, linear-gradient(145deg, #fff, #e0e0e0));
  --bgv-checker-white-border: var(--color-checker-white-border, #ccc);
  --bgv-checker-black-bg: var(--color-checker-black, linear-gradient(145deg, #333, #1a1a1a));
  --bgv-checker-black-border: var(--color-checker-black-border, #444);

  /* Dice */
  --bgv-die-bg: var(--color-die-background, #f5f5f5);
  --bgv-die-text: var(--color-die-text, #1a1a1a);

  /* Interactive states */
  --bgv-selection-color: var(--color-selection, #4a90d9);
  --bgv-valid-move-color: var(--color-valid-move, rgba(74, 200, 100, 0.6));
}
```

### Replacements

| Original | Variable |
|----------|----------|
| `#2d2d2d` | `var(--bgv-bg-primary)` |
| `#3d3d3d` | `var(--bgv-bg-secondary)` |
| `#fff` (text) | `var(--bgv-text-primary)` |
| `#999` | `var(--bgv-text-secondary)` |
| `#666` | `var(--bgv-text-muted)` |
| `#4a90d9` | `var(--bgv-accent)` |
| `#5aa0e9` | `var(--bgv-accent-hover)` |
| `#8b4513` | `var(--bgv-board-primary)` |
| `#5c2e0a` | `var(--bgv-board-border)` |
| `#d4a574` | `var(--bgv-point-odd)` |
| `#8b6914` | `var(--bgv-point-even)` |

### Deliverables
- [ ] Updated `BoardView.css` with CSS custom properties
- [ ] Existing web-app should look identical (fallbacks match original values)
- [ ] Viewer tests pass

---

## Phase 2: Viewer Props for AI Control (packages/viewer/)

### Goal
Add ability to disable controls when it's an AI player's turn. Controls remain visible but disabled (grayed out).

### File: `packages/viewer/src/BoardView.tsx`

Add new prop:
```typescript
interface BoardViewProps {
  // ... existing props
  /** Which player(s) the UI controls. 'white', 'black', 'both', or null (spectator mode) */
  humanControlled?: Player | 'both' | null
}
```

Derive `isHumanTurn`:
```typescript
const isHumanTurn =
  humanControlled === undefined ||
  humanControlled === 'both' ||
  humanControlled === currentPlayer;
```

Conditionally disable interactions:
```typescript
<BoardSurface
  // ... existing props
  onPointClick={isHumanTurn ? onPointClick : undefined}
  onBarClick={isHumanTurn ? onBarClick : undefined}
  onBorneOffClick={isHumanTurn ? onBorneOffClick : undefined}
/>
<Controls
  // ... existing props
  disabled={!isHumanTurn}
/>
```

### File: `packages/viewer/src/components/Controls.tsx`

Add `disabled` prop:
```typescript
interface ControlsProps {
  // ... existing props
  /** When true, all controls are disabled (opponent's turn or AI playing) */
  disabled?: boolean
}
```

When `disabled` is true:
- Add `disabled` attribute to both buttons (Roll Dice, End Turn)
- Optionally show "Waiting for opponent..." message

### Deliverables
- [ ] `BoardView.tsx` with `humanControlled` prop
- [ ] `Controls.tsx` with `disabled` prop
- [ ] Backward compatible (default behavior unchanged when prop not provided)

---

## Phase 3: structuredContent in Tool Responses (packages/mcp-server/)

### Goal
Tools return both text `content` (for model context / non-App hosts) and `structuredContent` (for UI rendering).

### File: `packages/mcp-server/src/server.ts`

Define structured content type:
```typescript
interface BackgammonStructuredContent {
  gameState: GameState  // Includes actionHistory, from which lastAction is derived
  validMoves?: AvailableMoves[]  // Included when in moving phase
}
```

Note:
- `config` (player control settings) is only returned by `backgammon_start_game` and `backgammon_get_game_state`. The shim stores it locally.
- `lastAction` is derived from `gameState.actionHistory` using `selectLastAction` - no need to send it separately.

Create helper:
```typescript
function gameResponse(
  text: string,
  structured: BackgammonStructuredContent
): { content: { type: 'text'; text: string }[]; structuredContent: BackgammonStructuredContent } {
  return {
    content: [{ type: 'text' as const, text }],
    structuredContent: structured
  }
}
```

### Text Content Guidelines

**Remove ASCII board from action tool responses.** Text `content` should be concise:

```typescript
// backgammon_start_game
"Game started. White goes first with 4-2."

// backgammon_roll_dice
"Rolled 5-3."
// Or if no moves: "Rolled 2-1. No legal moves - turn forfeited."

// backgammon_make_move
"Moved 13 → 9 using 4."
// Or with hit: "Moved 8 → 3 using 5 (hit!)."
// Or bearing off: "Bore off from 2 using 2."

// backgammon_end_turn
"Turn ended. Black to roll."

// backgammon_reset_game
"Game reset."
```

**Keep ASCII board only in `backgammon_get_game_state`** - this is the explicit "show me the board" tool for when the LLM needs to understand the position.

### Tools to Update
- [ ] `backgammon_start_game` - concise text, include config in structuredContent
- [ ] `backgammon_roll_dice` - concise text, no ASCII board
- [ ] `backgammon_make_move` - concise text, no ASCII board
- [ ] `backgammon_end_turn` - concise text, no ASCII board
- [ ] `backgammon_get_game_state` - keep ASCII board, include config (recovery mechanism)
- [ ] `backgammon_reset_game` - concise text

### Deliverables
- [ ] All game tools return `structuredContent` with gameState and validMoves
- [ ] Text `content` is concise (no ASCII board except get_game_state)
- [ ] Non-App hosts continue to work (text-only fallback)

---

## Phase 4: Player Control Configuration (packages/mcp-server/)

### Goal
Allow `backgammon_start_game` to specify which players are human vs AI controlled.

### File: `packages/mcp-server/src/store.ts`

Add config to server state:
```typescript
interface ServerState {
  game: GameState
  config: GameConfig
}

const initialConfig: GameConfig = {
  whiteControl: 'human',
  blackControl: 'ai'
}
```

Add action to set config:
```typescript
setGameConfig: (state, action: PayloadAction<GameConfig>) => {
  state.config = action.payload
}
```

### File: `packages/mcp-server/src/server.ts`

Update `backgammon_start_game` tool schema:
```typescript
server.tool(
  'backgammon_start_game',
  'Start a new backgammon game...',
  {
    whiteControl: z.enum(['human', 'ai']).optional().default('human')
      .describe("Who controls white: 'human' (UI) or 'ai' (model)"),
    blackControl: z.enum(['human', 'ai']).optional().default('ai')
      .describe("Who controls black: 'human' (UI) or 'ai' (model)")
  },
  ({ whiteControl, blackControl }) => {
    const config = { whiteControl, blackControl }
    store.dispatch(setGameConfig(config))
    // ... existing start logic

    // Only start_game includes config in structuredContent
    return {
      content: [{ type: 'text', text: `Game started. ${firstPlayer} goes first with ${die1}-${die2}.` }],
      structuredContent: {
        gameState: store.getState().game,
        validMoves: getValidMoves({ state: store.getState().game }),
        config  // Only included here, shim stores it
      },
      _meta: { ui: { resourceUri: RESOURCE_URI } }
    }
  }
)
```

### Deliverables
- [ ] `store.ts` with GameConfig state
- [ ] `backgammon_start_game` accepts player control parameters
- [ ] Config included in `backgammon_start_game` structuredContent only (shim stores it)

---

## Phase 5: MCP App Client (packages/mcp-server/)

### Goal
Create a thin MCP SDK wrapper that wires the viewer's BoardView to tool calls. Bundled as single HTML file served as MCP resource.

### New Directory Structure

```
packages/mcp-server/
├── src/
│   ├── client/
│   │   ├── index.html       # HTML template
│   │   ├── main.tsx         # Entry point with host styling
│   │   └── McpAppShim.tsx   # Thin wrapper connecting BoardView to MCP
│   ├── server.ts            # Existing (add resource registration)
│   └── store.ts             # Existing
├── vite.config.client.ts    # Vite config for single-file bundle
└── package.json             # Add dependencies
```

### File: `packages/mcp-server/src/client/index.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Backgammon</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="./main.tsx"></script>
</body>
</html>
```

### File: `packages/mcp-server/src/client/main.tsx`

```typescript
import { createRoot } from 'react-dom/client'
import { McpAppShim } from './McpAppShim'
import '@backgammon/viewer/BoardView.css'

const root = document.getElementById('root')
if (root) {
  createRoot(root).render(<McpAppShim />)
}
```

### File: `packages/mcp-server/src/client/McpAppShim.tsx`

This thin shim:
1. Uses MCP SDK's `useApp` hook to receive tool results
2. Applies host styling (theme, CSS variables, fonts)
3. Passes game state from `structuredContent` to `BoardView`
4. Wires button clicks to `app.callServerTool()` calls

```typescript
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
  type AvailableMoves
} from '@backgammon/game'
import { useState, useEffect, useCallback, useRef } from 'react'

type GameConfig = { whiteControl: 'human' | 'ai'; blackControl: 'human' | 'ai' }

interface BackgammonStructuredContent {
  gameState: GameState
  validMoves?: AvailableMoves[]
  config?: GameConfig  // Present in start_game and get_game_state responses
}

export function McpAppShim(): React.JSX.Element {
  const { app, toolResult, hostContext, error } = useApp<BackgammonStructuredContent>({
    appInfo: { name: 'Backgammon', version: '1.0.0' },
    capabilities: {}
  })

  const [selectedSource, setSelectedSource] = useState<PointIndex | 'bar' | null>(null)
  const [validDestinations, setValidDestinations] = useState<readonly MoveTo[]>([])
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Store config from start_game/get_game_state, persists across subsequent tool results
  const configRef = useRef<GameConfig>({ whiteControl: 'human', blackControl: 'ai' })

  // Apply host styling when context changes
  useEffect(() => {
    if (hostContext?.theme) applyDocumentTheme(hostContext.theme)
    if (hostContext?.styles?.variables) applyHostStyleVariables(hostContext.styles.variables)
    if (hostContext?.styles?.css?.fonts) applyHostFonts(hostContext.styles.css.fonts)
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

  const structuredContent = toolResult?.structuredContent

  if (!structuredContent?.gameState) {
    return <div className="waiting">Waiting for game to start...</div>
  }

  const { gameState, validMoves } = structuredContent
  const humanControlled = deriveHumanControlled(configRef.current)
  const lastAction = selectLastAction(gameState)

  // Wire button clicks to MCP tool calls
  const handleRollClick = useCallback(() => {
    app?.callServerTool({ name: 'backgammon_roll_dice', arguments: {} })
  }, [app])

  const handleEndTurnClick = useCallback(() => {
    app?.callServerTool({ name: 'backgammon_end_turn', arguments: {} })
  }, [app])

  // Selection and move handling (similar to CouchGame logic)
  // ... point/bar/borne-off click handlers that call backgammon_make_move

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

function deriveHumanControlled(config: GameConfig): Player | 'both' | null {
  if (config.whiteControl === 'human' && config.blackControl === 'human') return 'both'
  if (config.whiteControl === 'human') return 'white'
  if (config.blackControl === 'human') return 'black'
  return null // AI vs AI - spectator mode
}
```

### Deliverables
- [ ] `client/index.html` template
- [ ] `client/main.tsx` entry point
- [ ] `client/McpAppShim.tsx` connecting BoardView to MCP

---

## Phase 6: Build Configuration & Resource Registration

### Goal
Configure Vite to bundle client as single HTML file, register as MCP resource.

### File: `packages/mcp-server/vite.config.client.ts`

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

export default defineConfig({
  root: 'src/client',
  plugins: [react(), viteSingleFile()],
  build: {
    target: 'esnext',
    outDir: '../../dist/client',
    emptyDirFirst: true
  }
})
```

### File: `packages/mcp-server/package.json` (additions)

```json
{
  "dependencies": {
    "@backgammon/game": "workspace:*",
    "@backgammon/viewer": "workspace:*",
    "@modelcontextprotocol/ext-apps": "^1.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.55",
    "@types/react-dom": "^18.2.19",
    "@vitejs/plugin-react": "^4.x.x",
    "vite": "^5.x.x",
    "vite-plugin-singlefile": "^2.x.x"
  },
  "scripts": {
    "build": "pnpm build:client && pnpm build:server",
    "build:client": "vite build --config vite.config.client.ts",
    "build:server": "tsc"
  }
}
```

### File: `packages/mcp-server/src/server.ts` (resource registration)

```typescript
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const RESOURCE_URI = 'ui://backgammon/board'

// Register UI resource
server.resource(
  RESOURCE_URI,
  'Interactive backgammon board',
  async () => {
    const htmlPath = join(__dirname, '../dist/client/index.html')
    const html = readFileSync(htmlPath, 'utf-8')
    return {
      contents: [{
        uri: RESOURCE_URI,
        mimeType: 'text/html',
        text: html
      }]
    }
  }
)

// Add _meta.ui to tools
server.tool(
  'backgammon_start_game',
  // ...
  async (args) => {
    return {
      ...gameResponse(text, structuredContent),
      _meta: { ui: { resourceUri: RESOURCE_URI } }
    }
  }
)
```

### Deliverables
- [ ] `vite.config.client.ts` build config
- [ ] Updated `package.json` with dependencies and scripts
- [ ] Resource registration in `server.ts`
- [ ] `_meta.ui.resourceUri` added to tool responses

---

## Summary: Files to Modify

| File | Phase | Changes |
|------|-------|---------|
| `packages/game/src/types.ts` | 0 | `GameAction` union, `actionHistory` in GameState |
| `packages/game/src/reducer.ts` | 0 | Append actions to history |
| `packages/game/src/selectors.ts` | 0 | `selectLastAction` selector |
| `packages/viewer/src/BoardView.css` | 0, 1 | Last-move highlighting, CSS custom properties |
| `packages/viewer/src/BoardView.tsx` | 0, 2 | `lastAction` prop, `humanControlled` prop |
| `packages/viewer/src/components/Controls.tsx` | 2 | `disabled` prop |
| `packages/web-app/src/CouchGame.tsx` | 0 | Use `selectLastAction`, pass to BoardView |
| `packages/mcp-server/src/server.ts` | 3, 4, 6 | structuredContent, player config, resource registration |
| `packages/mcp-server/src/store.ts` | 4 | GameConfig state |
| `packages/mcp-server/package.json` | 6 | Dependencies and build scripts |

## Summary: New Files to Create

| File | Phase | Purpose |
|------|-------|---------|
| `packages/mcp-server/src/client/index.html` | 5 | HTML template |
| `packages/mcp-server/src/client/main.tsx` | 5 | React entry point |
| `packages/mcp-server/src/client/McpAppShim.tsx` | 5 | MCP SDK wrapper |
| `packages/mcp-server/vite.config.client.ts` | 6 | Client build config |

---

## Verification

### Phase 0 Verification
```bash
# Run game tests
pnpm --filter @backgammon/game test

# Verify actionHistory is populated
# Start web-app, play a few moves, check Redux DevTools for actionHistory

# Verify last-move highlighting in web-app
pnpm --filter @backgammon/web-app dev
# Make moves and verify source/destination highlighting
```

### Build Test
```bash
cd packages/mcp-server
pnpm build
# Should produce:
# - dist/client/index.html (single file, ~500KB)
# - dist/server.js
```

### Unit Tests
- Existing game tests pass with new actionHistory field
- Add test for `selectLastAction` selector
- Existing viewer tests pass (CSS variables are transparent)
- Add test for Controls with `disabled={true}`
- Add test for BoardView with `humanControlled` and `lastAction` props

### Integration Test
1. Start server: `pnpm --filter @backgammon/mcp-server start`
2. Connect with MCP client that supports Apps (e.g., Claude Desktop)
3. Call `backgammon_start_game` with `{ whiteControl: 'human', blackControl: 'ai' }`
4. Verify:
   - UI resource renders the board
   - White's controls are active on white's turn
   - Black's turn shows disabled controls
   - Clicking roll/move/end-turn triggers server tool calls
   - structuredContent updates the board view
5. Test AI v. AI mode (`{ whiteControl: 'ai', blackControl: 'ai' }`) - all controls disabled
6. Test fallback: non-App host sees text content with ASCII board
