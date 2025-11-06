import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  user: null,
  accessToken: null,
  refreshToken: null,
  status: 'idle',
  error: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    authPending(state) {
      state.status = 'loading';
      state.error = null;
    },
    authSuccess(state, action) {
      const { user, accessToken, refreshToken } = action.payload;
      state.user = user;
      state.accessToken = accessToken ?? state.accessToken;
      state.refreshToken = refreshToken ?? state.refreshToken;
      state.status = 'succeeded';
      state.error = null;
    },
    authFailure(state, action) {
      state.status = 'failed';
      state.error = action.payload ?? 'Authentication failed';
    },
    signOut(state) {
      state.user = null;
      state.accessToken = null;
      state.refreshToken = null;
      state.status = 'idle';
      state.error = null;
    },
    updateProfile(state, action) {
      if (state.user) {
        state.user = { ...state.user, ...action.payload };
      }
    },
  },
});

export const authReducer = authSlice.reducer;
export const authActions = authSlice.actions;
export default authReducer;
