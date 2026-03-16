import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSelector } from 'react-redux';
import { apiSlice } from '../services/apiSlice.js';
import AppLoader from './AppLoader.jsx';
import './GlobalLoaderOverlay.css';

const REQUEST_SHOW_DELAY_MS = 200;
const REQUEST_MIN_VISIBLE_MS = 320;
const BLOCKING_MUTATION_MESSAGES = {
  createGymStripeCheckoutSession: 'Preparing secure checkout...',
  createMembershipStripeCheckoutSession: 'Preparing secure checkout...',
  confirmPaymentSession: 'Finalizing your membership...',
  createListingStripeCheckoutSession: 'Preparing secure checkout...',
  createSponsorshipStripeCheckoutSession: 'Preparing secure checkout...',
  confirmOwnerPaymentSession: 'Finalizing your payment...',
  createMarketplacePaymentIntent: 'Preparing secure checkout...',
  createMarketplaceStripeCheckoutSession: 'Preparing secure checkout...',
  createMarketplaceUpiSession: 'Preparing your UPI session...',
  confirmMarketplaceUpiPayment: 'Confirming your payment...',
  confirmMarketplacePaymentSession: 'Finalizing your order...',
  confirmMarketplaceCodOrder: 'Confirming your order...',
};

const selectBlockingMutationEndpoint = (state) => {
  const apiState = state?.[apiSlice.reducerPath];
  const mutations = Object.values(apiState?.mutations ?? {});

  const pendingBlockingMutation = mutations.find(
    (entry) =>
      entry?.status === 'pending'
      && entry?.endpointName
      && Object.hasOwn(BLOCKING_MUTATION_MESSAGES, entry.endpointName),
  );

  return pendingBlockingMutation?.endpointName ?? null;
};

const GlobalLoaderOverlay = () => {
  const pendingBlockingEndpoint = useSelector(selectBlockingMutationEndpoint);
  const [isRequestLoading, setIsRequestLoading] = useState(false);
  const requestShowTimerRef = useRef(null);
  const requestHideTimerRef = useRef(null);
  const requestVisibleAtRef = useRef(0);
  const hasBlockingRequest = Boolean(pendingBlockingEndpoint);

  useEffect(() => {
    window.clearTimeout(requestShowTimerRef.current);
    window.clearTimeout(requestHideTimerRef.current);

    if (hasBlockingRequest) {
      if (!isRequestLoading) {
        requestShowTimerRef.current = window.setTimeout(() => {
          requestVisibleAtRef.current = Date.now();
          setIsRequestLoading(true);
        }, REQUEST_SHOW_DELAY_MS);
      }

      return undefined;
    }

    if (!isRequestLoading) {
      return undefined;
    }

    const elapsed = Date.now() - requestVisibleAtRef.current;
    const remaining = Math.max(REQUEST_MIN_VISIBLE_MS - elapsed, 0);

    requestHideTimerRef.current = window.setTimeout(() => {
      setIsRequestLoading(false);
    }, remaining);

    return undefined;
  }, [hasBlockingRequest, isRequestLoading]);

  useEffect(
    () => () => {
      window.clearTimeout(requestShowTimerRef.current);
      window.clearTimeout(requestHideTimerRef.current);
    },
    [],
  );

  if (!isRequestLoading || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div className="global-loader-overlay" aria-hidden="true">
      <AppLoader
        message={BLOCKING_MUTATION_MESSAGES[pendingBlockingEndpoint] ?? 'Processing your request...'}
      />
    </div>,
    document.body,
  );
};

export default GlobalLoaderOverlay;
