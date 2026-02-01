# Backgammon MCP Architecture

This document describes the current architecture of the backgammon-mcp project. It is updated as implementation progresses.

**Last Updated**: After Stage 3 (MCP Server - LLM Tool-Only)

---

## Current Directory Structure

```
backgammon-mcp/
├── src/
│   ├── game/                    # Core game logic (shared)
│   │   ├── types.ts             # Type definitions
│   │   ├── gameSlice.ts         # Redux state management
│   │   ├── rules.ts             # Move validation, legal moves
│   │   ├── index.ts             # Public exports
│   │   └── __tests__/
│   │       ├── rules.test.ts    # 54 comprehensive tests
│   │       └── testUtils.ts     # Test helpers
│   │
│   ├── viewer/                  # Pure display components (shared)
│   │   ├── BoardView.tsx        # Main board component with callbacks
│   │   ├── BoardView.css        # All board styles
│   │   ├── index.ts             # Public exports
│   │   └── components/
│   │       ├── Bar.tsx          # Bar display with click handlers
│   │       ├── BoardSurface.tsx # Board layout orchestration
│   │       ├── BorneOffArea.tsx # Borne-off area with click handlers
│   │       ├── Checker.tsx      # Single checker display
│   │       ├── Controls.tsx     # Roll Dice / End Turn buttons
│   │       ├── DiceDisplay.tsx  # Dice value display
│   │       ├── GameInfo.tsx     # Player, phase, turn info, winner
│   │       ├── Point.tsx        # Board point with selection/click
│   │       └── Quadrant.tsx     # Groups 6 points together
│   │
│   ├── app/                     # Couch Play mode
│   │   ├── main.tsx             # Vite entry point
│   │   ├── App.tsx              # Redux provider wrapper
│   │   ├── CouchGame.tsx        # Two-player local game logic
│   │   ├── store.ts             # Redux store configuration
│   │   └── index.css            # Global and CouchGame styles
│   │
│   └── mcp-server/              # MCP Server (LLM Tool-Only mode)
│       ├── server.ts            # MCP server setup, tool registration
│       ├── gameManager.ts       # Server-side game state management
│       ├── asciiBoard.ts        # Text board rendering for LLM
│       └── index.ts             # Public exports
│
├── docs/
│   ├── BACKGAMMON_RULES.md      # Game rules reference
│   ├── IMPLEMENTATION_PLAN.md   # Staged implementation plan
│   └── ARCHITECTURE.md          # This file
│
├── tests/
│   └── setup.ts                 # Vitest setup
│
├── vite.config.ts               # Vite configuration
├── vitest.config.ts             # Vitest configuration
├── tsconfig.json                # TypeScript configuration
└── package.json
```

---

## Module Descriptions

### `src/game/` - Core Game Logic

Pure TypeScript module with no React or UI dependencies. Can be used by any consumer (browser app, MCP server, tests).

#### `types.ts`

Defines all game-related types using discriminated unions and string literals (no enums per coding standards):

| Type | Description |
|------|-------------|
| `Player` | `'white' \| 'black'` |
| `PointIndex` | `1 \| 2 \| ... \| 24` (branded number type) |
| `DieValue` | `1 \| 2 \| 3 \| 4 \| 5 \| 6` |
| `MoveFrom` | `PointIndex \| 'bar'` |
| `MoveTo` | `PointIndex \| 'off'` |
| `GamePhase` | `'not_started' \| 'rolling_for_first' \| 'rolling' \| 'moving' \| 'game_over'` |
| `VictoryType` | `'single' \| 'gammon' \| 'backgammon'` |
| `BoardState` | Points array (positive = white, negative = black), bar counts, borne-off counts |
| `GameState` | Complete game state including board, current player, phase, dice, moves, history |
| `Move` | A single move: `{ from, to, dieUsed }` |
| `AvailableMoves` | Valid moves from a source: `{ from, destinations[] }` |
| `GameResult` | Winner and victory type |

#### `gameSlice.ts`

Redux Toolkit slice managing game state transitions:

