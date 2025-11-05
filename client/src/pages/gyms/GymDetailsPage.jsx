import { useParams } from 'react-router-dom';
import { useEffect, useMemo, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import {
  useGetGymByIdQuery,
  useRecordImpressionMutation,
  useGetMyGymMembershipQuery,
  useJoinGymMutation,
  useLeaveGymMutation,
  useGetGymTrainersQuery,
} from '../../services/gymsApi.js';
import SkeletonPanel from '../../ui/SkeletonPanel.jsx';
import GymMembershipActions from './components/GymMembershipActions.jsx';
import './GymDetailsPage.css';

const GymDetailsPage = () => {
  const { gymId } = useParams();
  const { data, isLoading, refetch } = useGetGymByIdQuery(gymId, { skip: !gymId });
  const [recordImpression] = useRecordImpressionMutation();
  const [joinGym, { isLoading: isJoining }] = useJoinGymMutation();
  const [leaveGym, { isLoading: isLeaving }] = useLeaveGymMutation();
  const [actionError, setActionError] = useState(null);

  const user = useSelector((state) => state.auth.user);
  const userRole = user?.role ?? null;
  const isAuthenticated = Boolean(user);
  const canManageMembership = ['trainee', 'trainer'].includes(userRole);

  const gym = data?.data?.gym ?? null;
  const shouldFetchMembership = canManageMembership && Boolean(gymId);

  const {
    data: membershipResponse,
    isFetching: isMembershipFetching,
    refetch: refetchMembership,
  } = useGetMyGymMembershipQuery(gymId, { skip: !shouldFetchMembership });

  const membership = useMemo(
    () => membershipResponse?.data?.membership ?? null,
    [membershipResponse?.data?.membership],
  );

  const { data: trainersResponse } = useGetGymTrainersQuery(gymId, { skip: !gymId });

  const trainers = useMemo(
    () => (Array.isArray(trainersResponse?.data?.trainers) ? trainersResponse.data.trainers : []),
    [trainersResponse?.data?.trainers],
  );

  useEffect(() => {
    if (gymId) {
      recordImpression(gymId);
    }
  }, [gymId, recordImpression]);

  useEffect(() => {
    setActionError(null);
  }, [gymId]);

  const handleJoin = useCallback(async (payload) => {
    if (!gymId || !canManageMembership) {
      return;
    }
    setActionError(null);
    try {
      await joinGym({ gymId, ...payload }).unwrap();
      await Promise.all([
        refetch(),
        shouldFetchMembership && refetchMembership ? refetchMembership() : Promise.resolve(),
      ]);
    } catch (error) {
      setActionError(error?.data?.message ?? 'Could not join the gym. Please try again.');
    }
  }, [gymId, canManageMembership, joinGym, refetch, shouldFetchMembership, refetchMembership]);

  const handleLeave = useCallback(async () => {
    if (!gymId || !membership?.id) {
      return;
    }
    setActionError(null);
    try {
      await leaveGym({ gymId, membershipId: membership.id }).unwrap();
      await Promise.all([
        refetch(),
        shouldFetchMembership && refetchMembership ? refetchMembership() : Promise.resolve(),
      ]);
    } catch (error) {
      setActionError(error?.data?.message ?? 'Could not update your membership.');
    }
  }, [gymId, membership?.id, leaveGym, refetch, shouldFetchMembership, refetchMembership]);

  if (isLoading) {
    return <SkeletonPanel lines={18} />;
  }

  if (!gym) {
    return (
      <div className="gym-details__empty">
        <p>We could not find this gym. It might have been removed.</p>
      </div>
    );
  }

  return (
    <div className="gym-details">
      <header className="gym-details__header">
        <div>
          <h1>{gym.name}</h1>
          <p>{gym.location?.address}</p>
        </div>
        <div className="gym-details__pricing">
          <span className="price">₹{gym.pricing?.discounted ?? gym.pricing?.mrp ?? 'N/A'}</span>
          {gym.pricing?.mrp && gym.pricing?.discounted && (
            <span className="price--mrp">₹{gym.pricing.mrp}</span>
          )}
        </div>
      </header>

      <GymMembershipActions
        membership={membership}
        isLoading={isMembershipFetching && shouldFetchMembership}
        canManage={canManageMembership}
        isAuthenticated={isAuthenticated}
        onJoin={handleJoin}
        onLeave={handleLeave}
        isJoining={isJoining}
        isLeaving={isLeaving}
        error={actionError}
        userRole={userRole}
        trainers={trainers}
        monthlyFee={gym.pricing?.discounted ?? gym.pricing?.mrp ?? null}
        currency={gym.pricing?.currency === 'INR' || !gym.pricing?.currency ? '₹' : `${gym.pricing.currency} `}
      />

      <section className="gym-details__gallery">
        {gym.gallery?.length ? (
          gym.gallery.map((image) => <img key={image} src={image} alt={gym.name} />)
        ) : (
          <div className="gym-details__placeholder">Gallery coming soon</div>
        )}
      </section>

      <section className="gym-details__grid">
        <article>
          <h2>Contact</h2>
          <p>{gym.contact?.phone}</p>
          <p>{gym.contact?.email}</p>
        </article>
        <article>
          <h2>Schedule</h2>
          <p>{gym.schedule?.days?.join(', ')}</p>
          <p>
            {gym.schedule?.open ?? '06:00'} - {gym.schedule?.close ?? '22:00'}
          </p>
        </article>
        <article>
          <h2>Features</h2>
          <div className="gym-details__chips">
            {(gym.features?.length ? gym.features : ['AC', 'Lockers']).map((feature) => (
              <span key={feature}>{feature}</span>
            ))}
          </div>
        </article>
      </section>

      <section className="gym-details__about">
        <h2>About this gym</h2>
        <p>{gym.description}</p>
      </section>

      <section className="gym-details__reviews">
        <h2>Reviews</h2>
        {gym.reviews?.length ? (
          gym.reviews.map((review) => (
            <article key={review.id}>
              <header>
                <strong>{review.authorName}</strong>
                <span>{'★'.repeat(review.rating)}</span>
              </header>
              <p>{review.comment}</p>
            </article>
          ))
        ) : (
          <p>No reviews yet.</p>
        )}
      </section>
    </div>
  );
};

export default GymDetailsPage;
