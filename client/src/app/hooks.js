import { useDispatch, useSelector } from 'react-redux';
import { useMemo } from 'react';
import { bindActionCreators } from '@reduxjs/toolkit';
import { uiActions } from '../features/ui/uiSlice.js';
import { authActions } from '../features/auth/authSlice.js';

export const useAppDispatch = () => useDispatch();
export const useAppSelector = useSelector;

export const useBoundActions = () => {
  const dispatch = useAppDispatch();
  return useMemo(
    () => bindActionCreators({ ...uiActions, ...authActions }, dispatch),
    [dispatch],
  );
};