**Actions:**
- `startGame()` - Transition to `rolling_for_first` phase
- `setFirstPlayer(player)` - Set first player, transition to `rolling`
- `rollDice({ die1, die2 })` - Set dice, compute remaining moves, transition to `moving`
- `makeMove({ from, to, dieUsed })` - Execute move, update board/bar/borneOff, consume die
- `endTurn()` - Archive turn to history, switch player, transition to `rolling`
- `setAvailableMoves(moves)` - Update computed valid moves (for UI highlighting)
- `endGame(result)` - Set result, transition to `game_over`
- `resetGame()` - Return to initial state

**Selectors:**
- Direct: `selectBoard`, `selectCurrentPlayer`, `selectPhase`, `selectDiceRoll`, etc.
- Derived: `selectCanRoll`, `selectCanMove`, `selectIsGameOver`, `selectIsDoubles`

#### `rules.ts`

Core game rules engine with comprehensive validation:

**Public Functions:**
- `getValidMoves({ state })` - Returns all legal moves for current player
- `isValidMove({ state, move })` - Validates a specific move
- `canBearOff({ state, player })` - Checks if player can bear off
- `checkGameOver({ state })` - Returns `GameResult` if game is over, null otherwise
- `getMoveDirection(player)` - Returns `1` for black (low→high), `-1` for white (high→low)

**Rules Implemented:**
- Movement direction (white: 24→1, black: 1→24)
- Point occupancy (own checkers, single opponent = hit, 2+ opponent = blocked)
- Bar entry requirements (must re-enter before other moves)
- Bearing off conditions (all checkers in home board)
- Dice usage optimization (must use both dice if possible, higher die if only one playable)
- Victory detection (single, gammon, backgammon)

---

### `src/viewer/` - Display Components

Pure React components that receive all state as props and emit actions via callbacks. No knowledge of Redux or game orchestration.

#### `BoardView.tsx`

Main component that composes the board display.

**Props:**
```typescript
interface BoardViewProps {
  gameState: GameState
  selectedSource?: PointIndex | 'bar' | null
  validDestinations?: readonly MoveTo[]
  onPointClick?: (pointIndex: PointIndex) => void
  onBarClick?: (player: Player) => void
  onBorneOffClick?: (player: Player) => void
  onRollClick?: () => void
  onEndTurnClick?: () => void
}
```

**Composition:**
```
BoardView
├── GameInfo (player, phase, turn, dice, winner)
├── BoardSurface
│   ├── BorneOffArea (white)
│   ├── Quadrant (top-left: points 13-18)
│   │   └── Point × 6
│   ├── Bar
│   ├── Quadrant (top-right: points 19-24)
│   │   └── Point × 6
│   ├── Quadrant (bottom-right: points 6-1)
│   │   └── Point × 6
│   ├── Bar (placeholder)
│   └── Quadrant (bottom-left: points 12-7)
│       └── Point × 6
└── Controls (Roll Dice, End Turn buttons)
```

#### Component Responsibilities

| Component | Responsibility |
|-----------|----------------|
| `Point` | Displays checkers, handles selection highlighting, valid destination indicator, click events |
| `Bar` | Displays checkers on bar for both players, click handlers for bar selection |
| `BorneOffArea` | Displays borne-off count, valid destination highlighting for bearing off |
| `Checker` | Single checker with player-specific styling |
| `DiceDisplay` | Shows dice values, marks used dice |
| `GameInfo` | Current player, phase, turn number, or winner announcement |
| `Controls` | Roll Dice and End Turn buttons with disabled states |
| `Quadrant` | Groups 6 points, passes selection/click props |
| `BoardSurface` | Arranges quadrants, bar, borne-off areas |

#### CSS Architecture

All styles in `BoardView.css` using BEM-like naming:

