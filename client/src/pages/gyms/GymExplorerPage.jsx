import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  useGetGymsQuery,
  useRecordImpressionMutation,
  useGetMyGymMembershipQuery,
  useJoinGymMutation,
  useCreateMembershipStripeCheckoutSessionMutation,
  useConfirmPaymentSessionMutation,
  useLeaveGymMutation,
  useGetGymTrainersQuery,
} from '../../services/gymsApi.js';
import GymList from './components/GymList.jsx';
import GymFilters from './components/GymFilters.jsx';
import GymHighlight from './components/GymHighlight.jsx';
import './GymExplorerPage.css';

const GymExplorerPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const processedSessionRef = useRef(null);
  const [selectedGymId, setSelectedGymId] = useState(null);
  const [filters, setFilters] = useState({ search: '', city: '', amenities: [] });
  const { data, isFetching, refetch } = useGetGymsQuery(filters);
  const [recordImpression] = useRecordImpressionMutation();
  const [joinGym, { isLoading: isJoiningDirect }] = useJoinGymMutation();
  const [createMembershipStripeCheckoutSession, { isLoading: isCreatingMembershipCheckout }] =
    useCreateMembershipStripeCheckoutSessionMutation();
  const [confirmPaymentSession] = useConfirmPaymentSessionMutation();
  const [leaveGym, { isLoading: isLeaving }] = useLeaveGymMutation();
  const [actionError, setActionError] = useState(null);
  const [stripeNotice, setStripeNotice] = useState(null);

  const user = useSelector((state) => state.auth.user);
  const userRole = user?.role ?? null;
  const userId = user?._id ?? user?.id ?? null;
  const isAuthenticated = Boolean(user);
  const canManageMembership = ['trainee', 'trainer'].includes(userRole);
  const isJoining = isJoiningDirect || isCreatingMembershipCheckout;

  const stripeStatus = searchParams.get('stripe');
  const paymentSessionId = searchParams.get('payment_session_id');
  const stripeSessionId = searchParams.get('session_id');
  const queryGymId = searchParams.get('gymId');

  const gyms = useMemo(
    () => (Array.isArray(data?.data?.gyms) ? data.data.gyms : []),
    [data?.data?.gyms],
  );

  const gymSearchSuggestions = useMemo(() => {
    const seen = new Set();
    const suggestions = [];

    const pushSuggestion = (value) => {
      const text = String(value || '').trim();
      if (!text) {
        return;
      }

      const key = text.toLowerCase();
      if (seen.has(key)) {
        return;
      }

      seen.add(key);
      suggestions.push(text);
    };

    gyms.forEach((gym) => {
      pushSuggestion(gym?.name);
    });

    return suggestions;
  }, [gyms]);

  const selectedGym = useMemo(
    () => gyms.find((gym) => gym.id === selectedGymId) ?? gyms[0],
    [selectedGymId, gyms],
  );

  const shouldFetchMembership = canManageMembership && Boolean(selectedGym?.id);

  const {
    data: membershipResponse,
    isFetching: isMembershipFetching,
    refetch: refetchMembership,
  } = useGetMyGymMembershipQuery(selectedGym?.id, {
    skip: !shouldFetchMembership,
  });

  const membership = useMemo(
    () => membershipResponse?.data?.membership ?? null,
    [membershipResponse?.data?.membership],
  );

  const { data: trainersResponse } = useGetGymTrainersQuery(selectedGym?.id, {
    skip: !selectedGym?.id,
  });

  const trainers = useMemo(
    () => (Array.isArray(trainersResponse?.data?.trainers) ? trainersResponse.data.trainers : []),
    [trainersResponse?.data?.trainers],
  );

  // Track impressions when a gym is viewed
  useEffect(() => {
    if (selectedGym?.id) {
      recordImpression(selectedGym.id);
    }
  }, [selectedGym?.id, recordImpression]);

  useEffect(() => {
    setActionError(null);
  }, [selectedGymId]);

  useEffect(() => {
    if (queryGymId) {
      setSelectedGymId(queryGymId);
    }
  }, [queryGymId]);

  useEffect(() => {
    const clearStripeQuery = () => {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('stripe');
      nextParams.delete('payment_session_id');
      nextParams.delete('session_id');
      setSearchParams(nextParams, { replace: true });
    };

    if (!stripeStatus) {
      processedSessionRef.current = null;
      return;
    }

    if (stripeStatus === 'cancelled') {
      setStripeNotice('Stripe checkout was cancelled. Membership was not activated.');
      clearStripeQuery();
      return;
    }

    if (stripeStatus !== 'success' || !paymentSessionId) {
      clearStripeQuery();
      return;
    }

    if (processedSessionRef.current === paymentSessionId) {
      return;
    }
    processedSessionRef.current = paymentSessionId;

    const confirmStripePayment = async () => {
      try {
        await confirmPaymentSession({
          paymentSessionId,
          sessionId: stripeSessionId || undefined,
        }).unwrap();

        setStripeNotice('Payment successful. Membership activated.');
        await Promise.all([
          refetch(),
          shouldFetchMembership && refetchMembership ? refetchMembership() : Promise.resolve(),
        ]);
      } catch (error) {
        setActionError(
          error?.data?.message
            ?? 'Payment completed, but membership confirmation failed. Please refresh and retry.',
        );
      } finally {
        clearStripeQuery();
      }
    };

    confirmStripePayment();
  }, [
    stripeStatus,
    paymentSessionId,
    stripeSessionId,
    searchParams,
    setSearchParams,
    confirmPaymentSession,
    refetch,
    shouldFetchMembership,
    refetchMembership,
  ]);

  const handleJoin = useCallback(async (payload) => {
    if (!selectedGym?.id || !canManageMembership) {
      return;
    }
    setActionError(null);
    try {
      if (payload?.joinAsTrainer) {
        await joinGym({ gymId: selectedGym.id, ...payload }).unwrap();
        await Promise.all([
          refetch(),
          shouldFetchMembership && refetchMembership ? refetchMembership() : Promise.resolve(),
        ]);
        return;
      }

      const response = await createMembershipStripeCheckoutSession({
        gymId: selectedGym.id,
        ...payload,
        redirectPath: `/gyms?gymId=${selectedGym.id}`,
      }).unwrap();
      const checkoutUrl = response?.data?.checkoutUrl;
      if (!checkoutUrl) {
        throw new Error('Missing Stripe checkout URL.');
      }
      window.location.assign(checkoutUrl);
    } catch (error) {
      setActionError(error?.data?.message ?? 'Could not join the gym. Please try again.');
    }
  }, [
    selectedGym?.id,
    canManageMembership,
    joinGym,
    createMembershipStripeCheckoutSession,
    refetch,
    shouldFetchMembership,
    refetchMembership,
  ]);

  const handleLeave = useCallback(async () => {
    if (!selectedGym?.id || !membership?.id) {
      return;
    }
    setActionError(null);
    try {
      await leaveGym({ gymId: selectedGym.id, membershipId: membership.id }).unwrap();
      await Promise.all([
        refetch(),
        shouldFetchMembership && refetchMembership ? refetchMembership() : Promise.resolve(),
      ]);
    } catch (error) {
      setActionError(error?.data?.message ?? 'Could not update your membership.');
    }
  }, [selectedGym?.id, membership?.id, leaveGym, refetch, shouldFetchMembership, refetchMembership]);

  return (
    <div className="gym-explorer">
      <aside className="gym-explorer__sidebar">
        <GymFilters filters={filters} onChange={setFilters} searchSuggestions={gymSearchSuggestions} />
        <GymList
          gyms={gyms}
          isLoading={isFetching}
          onSelect={setSelectedGymId}
          selectedGymId={selectedGym?.id ?? null}
        />
      </aside>
      <section className="gym-explorer__detail">
        {stripeNotice ? <p>{stripeNotice}</p> : null}
        <GymHighlight
          gym={selectedGym}
          isLoading={isFetching}
          membership={membership}
          isMembershipLoading={isMembershipFetching && shouldFetchMembership}
          canManageMembership={canManageMembership}
          isAuthenticated={isAuthenticated}
          onJoin={handleJoin}
          onLeave={handleLeave}
          isJoining={isJoining}
          isLeaving={isLeaving}
          actionError={actionError}
          userRole={userRole}
          trainers={trainers}
          userId={userId}
        />
      </section>
    </div>
  );
};

export default GymExplorerPage;
