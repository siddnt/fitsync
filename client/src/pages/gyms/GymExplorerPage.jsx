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
import { getGymImpressionViewerId } from '../../utils/impressionViewer.js';
import './GymExplorerPage.css';

const toPositiveNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
};

const isSponsoredGym = (gym) =>
  gym?.sponsorship?.status === 'active' && gym?.sponsorship?.tier !== 'none';

const buildDiscoveryMeta = (gym) => {
  const ratingCount = toPositiveNumber(gym?.analytics?.ratingCount);
  const rating = Number(gym?.analytics?.rating ?? 0);
  const impressions = toPositiveNumber(gym?.analytics?.impressions);
  const memberships = toPositiveNumber(gym?.analytics?.memberships);
  const sponsorTier = String(gym?.sponsorship?.tier ?? '').trim();

  if (isSponsoredGym(gym)) {
    return {
      tone: 'sponsored',
      label: sponsorTier ? `${sponsorTier} sponsor` : 'Sponsored',
      reason: 'Prioritised placement from an active sponsorship package.',
    };
  }

  if (ratingCount >= 2 && rating >= 4.5) {
    return {
      tone: 'featured',
      label: 'Featured',
      reason: `Strong member sentiment with ${rating.toFixed(1)} / 5 across ${ratingCount} reviews.`,
    };
  }

  if (impressions >= 1500) {
    return {
      tone: 'trending',
      label: 'Trending',
      reason: `High current discovery traffic with ${impressions.toLocaleString('en-IN')} tracked impressions.`,
    };
  }

  if (memberships >= 2) {
    return {
      tone: 'featured',
      label: 'Popular',
      reason: `${memberships} active memberships already running at this gym.`,
    };
  }

  return {
    tone: 'standard',
    label: 'Active',
    reason: 'Published and ready for new memberships.',
  };
};

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
  const viewerId = useMemo(() => getGymImpressionViewerId(), []);

  const user = useSelector((state) => state.auth.user);
  const userRole = user?.role ?? null;
  const userId = user?._id ?? user?.id ?? null;
  const isAuthenticated = Boolean(user);
  const canManageMembership = ['trainee', 'trainer'].includes(userRole);

  const gyms = useMemo(
    () => (Array.isArray(data?.data?.gyms) ? data.data.gyms : []),
    [data?.data?.gyms],
  );

  const enrichedGyms = useMemo(
    () => gyms.map((gym) => ({
      ...gym,
      discovery: buildDiscoveryMeta(gym),
    })),
    [gyms],
  );

  const selectedGym = useMemo(
    () => enrichedGyms.find((gym) => gym.id === selectedGymId) ?? enrichedGyms[0],
    [selectedGymId, enrichedGyms],
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
    enrichedGyms.flatMap((gym) => [
      { id: `name-${gym.id}`, label: gym.name, meta: `${gym.city ?? 'Unknown city'} gym` },
      { id: `city-${gym.id}`, label: gym.city, meta: `City | ${gym.name ?? 'Unnamed gym'}` },
      { id: `postal-${gym.id}`, label: gym.postalCode, meta: `PIN | ${gym.name ?? 'Unnamed gym'}` },
      ...((gym.amenities || []).map((amenity, index) => ({
        id: `amenity-${gym.id}-${index}`,
        label: amenity,
        meta: `Amenity | ${gym.name ?? 'Unnamed gym'}`,
      }))),
    ]),
    filters.search,
  ), [enrichedGyms, filters.search]);

  const citySuggestions = useMemo(() => buildSuggestionList(
    enrichedGyms.flatMap((gym) => ([
      {
        id: `city-${gym.id}`,
        label: gym.city,
        meta: `${gym.name ?? 'Listed gym'} | City`,
      },
      {
        id: `postal-${gym.id}`,
        label: gym.postalCode,
        meta: `${gym.name ?? 'Listed gym'} | PIN code`,
      },
    ])),
    filters.city,
  ), [enrichedGyms, filters.city]);

  useEffect(() => {
    if (selectedGymId && selectedGym?.id === selectedGymId) {
      recordImpression({ id: selectedGym.id, viewerId });
    }
  }, [selectedGym?.id, selectedGymId, viewerId, recordImpression]);

  useEffect(() => {
    setActionError(null);
  }, [selectedGymId]);

  const handleJoin = useCallback(async (payload) => {
    if (!selectedGym?.id || !canManageMembership) {
      return;
    }
    setActionError(null);
    try {
      const response = await joinGym({ gymId: selectedGym.id, ...payload }).unwrap();
      const checkoutUrl = response?.data?.checkoutUrl;

      if (checkoutUrl) {
        window.location.assign(checkoutUrl);
        return;
      }

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
          gyms={enrichedGyms}
          isLoading={isFetching}
          onSelect={setSelectedGymId}
          selectedGymId={selectedGym?.id ?? null}
        />
        <p
          className="gym-explorer__rankings-note"
          title="Sponsored gyms surface first. Among the rest, ranking favours stronger member interest (ratings, memberships, discovery traffic) and newer live listings."
        >
          Sponsored listings appear first.
          <span className="gym-explorer__rankings-note-icon" aria-hidden="true">i</span>
        </p>
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