- `.board-view` - Container
- `.game-info`, `.game-info__player`, etc. - Info bar
- `.board-surface`, `.quadrant`, `.point` - Board layout
- `.checker`, `.checker--white`, `.checker--black` - Checker styling
- `.bar`, `.bar__section` - Bar area
- `.borne-off` - Borne-off area
- `.controls`, `.controls__button` - Control buttons
- `.point--selected`, `.point--valid-destination` - Interactive states
- `.bar__section--clickable`, `.bar__section--selected` - Bar interactive states
- `.borne-off--valid-destination` - Bearing off highlight

---

### `src/app/` - Couch Play Mode

Browser application for two players on one device.

#### `CouchGame.tsx`

Main game orchestration component.

**Responsibilities:**
- Manages selection state (`selectedSource`, `validDestinations`)
- Computes valid moves using `getValidMoves()` when dice are rolled
- Handles all user interactions via callbacks
- Auto-detects game over conditions
- Auto-ends turn when no moves available

**Turn Flow:**
1. Game starts → `startGame()` → Roll for first player
2. Player clicks "Roll Dice" → `rollDice()` with random values
3. Valid moves computed → `setAvailableMoves()`
4. Player clicks checker → Sets `selectedSource`, shows `validDestinations`
5. Player clicks valid destination → `makeMove()`
6. Repeat 4-5 until no moves remain
7. Player clicks "End Turn" → `endTurn()` → Switch player
8. Repeat 2-7 until game over
9. Winner displayed → "New Game" button available

**State Management:**
- Redux store holds `GameState`
- Local React state holds selection (`selectedSource`, `validDestinations`)
- `useEffect` hooks compute valid moves and check game over

#### `store.ts`

```typescript
const store = configureStore({
  reducer: {
    game: gameReducer,
  },
})
```

---

### `src/mcp-server/` - MCP Server (LLM Tool-Only)

MCP server that exposes backgammon game tools for text-based LLM interaction. Uses stdio transport for communication with MCP hosts.

#### `server.ts`

Main entry point that sets up the MCP server and registers all tools.

**Dependencies:**
- `@modelcontextprotocol/sdk` - Official MCP TypeScript SDK
- `zod` - Schema validation for tool inputs

**Tools Registered:**

| Tool | Description | Input |
|------|-------------|-------|
| `backgammon_start_game` | Initialize new game, roll for first player | `{ humanColor?: 'white' \| 'black' }` |
| `backgammon_roll_dice` | Roll dice for current player's turn | none |
| `backgammon_make_move` | Move a checker | `{ from, to, dieUsed }` |
| `backgammon_end_turn` | End turn, switch to opponent | none |
| `backgammon_get_game_state` | Get current board and status | none |
| `backgammon_get_rules` | Get rules reference | `{ section?: string }` |

**Transport:** stdio (communicates via stdin/stdout)

#### `gameManager.ts`

Singleton module that holds the current game state and provides methods to manipulate it.

**Pattern:** Factory function returning object with methods (no classes per coding standards)

**Methods:**
- `startGame({ humanColor? })` - Initialize game, roll for first player
- `rollDice()` - Roll dice, compute valid moves, auto-forfeit if none
- `makeMove({ from, to, dieUsed })` - Validate and execute move
- `endTurn()` - End turn, switch player
- `getState()` - Get current game state
- `resetGame()` - Clear game state

**Result Type:**
```typescript
type GameManagerResult<T> =
  | { success: true; data: T }
  | { success: false; error: string }
```

Uses discriminated union for clear error handling without exceptions.

**Integration:**
- Uses `game/rules.ts` for move validation
- Uses `game/types.ts` for type definitions
- Maintains game history for context

#### `asciiBoard.ts`

Renders game state as ASCII text for display in LLM tool results.

**Functions:**
- `renderAsciiBoard({ state })` - Visual board with checker positions
- `renderGameSummary({ state })` - Turn, player, phase, dice info
- `renderFullGameState({ state })` - Combined board + summary
- `renderAvailableMoves({ state })` - List of legal moves

**Board Format:**
```
    13 14 15 16 17 18   BAR   19 20 21 22 23 24
   +-----------------+-----+-----------------+
   | O        O  O  O |   | X  X  X        X  X |
   | O        O  O  O |   | X                    |
   ...
   +-----------------+-----+-----------------+
    12 11 10  9  8  7   BAR    6  5  4  3  2  1

   Borne off: White: 0  Black: 0
```

