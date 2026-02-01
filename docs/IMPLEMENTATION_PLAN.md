# Backgammon MCP Implementation Plan

## Overview

This document describes the architecture and staged implementation plan for a backgammon game that supports three play modes:

1. **Couch Play**: Two humans play locally via `npm run dev` — pass the device back and forth

2. **LLM Tool-Only**: Human plays against an LLM using MCP tools, text-based interaction
   - LLM displays board state as ASCII art in chat
   - User types commands like "roll", "move 8 to 5"
   - Works with any MCP client (no MCP App support required)
   - Great for experimenting and clients that don't support MCP Apps yet

3. **LLM MCP App**: Human plays against an LLM with an interactive graphical board
   - Board renders directly in the chat as an MCP App
   - User clicks to roll dice, select checkers, make moves
   - Requires MCP App-compatible host (Claude Desktop, claude.ai, VS Code Insiders, etc.)

**Rules Reference**: See [docs/BACKGAMMON_RULES.md](./BACKGAMMON_RULES.md) for complete backgammon rules.

**MCP Apps Specification**: See [docs/MCP_APPS_SPEC.md](./MCP_APPS_SPEC.md) for the official MCP Apps spec (SEP-1865). This is a local copy for offline reference; check the [source](https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/2026-01-26/apps.mdx) for updates.

