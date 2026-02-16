# Doubling Cube & Score Keeping - Implementation Plan

## Overview

Add an **optional** doubling cube and match score keeping to the backgammon game. The doubling cube raises the stakes during a game; match scoring tracks points across multiple games. Both features are opt-in.

---

## Phase 1: Core Logic (`packages/game`)

### 1a. New Types (`types.ts`)

**Doubling Cube State:**
```typescript
type CubeValue = 1 | 2 | 4 | 8 | 16 | 32 | 64
type CubeOwner = Player | 'center'

interface DoublingCubeState {
  value: CubeValue
  owner: CubeOwner  // 'center' = either player may double
}
```

**New Game Phase:**
Add `'doubling_proposed'` to `GamePhase`:
```typescript
type GamePhase = 'not_started' | 'rolling_for_first' | 'rolling' | 'doubling_proposed' | 'moving' | 'game_over'
```

During `doubling_proposed`, the game is waiting for the opponent to accept or decline.

**New Game Actions:**
```typescript
| { type: 'double_proposed'; player: Player }
| { type: 'double_accepted'; player: Player }  // player = the one accepting
| { type: 'double_declined'; player: Player }  // player = the one declining
```

**Updated GameResult:**
Add `pointsAwarded` field that accounts for cube value:
```typescript
interface GameResult {
  winner: Player
  victoryType: VictoryType
  pointsAwarded: number  // victoryMultiplier * cubeValue
}
```

**Updated GameState:**
```typescript
interface GameState {
  // ... existing fields ...
  doublingCube: DoublingCubeState | null  // null = cube not in play (feature disabled)
  pendingDouble: Player | null  // who proposed, non-null only in 'doubling_proposed' phase
}
```

**Match State (new type, separate from GameState):**
```typescript
interface MatchConfig {
  targetScore: number
  doublingCubeEnabled: boolean
}

interface MatchState {
  config: MatchConfig
  scores: { white: number; black: number }
  gameNumber: number
  isCrawfordGame: boolean  // no doubling allowed this game
  crawfordGamePlayed: boolean
  winner: Player | null
  gameResults: readonly GameResult[]
}
```

**Game Config (new, controls optional features):**
```typescript
interface GameConfig {
  doublingCubeEnabled: boolean
}
```

### 1b. New Operations (`operations.ts`)

**`performProposeDouble()`**
- Preconditions: phase is `'rolling'`, current player owns cube or cube is centered, cube value < 64, not Crawford game
- Transitions phase to `'doubling_proposed'`
- Records `double_proposed` action

**`performRespondToDouble({ accept })`**
- Preconditions: phase is `'doubling_proposed'`
- If accepted:
  - Double cube value, transfer ownership to accepting player
  - Phase back to `'rolling'` (proposer still needs to roll)
  - Record `double_accepted` action
- If declined:
  - Game over, proposing player wins at **current** stakes (before the proposed double)
  - Record `double_declined` action
  - Record game result

### 1c. Rules Updates (`rules.ts`)

- `canProposeDouble({ state })` - Check if current player can double
  - Phase must be `'rolling'`
  - Cube must exist (feature enabled)
  - Current player must own cube OR cube is centered
  - Cube value must be < 64
  - Not a Crawford game (if match context provided)
- Update `checkGameOver` to include cube value in `pointsAwarded` calculation
- Points formula: `victoryMultiplier(victoryType) * cubeValue`
  - Single = 1, Gammon = 2, Backgammon = 3

### 1d. Match Module (new file `match.ts` or `matchSlice.ts`)

- `createMatch({ config })` - Initialize match state
- `recordGameResult({ matchState, gameResult })` - Update scores, check for match winner, determine Crawford status
- `shouldEnableCube({ matchState })` - Returns false during Crawford game
- `getNextGameConfig({ matchState })` - Returns GameConfig for the next game
- Match selectors: `selectMatchWinner`, `selectIsCrawfordGame`, etc.

### 1e. Update `gameSlice.ts`

- Add new reducers/extra reducers for double operations
- Update `createInitialState` to accept optional `GameConfig`
- When `doublingCubeEnabled: true`, initialize cube at `{ value: 1, owner: 'center' }`
- When `doublingCubeEnabled: false`, `doublingCube` is `null`

### 1f. Tests

- Unit tests for doubling operations
- Unit tests for scoring calculations
- Unit tests for Crawford rule
- Integration tests for full match flow

---

## Phase 2: Viewer (`packages/viewer`)

### 2a. Doubling Cube Component

- New `DoublingCube` component showing current cube value and position
- Position indicates ownership: left side (white), right side (black), center
- Visual highlight when a double is proposed

### 2b. Doubling Proposal UI

- When phase is `'doubling_proposed'`, show accept/decline buttons for the responding player
- When phase is `'rolling'` and player can double, show "Double" button alongside "Roll"

### 2c. Score Display Component

- New `MatchScoreDisplay` component (optional, only shown in match play)
- Shows: target score, each player's current score, game number, Crawford indicator

### 2d. Updated BoardView Props

- Add optional `doublingCube?: DoublingCubeState | null`
- Add optional `canDouble?: boolean`
- Add optional `pendingDouble?: Player | null`
- Add callbacks: `onDoubleClick`, `onAcceptDoubleClick`, `onDeclineDoubleClick`
- Add optional `matchState?: MatchState`

---

## Phase 3: Couch Version (`packages/web-app`)

### 3a. Game Setup UI

- Add option to enable doubling cube when starting a game
- Add option for match play (with target score input)

### 3b. Integrate Doubling Flow

- When it's a player's turn and they can double, show the "Double" button
- Handle the accept/decline flow between the two local players
- Wire up the new callbacks to dispatch operations

### 3c. Match Mode

- Track match state in Redux store
- After game over, show game result with points awarded
- Prompt to start next game (or declare match winner)
- Handle Crawford game indicator

---

## Phase 4: MCP Play (`packages/mcp-server`)

### 4a. Updated Game Management Tools

- Update `backgammon_start_game` to accept `doublingCubeEnabled` and match config
- Update `backgammon_get_game_state` to include cube state and match state

### 4b. New Human/UI Tools (`visibility: ['app']`)

- `view_propose_double()` - Human player proposes a double
- `view_respond_to_double({ accept })` - Human player accepts or declines

### 4c. New Model/AI Tools (`visibility: ['model']`)

- `model_propose_double()` - AI proposes doubling
- `model_respond_to_double({ accept })` - AI accepts or declines a double
- Update `model_roll_dice` to indicate if doubling is available
- Update context messages to include cube state and match score

### 4d. Match Flow

- Tools for match management: `backgammon_start_match`, `backgammon_get_match_state`
- Auto-start next game in match, respect Crawford rule
- Include match score in model context

---

## Key Design Decisions

1. **Optional by default**: `doublingCube` is `null` when disabled - no impossible states
2. **Cube state lives in GameState**: It's part of the game, not a separate concern
3. **Match state is separate**: Lives alongside GameState, not inside it. A game doesn't know about matches.
4. **Crawford rule**: Enforced at the match level - match tells game whether to enable cube
5. **Points calculation**: Done at game-over time, stored in GameResult
6. **No auto-double or beaver rules**: Keep it standard (can add later if desired)
7. **Phase approach**: `doubling_proposed` is a first-class game phase, keeping the state machine explicit
