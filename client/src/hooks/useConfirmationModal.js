import { createElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ConfirmationModal from '../components/dashboard/ConfirmationModal.jsx';

const DEFAULT_OPTIONS = {
  title: 'Confirm action',
  message: '',
  confirmLabel: 'Confirm',
  cancelLabel: 'Cancel',
  tone: 'danger',
};

const useConfirmationModal = () => {
  const resolverRef = useRef(null);
  const [options, setOptions] = useState(null);

  const resolveConfirmation = useCallback((result) => {
    if (resolverRef.current) {
      resolverRef.current(result);
      resolverRef.current = null;
    }
    setOptions(null);
  }, []);

  useEffect(() => () => {
    if (resolverRef.current) {
      resolverRef.current(false);
      resolverRef.current = null;
    }
  }, []);

  const confirm = useCallback((nextOptions = {}) => new Promise((resolve) => {
    if (resolverRef.current) {
      resolverRef.current(false);
    }

    resolverRef.current = resolve;
    setOptions({
      ...DEFAULT_OPTIONS,
      ...nextOptions,
    });
  }), []);

  const confirmationModal = useMemo(() => createElement(ConfirmationModal, {
    open: Boolean(options),
    title: options?.title,
    message: options?.message,
    confirmLabel: options?.confirmLabel,
    cancelLabel: options?.cancelLabel,
    tone: options?.tone,
    isBusy: Boolean(options?.isBusy),
    onConfirm: () => resolveConfirmation(true),
    onCancel: () => resolveConfirmation(false),
  }), [options, resolveConfirmation]);

  return { confirm, confirmationModal };
};

export default useConfirmationModal;
