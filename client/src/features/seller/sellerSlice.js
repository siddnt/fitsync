import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  editingProductId: null,
  isProductPanelOpen: false,
  filterStatus: 'all',
};

const sellerSlice = createSlice({
  name: 'seller',
  initialState,
  reducers: {
    openProductPanel(state, action) {
      state.isProductPanelOpen = true;
      state.editingProductId = action.payload ?? null;
    },
    closeProductPanel(state) {
      state.isProductPanelOpen = false;
      state.editingProductId = null;
    },
    setFilterStatus(state, action) {
      state.filterStatus = action.payload ?? 'all';
    },
  },
});

export const { openProductPanel, closeProductPanel, setFilterStatus } = sellerSlice.actions;

export default sellerSlice.reducer;
