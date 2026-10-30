import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { mainApi } from './../services/index';
import userReducer from './../slices/userSlice';
import appReducer from './../slices/appSlice';

export const store = configureStore({
  reducer: {
    users: userReducer,
    app: appReducer,
    [mainApi.reducerPath]: mainApi.reducer
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(mainApi.middleware)
});

// enable listener behavior for the store
setupListeners(store.dispatch);

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>;
// Inferred type: {posts: PostsState, comments: CommentsState, users: UsersState}
export type AppDispatch = typeof store.dispatch;