**Scope**: This implementation covers standard backgammon rules for single games. It does NOT include the doubling cube, match play, or optional gambling rules. See [Out of Scope](#out-of-scope-do-not-implement) in Stage 1.

---

## Part A: Final System Architecture

### Directory Structure

```
backgammon-mcp/
├── src/
│   ├── game/                    # Core game logic (shared)
│   │   ├── types.ts             # Type definitions
│   │   ├── gameSlice.ts         # State management (Redux-style)
│   │   ├── rules.ts             # Move validation, legal moves
│   │   └── index.ts
│   │
│   ├── viewer/                  # Pure display components (shared)
│   │   ├── BoardView.tsx        # Main board component
│   │   ├── BoardView.css        # Styles
│   │   ├── components/          # Sub-components
│   │   └── index.ts
│   │
│   ├── app/                     # Couch Play mode
│   │   ├── main.tsx             # Entry point
│   │   ├── App.tsx              # Redux provider
│   │   ├── CouchGame.tsx        # Two-player local game
│   │   ├── store.ts             # Redux store
│   │   └── index.css
│   │
│   ├── mcp-server/              # MCP Server (tools + game state)
│   │   ├── server.ts            # MCP server setup, tool registration
│   │   ├── gameManager.ts       # Server-side game state management
│   │   ├── tools/               # Individual tool implementations
│   │   │   ├── startGame.ts
│   │   │   ├── rollDice.ts
│   │   │   ├── makeMove.ts
│   │   │   ├── endTurn.ts
│   │   │   ├── getGameState.ts
│   │   │   └── getRules.ts      # Fetch rules for LLM reference
│   │   └── index.ts
│   │
│   └── mcp-app/                 # MCP App UI (renders in MCP host)
│       ├── mcp-app.html         # HTML entry point
│       ├── mcp-app.ts           # App class integration
│       ├── McpBoardView.tsx     # Board + interactive controls
│       └── vite.config.ts       # Bundles to single HTML file
│
├── vite.config.ts               # Config for couch play app
├── package.json
└── tsconfig.json
```

### Dependency Flow

```
                    ┌─────────────────┐
                    │     game/       │
                    │  (types, rules, │
                    │   state logic)  │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
      ┌───────────┐  ┌─────────────┐  ┌───────────┐
      │  viewer/  │  │ mcp-server/ │  │           │
      │  (React   │  │ (tools,     │  │           │
      │   board)  │  │  game mgr)  │  │           │
      └─────┬─────┘  └─────────────┘  │           │
            │                         │           │
     ┌──────┴──────┐                  │           │
     │             │                  │           │
     ▼             ▼                  │           │
┌─────────┐  ┌──────────┐             │           │
│  app/   │  │ mcp-app/ │◄────────────┘           │
│ (couch) │  │ (claude) │                         │
└─────────┘  └──────────┘                         │
                  │                               │
                  │     ┌─────────────────────────┘
                  │     │
                  ▼     ▼
            ┌─────────────┐
            │ MCP Server  │
            │ (HTTP/MCP)  │
            └─────────────┘
```

### Key Design Principles

1. **`game/` is pure logic**: No React, no MCP, no side effects. Just types, state transitions, and rule validation.

2. **`viewer/` is pure display**: Receives `GameState` as props, renders board. No knowledge of how state is managed.

3. **`app/` owns couch-play orchestration**: Redux store, turn management for two local players, passes state to viewer.

4. **`mcp-server/` owns LLM-play orchestration**: Holds authoritative game state, exposes tools, validates moves.

5. **`mcp-app/` is a thin UI shell**: Receives state from tool results, renders viewer, sends user actions as tool calls.

### MCP Apps Specification Compliance

Key points to ensure compliance with the MCP Apps spec (`io.modelcontextprotocol/ui`). For full details, see [docs/MCP_APPS_SPEC.md](./MCP_APPS_SPEC.md).

1. **Data flows via `ui/notifications/tool-result`**: The MCP App receives game state through tool results, not a separate context push. The Host sends `ui/notifications/tool-result` containing the full `CallToolResult` after each tool call.

2. **Three-part tool returns** (per spec's "Data Passing" best practices):
   - `content`: ASCII board text (added to model context, LLM sees this)
   - `structuredContent`: Full `GameState` object (NOT added to model context, UI uses this)
   - `_meta.ui`: Resource URI for Host to know which UI renders this result

3. **MIME type**: UI resources must register with `mimeType: "text/html;profile=mcp-app"`

4. **State sync for LLM-initiated calls**: When the LLM calls tools directly, the Host pushes `ui/notifications/tool-result` to the App. The App uses `structuredContent` from these notifications to stay in sync. Include a "Refresh" button as fallback.

5. **Official SDK**: Use `@modelcontextprotocol/ext-apps` for postMessage communication rather than implementing JSON-RPC manually.

---

## Part B: Communication Flows

### Flow 1: Couch Play (Two Local Players)

```
┌──────────────────────────────────────────────────────────┐
│  Browser (npm run dev)                                   │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │  App.tsx (Redux Provider)                          │  │
│  │  ┌──────────────────────────────────────────────┐  │  │
│  │  │  CouchGame.tsx                               │  │  │
│  │  │  - useSelector(state.game)                   │  │  │
│  │  │  - useDispatch()                             │  │  │
│  │  │  - Turn management UI                        │  │  │
│  │  │  ┌────────────────────────────────────────┐  │  │  │
│  │  │  │  BoardView (props: gameState)          │  │  │  │
│  │  │  │  - Displays board                      │  │  │  │
│  │  │  │  - onClick handlers → callbacks        │  │  │  │
│  │  │  └────────────────────────────────────────┘  │  │  │
│  │  └──────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────┘  │
│                           │                              │
│                           ▼                              │
│  ┌────────────────────────────────────────────────────┐  │
│  │  Redux Store                                       │  │
│  │  - game: GameState                                 │  │
│  │  - Reducers from game/gameSlice.ts                 │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

**User Interaction Flow:**

1. White player clicks "Roll Dice" button
2. CouchGame dispatches `rollDice()` action
3. Redux updates state with dice values
4. BoardView re-renders showing dice
5. White clicks on a checker, then a destination
6. CouchGame validates move using `game/rules.ts`
7. CouchGame dispatches `makeMove()` action
8. Board updates, repeat until turn complete
9. White clicks "End Turn"
10. CouchGame dispatches `endTurn()`, switches to black
11. Black player takes over (same device, different person)

### Flow 2: LLM Tool-Only (Text-Based, No MCP App)

````
┌─────────────────────────────────────────────────────────────────┐
│  MCP Host (Claude Desktop, Cursor, etc.)                         │
│                                                                  │
│  User: "Let's play backgammon"                                  │
│  LLM: "Starting a new game..." [calls start-game]               │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Tool Result (displayed as text/markdown)                 │  │
│  │  ```                                                      │  │
│  │  Game started. You are White.                             │  │
│  │  Board:                                                   │  │
│  │  13 14 15 16 17 18 | B | 19 20 21 22 23 24               │  │
│  │   o        o  o  o |   |  x  x  x        x  x            │  │
│  │   o        o  o  o |   |  x                              │  │
│  │            o  o    |   |  x                              │  │
│  │                    |   |  x                              │  │
│  │            x  x    |   |  o                              │  │
│  │   x        x  x  x |   |  o                              │  │
│  │   x        x  x  x |   |  o  o  o        o  o            │  │
│  │  12 11 10  9  8  7 | B |  6  5  4  3  2  1               │  │
│  │  ```                                                      │  │
│  │  Your turn. Say "roll" to roll the dice.                 │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  User: "roll"                                                   │
│  LLM: [calls roll-dice] "You rolled 3-1."                      │
│  User: "move 8 to 5"                                            │
│  LLM: [calls make-move] "Moved. 1 remaining."                  │
│  ...                                                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ MCP Protocol (tools/call)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  MCP Server (localhost:3001/mcp)                                │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  GameManager                                            │    │
│  │  - Holds GameState in memory                            │    │
│  │  - Uses game/rules.ts for validation                    │    │
│  │  - Returns state + ASCII board representation           │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  Tools:                                                         │
│  - start-game: Initialize new game                              │
│  - roll-dice: Roll for current player                           │
│  - make-move: Move a checker                                    │
│  - end-turn: End current player's turn                          │
│  - get-state: Return current game state                         │
└─────────────────────────────────────────────────────────────────┘
````

**Turn Flow:**

1. User says "roll" → LLM calls `roll-dice` tool
2. Tool returns dice values + valid moves in text
3. User says "move 8 to 5" → LLM parses, calls `make-move`
4. Tool validates, applies move, returns updated board
5. User says "done" → LLM calls `end-turn`
6. Now it's the LLM's turn (black)
7. LLM autonomously calls `roll-dice`
8. LLM reasons about position, calls `make-move` (possibly multiple)
9. LLM calls `end-turn`
10. LLM describes what it did, returns to user

### Flow 3: LLM MCP App (Graphical)

```
┌──────────────────────────────────────────────────────────────────────┐
│  MCP Host (Claude Desktop, VS Code Insiders, etc.)                    │
│                                                                       │
│  User: "Let's play backgammon"                                       │
│  LLM: [calls start-game tool]                                        │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │  MCP App (sandboxed iframe)                                     │ │
│  │  ┌───────────────────────────────────────────────────────────┐  │ │
│  │  │            Backgammon Board (BoardView)                   │  │ │
│  │  │                                                           │  │ │
│  │  │   [Interactive board - click to select/move checkers]     │  │ │
│  │  │                                                           │  │ │
│  │  └───────────────────────────────────────────────────────────┘  │ │
│  │  Player: White (You)    Phase: Rolling    Turn: 1               │ │
│  │  [Roll Dice]  [End Turn]                                        │ │
│  │                                                                  │ │
│  │  ─── Communication via postMessage ───                          │ │
│  │  • ontoolresult: receives state updates from LLM tool calls     │ │
│  │  • callServerTool: sends user actions to server                 │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  User: "What's a good move here?"                                    │
│  LLM: "With 3-1, you could make your 5-point..."                    │
│                                                                       │
│  [User clicks checker on point 8, then point 5 in the app]          │
│  [Board updates automatically]                                       │
│                                                                       │
│  User: "Your turn"                                                   │
│  LLM: [calls roll-dice] [calls make-move] "I rolled 6-4..."         │
│  [Board updates with each tool call via ontoolresult]               │
└──────────────────────────────────────────────────────────────────────┘
                              │
                              │ MCP Protocol
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│  MCP Server (same as text-only version)                              │
│                                                                       │
│  Additional:                                                         │
│  - Registers ui:// resource pointing to bundled mcp-app.html        │
│  - Tools include _meta.ui.resourceUri for app rendering             │
└──────────────────────────────────────────────────────────────────────┘
```

**Key Interaction Patterns:**

**User clicks in app:**

```
User clicks [Roll Dice]
  → App: app.callServerTool({ name: "roll-dice" })
  → Server: validates it's user's turn, rolls dice
  → Server: returns { dice: [3, 1], validMoves: [...], state: {...} }
  → Host: pushes result to app
  → App: ontoolresult fires, updates board
```

**User clicks checker to move:**

```
User clicks checker on point 8
  → App: highlights point 8, shows valid destinations
User clicks point 5
  → App: app.callServerTool({ name: "make-move", arguments: { from: 8, to: 5, dieUsed: 3 } })
  → Server: validates, applies, returns new state
  → App: ontoolresult fires, updates board
```

**LLM takes turn:**

```
User says "your turn" or clicks [End Turn]
  → App: app.callServerTool({ name: "end-turn" })
  → Tool returns ASCII board in content (LLM sees current position)
  → LLM: sees it's black's turn from tool result
  → LLM: calls roll-dice → App updates (ontoolresult)
  → LLM: calls make-move → App updates (ontoolresult)
  → LLM: calls end-turn
  → LLM: describes its moves in chat
```

**User asks strategy question:**

```
User types: "Should I hit or make a point?"
  → Normal chat, no tools
  → LLM can see game state (from previous tool results which included ASCII board)
  → LLM responds with strategic advice
```

---

## Part C: Staged Implementation Plan

### Stage 1: Game Rules & Unit Tests ✅ COMPLETED

**Goal**: Implement and thoroughly test backgammon rules in `game/rules.ts` before building any UI.

**Reference**: [docs/BACKGAMMON_RULES.md](./BACKGAMMON_RULES.md) (offline reference based on [USBGF Rules](https://usbgf.org/backgammon-basics-how-to-play/))

#### Out of Scope (Do NOT Implement)

The following features are intentionally excluded from this implementation:

| Feature               | Reason                                                |
| --------------------- | ----------------------------------------------------- |
| **Doubling Cube**     | Gambling/stakes mechanism, not needed for casual play |
| **Automatic Doubles** | Optional gambling rule                                |
| **Beavers**           | Optional gambling rule (immediate redouble)           |
| **Jacoby Rule**       | Optional rule affecting gammon/backgammon scoring     |
| **Crawford Rule**     | Match play rule, we only support single games         |
| **Match Play**        | Playing to N points, only single games supported      |

We DO implement gammon/backgammon victory types (for display purposes) but without stake multipliers.

**Create `src/game/rules.ts`:**

Core validation functions:

- `getValidMoves(state: GameState): AvailableMoves[]`
- `isValidMove(state: GameState, move: Move): boolean`
- `canBearOff(state: GameState, player: Player): boolean`
- `checkGameOver(state: GameState): GameResult | null`
- `getMoveDirection(player: Player): 1 | -1`

**Create `src/game/__tests__/rules.test.ts`:**

Test categories:

**1. Initial Setup**

- Board has correct starting position (2 on 24-pt, 5 on 13-pt, 3 on 8-pt, 5 on 6-pt for white; mirrored for black)
- Each player has exactly 15 checkers
- Bar and borne-off areas start empty

**2. Movement Direction**

- White moves from high points to low (24 → 1)
- Black moves from low points to high (1 → 24)
- Movement distance matches die value exactly

**3. Legal Move Conditions**

- Can move to an empty point
- Can move to a point occupied by own checkers (any number)
- Can move to a point with exactly 1 opponent checker (hit)
- Cannot move to a point with 2+ opponent checkers (blocked)

**4. Dice Usage**

- Each die can move a separate checker
- One checker can use both dice if intermediate point is open
- Doubles allow 4 moves of that value
- Must use both dice if legally possible
- If only one die is playable, must play it
- If either die is playable but not both, must play the higher one
- If no moves possible, turn is forfeit

**5. Bar Entry (Re-entering hit checkers)**

- Checker on bar MUST re-enter before any other move
- Entry point = opponent's home board (white enters on 24-19, black on 1-6)
- Entry point number = die value (roll 3 → enter on point 3 for black, point 22 for white)
- Cannot enter on blocked points (2+ opponent checkers)
- If all entry points blocked, turn is forfeit
- Multiple checkers on bar must all enter before moving others

**6. Hitting**

- Landing on a single opponent checker (blot) sends it to bar
- Hit checker must re-enter from bar
- Can hit during bear-off phase

**7. Bearing Off**

- Can only bear off when ALL 15 checkers are in home board
- Home board = points 1-6 for white, points 19-24 for black
- Exact roll removes checker from that point
- Higher roll can bear off from highest occupied point
- Must move a checker if bearing off isn't possible with that die
- If a checker is hit during bearing off, must re-enter and return to home before continuing

**8. Winning Conditions**

- First player to bear off all 15 checkers wins
- Single game: opponent has borne off at least 1 checker
- Gammon: opponent has not borne off any checkers (2x value)
- Backgammon: opponent has checker on bar or in winner's home board (3x value)

**9. Edge Cases**

- Empty turn (no legal moves after roll)
- Partial turn (only some dice playable)
- Forced moves (only one legal sequence)
- Re-entry hitting a blot

**Test Helpers:**

Create `src/game/__tests__/testUtils.ts`:

- `createGameState(overrides)` - factory for test states
- `createBoardWithCheckers(positions)` - build specific board positions
- `rollSpecificDice(die1, die2)` - deterministic dice for testing

**Add test dependencies and scripts:**

```json
{
  "devDependencies": {
    "vitest": "^1.0.0"
  },
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run"
  }
}
```

**Verification:**

- `npm test` runs all game logic tests
- 100% coverage of `rules.ts`
- All rule edge cases documented and tested
- No UI code touched in this stage

---

### Stage 2: Interactive Viewer & Couch Play ✅ COMPLETED

**Goal**: Two players can play a complete game locally via `npm run dev`, with full click-based interaction.

**Changes to `viewer/`:**

1. Add callback props to `BoardView`:
   - `onPointClick(pointIndex)` - user clicked a point
   - `onBarClick(player)` - user clicked the bar
   - `onBorneOffClick(player)` - user clicked borne-off area
   - `onRollClick()` - user clicked roll button
   - `onEndTurnClick()` - user clicked end turn

2. Add selection state props:
   - `selectedPoint: PointIndex | 'bar' | null`
   - `validDestinations: (PointIndex | 'off')[]`

3. Update `Point.tsx` to:
   - Highlight when selected
   - Highlight valid destinations
   - Call `onPointClick` when clicked

4. Add control buttons to `BoardView`:
   - Roll Dice button (disabled when not in rolling phase)
   - End Turn button (disabled when moves remaining)

5. Keep `BoardView` pure - it receives all state as props, emits all actions as callbacks.

**Changes to `game/`:**

1. Update `gameSlice.ts`:
   - Integrate with `rules.ts` from Stage 1
   - Compute valid moves when dice are rolled
   - Auto-end turn when no moves available

**Changes to `app/`:**

1. Rename `DemoApp.tsx` → `CouchGame.tsx`

2. Rewrite `CouchGame.tsx`:
   - Remove demo step logic
   - Add proper turn flow:
     - Show whose turn it is
     - Roll button → dispatch rollDice with random values
     - Track selected checker in local state
     - On point click → if checker selected and valid destination, dispatch makeMove
     - End turn button → dispatch endTurn
   - Display winner when game over

3. Update `App.tsx` to render `CouchGame`

4. Remove `DemoControls.tsx` and `presetMoves.ts`

**Verification:**

- Run `npm run dev`
- Two people can play a full game
- Click checker to select, click destination to move
- Invalid moves rejected (visual feedback)
- All moves validated against rules.ts
- Game ends correctly, winner displayed

---

### Stage 3: MCP Server (LLM Tool-Only) ✅ COMPLETED

**Goal**: Play backgammon with an LLM via text, no graphical UI in chat.

**Create `src/mcp-server/`:**

> **Important: Tool Return Values (Three Components)**
>
> All game-modifying tools (`startGame`, `rollDice`, `makeMove`, `endTurn`) MUST return three components per the MCP Apps spec:
>
> 1. **`content`**: ASCII board + text summary (for LLM visibility - this IS added to model context)
> 2. **`structuredContent`**: Full `GameState` object (for MCP App UI - NOT added to model context)
> 3. **`_meta.ui`**: Resource URI pointing to `ui://backgammon/board` (tells Host which UI to render)
>
> The MCP App receives the full `CallToolResult` via `ui/notifications/tool-result` and uses `structuredContent` to update its state. Example return structure:
>
> ```typescript
> return {
>   content: [{ type: "text", text: `${summary}\n\n${asciiBoard}` }],
>   structuredContent: {
>     gameState,           // Full GameState for UI
>     validMoves,          // Pre-computed valid moves
>     lastAction: "roll",  // What just happened
>   },
>   _meta: { ui: { uri: "ui://backgammon/board" } },
> };
> ```

1. `gameManager.ts`:
   - Singleton that holds current game state
   - Methods: `startGame()`, `rollDice()`, `makeMove()`, `endTurn()`, `getState()`
   - Uses `game/rules.ts` for validation
   - Returns state + ASCII board representation

2. `asciiBoard.ts`:
   - `renderAsciiBoard(state: GameState): string`
   - Text representation for tool results

3. `tools/startGame.ts`:
   - Input: `{ humanColor?: 'white' | 'black' }`
   - Initializes game, returns board + instructions

4. `tools/rollDice.ts`:
   - Input: none (uses current player)
   - Validates it's rolling phase
   - Returns dice values + valid moves list

5. `tools/makeMove.ts`:
   - Input: `{ from: number | 'bar', to: number | 'off', dieUsed: number }`
   - Validates move
   - Returns updated board + remaining moves

6. `tools/endTurn.ts`:
   - Input: none
   - Ends turn, switches player
   - Returns board + whose turn

7. `tools/getGameState.ts`:
   - Returns full state for context

8. `tools/getRules.ts`:
   - Input: `{ section?: string }` (optional filter)
   - Returns backgammon rules from local `docs/BACKGAMMON_RULES.md`
   - Sections: "movement", "hitting", "bar", "bearing-off", "winning", or full rules
   - Allows LLM to verify rules during gameplay disputes or questions

9. `server.ts`:
   - Uses `McpServer` class from `@modelcontextprotocol/sdk/server/mcp.js`
   - Registers tools using fluent API with **Zod schemas** for input validation:
     ```typescript
     server.tool(
       "make-move",
       "Move a checker from one point to another",
       { from: z.union([z.number(), z.literal("bar")]), to: z.union([z.number(), z.literal("off")]), dieUsed: z.number() },
       async ({ from, to, dieUsed }) => { /* ... */ }
     );
     ```
   - Runs on port 3001 with StreamableHTTPServerTransport

**Add npm scripts:**

```json
{
  "scripts": {
    "dev": "vite",
    "serve:mcp": "tsx src/mcp-server/server.ts"
  }
}
```

**Verification:**

- Run `npm run serve:mcp:text`
- Connect MCP host to `http://localhost:3001/mcp`
- Play a full game via chat commands
- LLM can play its turns autonomously

### Stage 4: MCP App (LLM Graphical)

**Goal**: Interactive board renders in MCP host, user can click to play.

**Use the `create-mcp-app` skill** to scaffold the MCP App structure.

> **Important: Use Official SDK**
>
> Use `@modelcontextprotocol/ext-apps` (or equivalent official library) to handle the JSON-RPC communication over `postMessage`. Implementing this manually is error-prone. The SDK handles the exact `_meta.ui` structure expected by hosts.

**Create `src/mcp-app/`:**

1. `mcp-app.html`:
   - Entry point HTML
   - Loads bundled React app

2. `mcp-app.ts`:
   - Creates `Client` instance from `@modelcontextprotocol/ext-apps`
   - Calls `client.connect()` after window ready
   - Listens to `ui/notifications/tool-result` via SDK's notification handler
   - Extracts `structuredContent.gameState` from each tool result to update React state
   - Renders React app with current `GameState`
   - **Note**: Host pushes `ui/notifications/tool-result` for both App-initiated AND LLM-initiated tool calls, keeping the App in sync automatically.

3. `McpBoardView.tsx`:
   - Wraps `viewer/BoardView`
   - Receives `GameState` from `structuredContent` via props
   - Manages selection state locally (which checker is selected)
   - On user actions, calls `client.callTool()` (e.g., `roll-dice`, `make-move`)
   - Uses `structuredContent.validMoves` to highlight legal destinations
   - **Includes "Refresh" button**: Calls `get-state` tool as fallback if state appears stale

4. `vite.config.mcp-app.ts`:
   - Uses `vite-plugin-singlefile`
   - Outputs single HTML file to `dist/mcp-app.html`

**Update `src/mcp-server/`:**

1. Update `server.ts`:
   - Register UI resource with proper MIME type and metadata:
     ```typescript
     server.registerResource({
       uri: "ui://backgammon/board",
       name: "Backgammon Board",
       description: "Interactive backgammon game board",
       mimeType: "text/html;profile=mcp-app",
       // ... handler returns bundled HTML
     });
     ```
   - Serve bundled HTML from `dist/mcp-app.html`
   - All game-modifying tools include `_meta.ui` (see "Hybrid Return Values" above)

**Add npm scripts:**

```json
{
  "scripts": {
    "build:mcp-app": "INPUT=src/mcp-app/mcp-app.html vite build --config vite.config.mcp-app.ts",
    "serve:mcp": "npm run build:mcp-app && tsx src/mcp-server/server.ts"
  }
}
```

**Verification:**

- Run `npm run serve:mcp`
- Connect MCP host to server
- Say "Let's play backgammon"
- Board renders in chat
- Can click to roll, move, end turn
- LLM's moves update board in real-time
- Can ask strategy questions mid-game

---

### Stage 5: Packaging & Deployment

**Goal**: Bundle all three play modes into a single npm package with clear documentation and CI/CD.

**Create `README.md`:**

Structure:

1. **Overview** - What is backgammon-mcp, the three play modes
2. **Quick Start** - Fastest way to get playing
3. **Play Modes**
   - **Couch Play** - Two humans, one device
     - `npm install && npm run dev`
     - Open browser, pass device back and forth
   - **LLM Tool-Only** - Play via chat with ASCII board
     - `npm install && npm run serve:mcp:text`
     - Add as MCP server in your host
     - Commands: "roll", "move 8 to 5", "end turn"
     - Works with any MCP client
     - Good for experimenting or clients without MCP App support
   - **LLM MCP App** - Interactive graphical board in chat
     - `npm install && npm run serve:mcp`
     - Add as MCP server in your host
     - Board renders in chat, click to play
     - Requires MCP App-compatible host (Claude Desktop, claude.ai, VS Code Insiders, etc.)
4. **Rules Reference** - Link to docs/BACKGAMMON_RULES.md
5. **Scope & Limitations** - No doubling cube, no match play, single games only
6. **Development** - How to contribute, run tests
7. **License**

**Update `package.json`:**

```json
{
  "name": "backgammon-mcp",
  "version": "1.0.0",
  "description": "Play backgammon locally or against an LLM via MCP",
  "keywords": ["backgammon", "mcp", "claude", "game"],
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/USER/backgammon-mcp"
  },
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "build:mcp-app": "INPUT=src/mcp-app/mcp-app.html vite build --config vite.config.mcp-app.ts",
    "serve:mcp": "npm run build:mcp-app && tsx src/mcp-server/server.ts",
    "serve:mcp:text": "tsx src/mcp-server/server.ts",
    "test": "vitest",
    "test:run": "vitest run",
    "lint": "eslint src/",
    "typecheck": "tsc --noEmit"
  },
  "files": ["dist/", "src/mcp-server/", "src/game/", "README.md"],
  "bin": {
    "backgammon-mcp": "./bin/serve.js"
  }
}
```

**Create `bin/serve.js`:**

CLI entry point for running the MCP server:

```javascript
#!/usr/bin/env node
// Starts the MCP server with optional flags
// --text-only: Skip MCP App UI, text-only mode
// --port: Custom port (default 3001)
```

**Create `.github/workflows/ci.yml`:**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint
      - run: npm run test:run
      - run: npm run build
      - run: npm run build:mcp-app
```

**Create `.github/workflows/release.yml`:**

```yaml
name: Release

on:
  push:
    tags:
      - "v*"

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          registry-url: "https://registry.npmjs.org"
      - run: npm ci
      - run: npm run build
      - run: npm run build:mcp-app
      - run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

**Final npm scripts summary:**

| Command                  | Description                         |
| ------------------------ | ----------------------------------- |
| `npm run dev`            | Couch play mode (local browser)     |
| `npm run serve:mcp`      | MCP server with graphical app       |
| `npm run serve:mcp:text` | MCP server text-only (no app build) |
| `npm test`               | Run unit tests                      |
| `npm run build`          | Build couch play for production     |
| `npm run build:mcp-app`  | Build MCP App HTML bundle           |

**Verification:**

- Clone fresh repo, `npm install`, each play mode works
- `npm test` passes
- GitHub Actions CI passes on push
- `npm publish` works (dry-run first)
- README is clear and complete

---

## Summary

| Stage | What's Built                    | How to Test                                 | Status    |
| ----- | ------------------------------- | ------------------------------------------- | --------- |
| 1     | Game rules + unit tests         | `npm test`                                  | ✅ Done   |
| 2     | Interactive viewer + couch play | `npm run dev`, play a full game             | ✅ Done   |
| 3     | MCP server (LLM tool-only)      | `npm run mcp`, connect MCP client           | ✅ Done   |
| 4     | MCP App (LLM graphical)         | `npm run serve:mcp`, chat with UI           | ⬚ Pending |
| 5     | Packaging & deployment          | Fresh clone install, CI green, README clear | ⬚ Pending |

Each stage builds on the previous. The core `game/` and `viewer/` modules remain decoupled and reusable across all three play modes:

| Mode          | Command                  | Description                            |
| ------------- | ------------------------ | -------------------------------------- |
| Couch Play    | `npm run dev`            | Two humans, one device, browser UI     |
| LLM Tool-Only | `npm run serve:mcp:text` | Play vs LLM, ASCII board in chat       |
| LLM MCP App   | `npm run serve:mcp`      | Play vs LLM, interactive board in chat |
