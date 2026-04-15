import { useMemo, useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import {
  useGetGymsQuery,
  useRecordImpressionMutation,
  useGetMyGymMembershipQuery,
  useJoinGymMutation,
  useLeaveGymMutation,
  useGetGymTrainersQuery,
} from '../../services/gymsApi.js';
import GymList from './components/GymList.jsx';
import GymFilters from './components/GymFilters.jsx';
import GymHighlight from './components/GymHighlight.jsx';
import { matchesPrefix } from '../../utils/search.js';
import './GymExplorerPage.css';

const buildSuggestionList = (items, query, noResults = []) => {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return [];
  }

  const seen = new Set();
  const suggestions = [];

  items.forEach((item) => {
    const normalizedLabel = item.label?.toString().trim();
    if (!normalizedLabel) {
      return;
    }

    const lower = normalizedLabel.toLowerCase();
    if (!matchesPrefix(lower, normalizedQuery)) {
      return;
    }

    const key = `${item.id}:${lower}`;
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    suggestions.push({
      id: key,
      label: normalizedLabel,
      meta: item.meta,
    });
  });

  return suggestions.concat(noResults).slice(0, 8);
};

const GymExplorerPage = () => {
  const [selectedGymId, setSelectedGymId] = useState(null);
  const [filters, setFilters] = useState({ search: '', city: '', amenities: [] });
  const { data, isFetching, refetch } = useGetGymsQuery(filters);
  const [recordImpression] = useRecordImpressionMutation();
  const [joinGym, { isLoading: isJoining }] = useJoinGymMutation();
  const [leaveGym, { isLoading: isLeaving }] = useLeaveGymMutation();
  const [actionError, setActionError] = useState(null);

  const user = useSelector((state) => state.auth.user);
  const userRole = user?.role ?? null;
  const userId = user?._id ?? user?.id ?? null;
  const isAuthenticated = Boolean(user);
  const canManageMembership = ['trainee', 'trainer'].includes(userRole);

  const gyms = useMemo(
    () => (Array.isArray(data?.data?.gyms) ? data.data.gyms : []),
    [data?.data?.gyms],
  );

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

  const searchSuggestions = useMemo(() => buildSuggestionList(
    gyms.flatMap((gym) => [
      { id: `name-${gym.id}`, label: gym.name, meta: `${gym.city ?? 'Unknown city'} gym` },
      { id: `city-${gym.id}`, label: gym.city, meta: `City • ${gym.name ?? 'Unnamed gym'}` },
      ...((gym.amenities || []).map((amenity, index) => ({
        id: `amenity-${gym.id}-${index}`,
        label: amenity,
        meta: `Amenity • ${gym.name ?? 'Unnamed gym'}`,
      }))),
    ]),
    filters.search,
  ), [gyms, filters.search]);

  const citySuggestions = useMemo(() => buildSuggestionList(
    gyms.map((gym) => ({
      id: `city-${gym.id}`,
      label: gym.city,
      meta: gym.name ?? 'Listed gym',
    })),
    filters.city,
  ), [gyms, filters.city]);

  // Track impressions when a gym is viewed
  useEffect(() => {
    if (selectedGym?.id) {
      recordImpression(selectedGym.id);
    }
  }, [selectedGym?.id, recordImpression]);

  useEffect(() => {
    setActionError(null);
  }, [selectedGymId]);

  const handleJoin = useCallback(async (payload) => {
    if (!selectedGym?.id || !canManageMembership) {
      return;
    }
    setActionError(null);
    try {
      await joinGym({ gymId: selectedGym.id, ...payload }).unwrap();
      await Promise.all([
        refetch(),
        shouldFetchMembership && refetchMembership ? refetchMembership() : Promise.resolve(),
      ]);
    } catch (error) {
      setActionError(error?.data?.message ?? 'Could not join the gym. Please try again.');
    }
  }, [selectedGym?.id, canManageMembership, joinGym, refetch, shouldFetchMembership, refetchMembership]);

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
        <GymFilters
          filters={filters}
          onChange={setFilters}
          searchSuggestions={searchSuggestions}
          citySuggestions={citySuggestions}
        />
        <GymList
          gyms={gyms}
          isLoading={isFetching}
          onSelect={setSelectedGymId}
          selectedGymId={selectedGym?.id ?? null}
        />
      </aside>
      <section className="gym-explorer__detail">
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
