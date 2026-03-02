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
  useGetGymReviewsQuery,
  useSubmitGymReviewMutation,
} from '../../services/gymsApi.js';
import { formatDate } from '../../utils/format.js';
import SkeletonPanel from '../../ui/SkeletonPanel.jsx';
import GymMembershipActions from './components/GymMembershipActions.jsx';
import './GymDetailsPage.css';

const GymDetailsPage = () => {
  const { gymId } = useParams();
  const { data, isLoading, refetch } = useGetGymByIdQuery(gymId, { skip: !gymId });
  const [recordImpression] = useRecordImpressionMutation();
  const [joinGym, { isLoading: isJoining }] = useJoinGymMutation();
  const [leaveGym, { isLoading: isLeaving }] = useLeaveGymMutation();
  const [submitGymReview, { isLoading: isSubmittingReview }] = useSubmitGymReviewMutation();
  const [actionError, setActionError] = useState(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewStatus, setReviewStatus] = useState({ error: null, success: null });

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
  } = useGetMyGymMembershipQuery(gymId, {
    skip: !shouldFetchMembership,
    refetchOnFocus: true,
    refetchOnReconnect: true,
  });

  const membership = useMemo(
    () => membershipResponse?.data?.membership ?? null,
    [membershipResponse?.data?.membership],
  );

  const { data: trainersResponse } = useGetGymTrainersQuery(gymId, { skip: !gymId });
  const {
    data: reviewsResponse,
    refetch: refetchReviews,
    isFetching: isReviewsFetching,
  } = useGetGymReviewsQuery(gymId, { skip: !gymId });

  const trainers = useMemo(
    () => (Array.isArray(trainersResponse?.data?.trainers) ? trainersResponse.data.trainers : []),
    [trainersResponse?.data?.trainers],
  );

  const reviews = useMemo(() => {
    const reviewList = Array.isArray(reviewsResponse?.data?.reviews)
      ? reviewsResponse.data.reviews
      : Array.isArray(gym?.reviews)
        ? gym.reviews
        : [];
    return [...reviewList].sort((a, b) => {
      const parseDate = (entry) => new Date(entry?.updatedAt ?? entry?.createdAt ?? 0).getTime();
      return parseDate(b) - parseDate(a);
    });
  }, [reviewsResponse?.data?.reviews, gym?.reviews]);

  const userId = user?._id ?? user?.id ?? null;
  const existingUserReview = useMemo(() => {
    if (!reviews.length || !userId) {
      return null;
    }
    return reviews.find((review) => review.authorId === userId) ?? null;
  }, [reviews, userId]);

  useEffect(() => {
    if (gymId) {
      recordImpression(gymId);
    }
  }, [gymId, recordImpression]);

  useEffect(() => {
    setActionError(null);
  }, [gymId]);

  useEffect(() => {
    setReviewStatus({ error: null, success: null });
  }, [gymId]);

  useEffect(() => {
    if (existingUserReview) {
      setReviewRating(existingUserReview.rating);
      setReviewComment(existingUserReview.comment);
    }
  }, [existingUserReview]);

  useEffect(() => {
    if (membership?.plan === 'trainer-access' && membership?.status === 'pending' && refetchMembership) {
      const intervalId = setInterval(() => {
        refetchMembership();
      }, 15000);

      return () => clearInterval(intervalId);
    }

    return undefined;
  }, [membership?.plan, membership?.status, refetchMembership]);

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

  const canSubmitReview = useMemo(() => {
    if (userRole !== 'trainee' || !membership) {
      return false;
    }
    return ['active', 'paused', 'expired'].includes(membership.status);
  }, [membership, userRole]);

  const reviewNotice = useMemo(() => {
    if (!isAuthenticated) {
      return 'Sign in as a trainee to share your experience.';
    }
    if (userRole !== 'trainee') {
      return 'Only trainees can submit gym reviews.';
    }
    if (!membership) {
      return 'Join this gym to leave a review.';
    }
    if (membership.status === 'pending') {
      return 'Activate your membership to share a review.';
    }
    if (membership.status === 'cancelled') {
      return 'Cancelled memberships cannot create new reviews.';
    }
    return null;
  }, [isAuthenticated, membership, userRole]);

  const handleReviewSubmit = useCallback(
    async (event) => {
      event.preventDefault();
      if (!gymId || !canSubmitReview) {
        return;
      }
      const trimmedComment = reviewComment.trim();
      if (!trimmedComment) {
        setReviewStatus({ error: 'Please add a few words about your experience.', success: null });
        return;
      }
      setReviewStatus({ error: null, success: null });
      try {
        await submitGymReview({ gymId, rating: reviewRating, comment: trimmedComment }).unwrap();
        setReviewComment(trimmedComment);
        setReviewStatus({ error: null, success: 'Thanks for sharing your experience!' });
        await Promise.all([
          refetch(),
          refetchReviews ? refetchReviews() : Promise.resolve(),
        ]);
      } catch (error) {
        setReviewStatus({ error: error?.data?.message ?? 'Could not save your review.', success: null });
      }
    },
    [gymId, canSubmitReview, submitGymReview, reviewRating, reviewComment, refetch, refetchReviews],
  );

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
        <div className="gym-details__reviews-header">
          <h2>Member reviews</h2>
          {gym.analytics?.ratingCount ? (
            <span>
              {(Number(gym.analytics?.rating ?? 0)).toFixed(1)} · {gym.analytics.ratingCount} ratings
            </span>
          ) : (
            <span>Be the first to review this gym</span>
          )}
        </div>

        <div className="gym-details__reviews-list">
          {isReviewsFetching && !reviews.length ? <p>Loading reviews…</p> : null}
          {reviews.length ? (
            reviews.map((review) => {
              const starCount = Math.round(Number(review.rating) || 0);
              return (
                <article key={review.id}>
                  <header>
                    <div>
                      <strong>{review.authorName ?? 'Member'}</strong>
                      <small>{review.updatedAt || review.createdAt ? formatDate(review.updatedAt ?? review.createdAt) : null}</small>
                    </div>
                    <span>{starCount ? '★'.repeat(starCount) : '—'}</span>
                  </header>
                  <p>{review.comment}</p>
                </article>
              );
            })
          ) : (
            <p className="gym-details__reviews-empty">No reviews yet.</p>
          )}
        </div>

        <div className="gym-review-form-wrapper">
          <h3>Share your experience</h3>
          {canSubmitReview ? (
            <form className="gym-review-form" onSubmit={handleReviewSubmit}>
              <label htmlFor="gym-review-rating">Your rating</label>
              <select
                id="gym-review-rating"
                value={reviewRating}
                onChange={(event) => setReviewRating(Number(event.target.value))}
              >
                {[5, 4, 3, 2, 1].map((value) => (
                  <option key={value} value={value}>{`${value} star${value > 1 ? 's' : ''}`}</option>
                ))}
              </select>

              <label htmlFor="gym-review-comment">Your feedback</label>
              <textarea
                id="gym-review-comment"
                rows={4}
                maxLength={500}
                value={reviewComment}
                onChange={(event) => setReviewComment(event.target.value)}
                placeholder="What stood out about this gym?"
                required
              />

              {reviewStatus.error && <p className="gym-review-form__error">{reviewStatus.error}</p>}
              {reviewStatus.success && (
                <p className="gym-review-form__success">{reviewStatus.success}</p>
              )}

              <button type="submit" disabled={isSubmittingReview}>
                {existingUserReview ? 'Update review' : 'Submit review'}
              </button>
            </form>
          ) : (
            <p className="gym-review-form__notice">
              {reviewNotice ?? 'You need an active membership to leave a review.'}
            </p>
          )}
        </div>
      </section>
    </div>
  );
};

export default GymDetailsPage;