Uses `O` for white checkers, `X` for black checkers.

---

## Data Flow

### MCP Tool-Only Mode

```
MCP Host (Claude Desktop, etc.)
    │
    │ MCP Protocol (stdio)
    │
    ▼
server.ts (receives tool call)
    │
    ▼
gameManager.ts (validates, executes)
    │
    ├─► rules.ts (move validation)
    │
    └─► asciiBoard.ts (render state)
            │
            ▼
        Tool Result (text content)
            │
            │ MCP Protocol (stdio)
            │
            ▼
        MCP Host (displays to user/LLM)
```

### Couch Play Mode

```
User Click
    │
    ▼
CouchGame.tsx (handles click)
    │
    ├─► Local State Update (selection)
    │
    └─► Redux Dispatch (game action)
            │
            ▼
        gameSlice.ts (reducer)
            │
            ▼
        GameState Updated
            │
            ▼
        useSelector (re-render)
            │
            ▼
        BoardView (displays new state)
```

### Move Validation Flow

```
User selects checker
    │
    ▼
CouchGame checks availableMoves
    │
    ├─► Found? Show validDestinations
    │
    └─► Not found? Clear selection

User clicks destination
    │
    ▼
CouchGame finds matching destination in availableMoves
    │
    ├─► Found? dispatch(makeMove(...))
    │
    └─► Not found? (shouldn't happen if UI correct)
```

---

## Key Design Decisions

### 1. Separation of Concerns

- **`game/`**: Pure logic, no UI dependencies
- **`viewer/`**: Pure display, no game logic
- **`app/`**: Orchestration only, connects game logic to viewer

### 2. Props-Down, Events-Up

BoardView receives all state via props and emits all actions via callbacks. This enables reuse in MCP App (future) where state comes from tool results instead of Redux.

### 3. Discriminated Unions Over Optional Properties

Game state uses discriminated unions to make impossible states unrepresentable:
```typescript
// Good: Clear phases
type GamePhase = 'not_started' | 'rolling' | 'moving' | 'game_over'

// Not: Optional properties that can be inconsistent
interface BadState {
  dice?: [number, number]  // When is this set?
  winner?: Player          // Can we have winner before game_over?
}
```

### 4. Immutable State with Redux Toolkit

Redux Toolkit's Immer integration allows "mutating" syntax while maintaining immutability. The `gameSlice` reducers read like mutations but produce immutable updates.

### 5. Computed Valid Moves

Valid moves are computed once when dice are rolled and stored in state. This:
- Avoids recomputing on every render
- Enables UI highlighting without prop drilling computation logic
- Keeps BoardView pure (just reads `availableMoves` prop)

---

## Testing

### Test Coverage

54 tests in `src/game/__tests__/rules.test.ts` covering:

| Category | Tests |
|----------|-------|
| Initial Setup | 3 |
| Movement Direction | 3 |
| Legal Move Conditions | 7 |
| Dice Usage | 8 |
| Bar Entry | 8 |
| Hitting | 6 |
| Bearing Off | 11 |
| Winning Conditions | 4 |
| Edge Cases | 4 |

### Test Utilities

`testUtils.ts` provides:
- `createGameState(overrides)` - Factory for test states
- `createBoardWithCheckers(positions)` - Build specific board positions

### Running Tests

```bash
npm test        # Watch mode
npm test -- --run  # Single run
```

---

## Future Architecture (Planned)

### Stage 4: MCP App

```
src/mcp-app/
├── mcp-app.html        # Entry point
├── mcp-app.ts          # Host communication
├── McpBoardView.tsx    # Wrapper with tool calls
└── vite.config.ts      # Single-file bundle
```

---

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Couch Play mode (Vite dev server) |
| `npm run mcp` | Start MCP server (LLM Tool-Only mode, stdio transport) |
| `npm run build` | Build for production |
| `npm test` | Run tests in watch mode |
| `npm run test:run` | Run tests once |
