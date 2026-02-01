import { configureStore } from "@reduxjs/toolkit";
import { gameReducer, gameSyncThunkMiddleware } from "@backgammon/game";

export const store = configureStore({
  reducer: {
    game: gameReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      // Disable serializable check for sync thunk actions
      // (they store payloadCreator function in meta)
      serializableCheck: {
        ignoredActionPaths: ["meta.payloadCreator"],
      },
    }).concat(gameSyncThunkMiddleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
