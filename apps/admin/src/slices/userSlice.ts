import { type User } from 'src/types/users';
import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from 'src/store';

export interface AuthState {
  isAuth: boolean;
  user: User | null;
}

const initialState: AuthState = {
  isAuth: false,
  user: null
};

export const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    setAuth: (state, action: PayloadAction<boolean>) => {
      // Redux Toolkit allows us to write "mutating" logic in reducers. It
      // doesn't actually mutate the state because it uses the Immer library,
      // which detects changes to a "draft state" and produces a brand new
      // immutable state based off those changes
      state.isAuth = action.payload;
    },
    setUser: (state, action: PayloadAction<User>) => {
      // Redux Toolkit allows us to write "mutating" logic in reducers. It
      // doesn't actually mutate the state because it uses the Immer library,
      // which detects changes to a "draft state" and produces a brand new
      // immutable state based off those changes
      state.user = action.payload;
    }
  }
});

// Action creators are generated for each case reducer function
export const { setAuth, setUser } = userSlice.actions;
export const selectIsAuth = (state: RootState) => state.users.isAuth;
export const selectUser = (state: RootState) => state.users.user;

export default userSlice.reducer;
