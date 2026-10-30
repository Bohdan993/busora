import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '../store';

export interface AppState {
  isLoading: boolean;
  isFullScreen: boolean;
}

const initialState: AppState = {
  isLoading: true,
  isFullScreen: false
};

export const appSlice = createSlice({
  name: 'app',
  initialState,
  reducers: {
    setLoading: (state, action: PayloadAction<boolean>) => {
      // Redux Toolkit allows us to write "mutating" logic in reducers. It
      // doesn't actually mutate the state because it uses the Immer library,
      // which detects changes to a "draft state" and produces a brand new
      // immutable state based off those changes
      state.isLoading = action.payload;
    },
    setFullScreen: (state, action: PayloadAction<boolean>) => {
      // Redux Toolkit allows us to write "mutating" logic in reducers. It
      // doesn't actually mutate the state because it uses the Immer library,
      // which detects changes to a "draft state" and produces a brand new
      // immutable state based off those changes
      state.isFullScreen = action.payload;
    }
  }
});

// Action creators are generated for each case reducer function
export const { setLoading, setFullScreen } = appSlice.actions;
export const selectIsLoading = (state: RootState) => state.app.isLoading;
export const selectIsFullScreen = (state: RootState) => state.app.isFullScreen;

export default appSlice.reducer;
