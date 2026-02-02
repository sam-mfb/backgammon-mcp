/**
 * Redux Store for MCP Server
 *
 * Configures the Redux store with the game reducer and sync thunk middleware.
 */

import { configureStore, createSlice, type PayloadAction } from '@reduxjs/toolkit'
import { gameReducer, gameSyncThunkMiddleware } from '@backgammon/game'

// =============================================================================
// Types
// =============================================================================

/**
 * Configuration for player control - determines which player(s) are controlled
 * by the UI (human) vs the AI model.
 */
export type PlayerControl = 'human' | 'ai'

export interface GameConfig {
  readonly whiteControl: PlayerControl
  readonly blackControl: PlayerControl
}

// =============================================================================
// Config Slice
// =============================================================================

const initialConfig: GameConfig = {
  whiteControl: 'human',
  blackControl: 'ai'
}

const configSlice = createSlice({
  name: 'config',
  initialState: initialConfig,
  reducers: {
    setGameConfig: (_state, action: PayloadAction<GameConfig>) => {
      return action.payload
    }
  }
})

export const { setGameConfig } = configSlice.actions

// =============================================================================
// Store
// =============================================================================

export const store = configureStore({
  reducer: {
    game: gameReducer,
    config: configSlice.reducer
  },
  middleware: getDefaultMiddleware =>
    getDefaultMiddleware({
      // Disable serializable check for sync thunk actions
      // (they store payloadCreator function in meta)
      serializableCheck: {
        ignoredActionPaths: ['meta.payloadCreator']
      }
    }).concat(gameSyncThunkMiddleware)
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
