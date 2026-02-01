import { createSlice } from '@reduxjs/toolkit'
import type { GameState } from './types'

const initialState: GameState = {
  initialized: false,
}

export const gameSlice = createSlice({
  name: 'game',
  initialState,
  reducers: {
    // Placeholder - game actions will be added here
  },
})

export default gameSlice.reducer
