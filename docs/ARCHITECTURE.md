# Backgammon MCP Architecture

This document describes the current architecture of the backgammon-mcp project. It is updated as implementation progresses.

**Last Updated**: After Stage 2 (Interactive Viewer & Couch Play)

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
│   └── app/                     # Couch Play mode
│       ├── main.tsx             # Vite entry point
│       ├── App.tsx              # Redux provider wrapper
│       ├── CouchGame.tsx        # Two-player local game logic
│       ├── store.ts             # Redux store configuration
│       └── index.css            # Global and CouchGame styles
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

## Data Flow

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

### Stage 3: MCP Server

```
src/mcp-server/
├── server.ts           # MCP server setup
├── gameManager.ts      # Server-side state
├── asciiBoard.ts       # Text board rendering
└── tools/
    ├── startGame.ts
    ├── rollDice.ts
    ├── makeMove.ts
    ├── endTurn.ts
    ├── getGameState.ts
    └── getRules.ts
```

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
| `npm run build` | Build for production |
| `npm test` | Run tests in watch mode |
| `npm test -- --run` | Run tests once |
