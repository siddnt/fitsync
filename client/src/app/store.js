import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { persistReducer, persistStore } from 'redux-persist';
import storage from 'redux-persist/lib/storage';
import { reducer as formReducer } from 'redux-form';
import { apiSlice } from '../services/apiSlice.js';
import authReducer from '../features/auth/authSlice.js';
import uiReducer from '../features/ui/uiSlice.js';
import monetisationReducer from '../features/monetisation/monetisationSlice.js';
import sellerReducer from '../features/seller/sellerSlice.js';
import cartReducer from '../features/cart/cartSlice.js';

const persistConfig = {
  key: 'root',
  storage,
  whitelist: ['auth', 'cart'],
};

const rootReducer = combineReducers({
  auth: authReducer,
  ui: uiReducer,
  monetisation: monetisationReducer,
  seller: sellerReducer,
  cart: cartReducer,
  form: formReducer,
  [apiSlice.reducerPath]: apiSlice.reducer,
});

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }).concat(apiSlice.middleware),
});

export const persistor = persistStore(store);
