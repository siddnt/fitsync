import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  selectedGymId: null,
  selectedPlanCode: null,
  selectedSponsorshipTier: null,
  lastReceipt: null,
};

const monetisationSlice = createSlice({
  name: 'monetisation',
  initialState,
  reducers: {
    selectPlan(state, action) {
      state.selectedPlanCode = action.payload ?? null;
    },
    selectGym(state, action) {
      state.selectedGymId = action.payload ?? null;
    },
    selectSponsorshipTier(state, action) {
      state.selectedSponsorshipTier = action.payload ?? null;
    },
    setLastReceipt(state, action) {
      state.lastReceipt = action.payload ?? null;
    },
    resetMonetisation(state) {
      state.selectedGymId = null;
      state.selectedPlanCode = null;
      state.selectedSponsorshipTier = null;
      state.lastReceipt = null;
    },
  },
});

export const {
  selectPlan,
  selectGym,
  selectSponsorshipTier,
  setLastReceipt,
  resetMonetisation,
} = monetisationSlice.actions;

export default monetisationSlice.reducer;
