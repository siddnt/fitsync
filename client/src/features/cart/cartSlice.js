import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  items: [],
};

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    addItem(state, action) {
      const payload = action.payload ?? {};
      const id = payload.id ?? payload.productId;
      if (!id) {
        return;
      }

      const quantityToAdd = Number(payload.quantity ?? 1);
      if (!Number.isFinite(quantityToAdd) || quantityToAdd <= 0) {
        return;
      }

      const existing = state.items.find((item) => item.id === id);
      if (existing) {
        existing.quantity += quantityToAdd;
      } else {
        state.items.push({
          id,
          name: payload.name ?? 'Unnamed product',
          price: payload.price ?? 0,
          image: payload.image ?? null,
          seller: payload.seller ?? null,
          quantity: quantityToAdd,
        });
      }
    },
    setQuantity(state, action) {
      const { id, quantity } = action.payload ?? {};
      if (!id) {
        return;
      }

      const target = state.items.find((item) => item.id === id);
      if (!target) {
        return;
      }

      const nextQuantity = Number(quantity);
      if (!Number.isFinite(nextQuantity) || nextQuantity <= 0) {
        state.items = state.items.filter((item) => item.id !== id);
        return;
      }

      target.quantity = nextQuantity;
    },
    removeItem(state, action) {
      const id = action.payload;
      if (!id) {
        return;
      }
      state.items = state.items.filter((item) => item.id !== id);
    },
    clearCart(state) {
      state.items = [];
    },
  },
});

export const cartReducer = cartSlice.reducer;
export const cartActions = cartSlice.actions;
export default cartReducer;
