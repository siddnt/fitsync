import { useCallback, useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import SkeletonPanel from '../../../ui/SkeletonPanel.jsx';
import GymMembershipActions from './GymMembershipActions.jsx';
import { useGetGymReviewsQuery, useSubmitGymReviewMutation } from '../../../services/gymsApi.js';
import { formatDate, formatStatus } from '../../../utils/format.js';

const parseAmount = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
};

const GymHighlight = ({
  gym = null,
  isLoading = false,
  membership = null,
  isMembershipLoading = false,
  canManageMembership = false,
  isAuthenticated = false,
  onJoin = undefined,
  onLeave = undefined,
  isJoining = false,
  isLeaving = false,
  actionError = null,
  userRole = null,
  trainers = [],
  userId = null,
}) => {
  const gymId = gym?.id ?? null;
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewStatus, setReviewStatus] = useState({ error: null, success: null });

  const {
    data: reviewsResponse,
    isFetching: isReviewsFetching,
    refetch: refetchReviews,
  } = useGetGymReviewsQuery(gymId, { skip: !gymId });

  const [submitGymReview, { isLoading: isSubmittingReview }] = useSubmitGymReviewMutation();

  const reviews = useMemo(() => {
    const reviewList = Array.isArray(reviewsResponse?.data?.reviews)
      ? reviewsResponse.data.reviews
      : Array.isArray(gym?.reviews)
        ? gym.reviews
        : [];
    return [...reviewList].sort((a, b) => {
      const parseEntryDate = (entry) => new Date(entry?.updatedAt ?? entry?.createdAt ?? 0).getTime();
      return parseEntryDate(b) - parseEntryDate(a);
    });
  }, [reviewsResponse?.data?.reviews, gym?.reviews]);

  const existingUserReview = useMemo(() => {
    if (!reviews.length || !userId) {
      return null;
    }
    return reviews.find((review) => review.authorId === userId) ?? null;
  }, [reviews, userId]);

  useEffect(() => {
    if (existingUserReview) {
      setReviewRating(existingUserReview.rating);
      setReviewComment(existingUserReview.comment);
    } else {
      setReviewRating(5);
      setReviewComment('');
    }
  }, [existingUserReview]);

  useEffect(() => {
    setReviewStatus({ error: null, success: null });
  }, [gymId]);

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

  const handleReviewSubmit = useCallback(async (event) => {
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
      if (refetchReviews) {
        await refetchReviews();
      }
    } catch (error) {
      setReviewStatus({ error: error?.data?.message ?? 'Could not save your review.', success: null });
    }
  }, [gymId, canSubmitReview, reviewComment, reviewRating, submitGymReview, refetchReviews]);

  if (isLoading && !gym) {
    return <SkeletonPanel lines={12} />;
  }

  if (!gym) {
    return (
      <div className="gym-highlight gym-highlight--empty">
        <p>No gyms are published yet. Check back soon or encourage owners to list their spaces.</p>
      </div>
    );
  }

  const isSponsored = gym.sponsorship?.status === 'active' && gym.sponsorship?.tier !== 'none';
  const discovery = gym.discovery ?? (isSponsored
    ? {
      tone: 'sponsored',
      label: gym.sponsorship?.tier ? `${gym.sponsorship.tier} sponsor` : 'Sponsored',
      reason: 'Prioritised placement from an active sponsorship package.',
    }
    : null);
  const currencyPrefix = gym.pricing?.currency === 'INR' || !gym.pricing?.currency ? 'Rs ' : `${gym.pricing.currency} `;
  const headlinePrice = parseAmount(gym.pricing?.startingAt ?? gym.pricing?.discounted ?? gym.pricing?.mrp);
  const headlineMrp = parseAmount(
    gym.pricing?.startingAt !== undefined && gym.pricing?.startingAt !== null
      ? gym.pricing?.startingAtMrp
      : gym.pricing?.mrp,
  );
  const headlinePlanLabel = gym.pricing?.startingPlanLabel ?? gym.pricing?.defaultPlanLabel ?? null;
  const featureList = Array.isArray(gym.features)
    ? gym.features.map((feature) => String(feature ?? '').trim()).filter(Boolean)
    : [];
  const description = String(gym.description ?? '').trim();
  const ownerLabel = gym.owner?.name || gym.owner?.email || 'Owner details not published';
  const contactSummary = [
    gym.contact?.phone,
    gym.contact?.email,
    gym.contact?.website,
  ].filter(Boolean).join(' | ') || 'Contact details not published';
  const workingDays = Array.isArray(gym.schedule?.workingDays)
    ? gym.schedule.workingDays
    : Array.isArray(gym.schedule?.days)
      ? gym.schedule.days
      : [];
  const workingDayLabel = workingDays.length
    ? workingDays.map((day) => formatStatus(day)).join(', ')
    : 'Working days not published';
  const timingLabel = gym.schedule?.open && gym.schedule?.close
    ? `${gym.schedule.open} - ${gym.schedule.close}`
    : 'Timings not published';
  const trainerSummary = trainers.length
    ? `${trainers.length} trainer${trainers.length > 1 ? 's' : ''} available`
    : 'Trainer roster not published';

  return (
    <article className="gym-highlight">
      {discovery ? (
        <div className={`gym-highlight__discovery-banner gym-highlight__discovery-banner--${discovery.tone ?? 'standard'}`}>
          <div>
            <small>Discovery status</small>
            <strong>{discovery.label}</strong>
            <p>{discovery.reason}</p>
          </div>
          {isSponsored ? (
            <span className="gym-highlight__discovery-tier">{gym.sponsorship?.tier ?? 'sponsored'}</span>
          ) : null}
        </div>
      ) : null}
      <header className="gym-highlight__header">
        <div>
          <h1>{gym.name}</h1>
          <p>{gym.location?.address}</p>
        </div>
        <div className="gym-highlight__pricing">
          <span className="price">
            {headlinePrice !== null ? `${currencyPrefix}${headlinePrice.toLocaleString('en-IN')}` : 'Pricing unavailable'}
          </span>
          {headlineMrp !== null && headlinePrice !== null && headlineMrp > headlinePrice ? (
            <span className="price--mrp">{currencyPrefix}{headlineMrp.toLocaleString('en-IN')}</span>
          ) : null}
          {headlinePlanLabel ? (
            <small style={{ display: 'block', marginTop: '0.35rem', color: 'var(--muted-text-color)' }}>
              Starting with {headlinePlanLabel}
            </small>
          ) : null}
        </div>
      </header>

      <GymMembershipActions
        membership={membership}
        isLoading={isMembershipLoading}
        canManage={canManageMembership}
        isAuthenticated={isAuthenticated}
        onJoin={onJoin}
        onLeave={onLeave}
        isJoining={isJoining}
        isLeaving={isLeaving}
        error={actionError}
        userRole={userRole}
        trainers={trainers}
        pricingPlans={gym.pricing?.plans ?? []}
        currency={currencyPrefix}
      />

      <section className="gym-highlight__meta">
        <div>
          <strong>Owner</strong>
          <span>{ownerLabel}</span>
        </div>
        <div>
          <strong>Contact</strong>
          <span>{contactSummary}</span>
        </div>
        <div>
          <strong>Working days</strong>
          <span>{workingDayLabel}</span>
        </div>
        <div>
          <strong>Timings</strong>
          <span>{timingLabel}</span>
        </div>
        <div>
          <strong>Trainer roster</strong>
          <span>{trainerSummary}</span>
        </div>
      </section>

      <section className="gym-highlight__features">
        <h2>Key features</h2>
        {featureList.length ? (
          <div>
            {featureList.map((feature) => (
              <span key={feature}>{feature}</span>
            ))}
          </div>
        ) : (
          <p className="gym-highlight__review-notice">This gym has not published feature badges yet.</p>
        )}
      </section>

      <section className="gym-highlight__about">
        <h2>About</h2>
        {description ? (
          <p>{description}</p>
        ) : (
          <p className="gym-highlight__review-notice">The owner has not published a gym description yet.</p>
        )}
      </section>

      <section className="gym-highlight__meta">
        <div>
          <strong>Pricing</strong>
          <span>
            {headlinePrice !== null
              ? `${currencyPrefix}${headlinePrice.toLocaleString('en-IN')}${headlinePlanLabel ? ` starting with ${headlinePlanLabel}` : ''}`
              : 'Pricing not published'}
          </span>
        </div>
        <div>
          <strong>Ratings</strong>
          <span>
            {gym.analytics?.ratingCount
              ? `${(Number(gym.analytics?.rating ?? 0)).toFixed(1)} / 5 from ${gym.analytics.ratingCount} reviews`
              : 'No ratings yet'}
          </span>
        </div>
        <div>
          <strong>Membership</strong>
          <span>{membership ? `Your status: ${formatStatus(membership.status)}` : 'Open to new memberships'}</span>
        </div>
        <div>
          <strong>More details</strong>
          <span><Link to={`/gyms/${gym.id}`}>Open full gym profile</Link></span>
        </div>
      </section>

      <section className="gym-highlight__reviews">
        <div className="gym-highlight__reviews-header">
          <h2>Member reviews</h2>
          {gym.analytics?.ratingCount ? (
            <span>
              {(Number(gym.analytics?.rating ?? 0)).toFixed(1)} / 5 from {gym.analytics.ratingCount} ratings
            </span>
          ) : (
            <span>Be the first to review this gym</span>
          )}
        </div>

        <div className="gym-highlight__reviews-list">
          {isReviewsFetching && !reviews.length ? <p>Loading reviews...</p> : null}
          {reviews.length ? (
            reviews.slice(0, 3).map((review) => {
              const starCount = Math.round(Number(review.rating) || 0);
              return (
                <article key={review.id}>
                  <header>
                    <div>
                      <strong>{review.authorName ?? 'Member'}</strong>
                      <small>
                        {review.updatedAt || review.createdAt
                          ? formatDate(review.updatedAt ?? review.createdAt)
                          : null}
                      </small>
                    </div>
                    <span>{starCount ? `${starCount} / 5` : '-'}</span>
                  </header>
                  <p>{review.comment}</p>
                </article>
              );
            })
          ) : (
            <p className="gym-highlight__reviews-empty">No reviews yet.</p>
          )}
        </div>

        <div className="gym-highlight__review-form">
          <h3>Share your experience</h3>
          {canSubmitReview ? (
            <form onSubmit={handleReviewSubmit}>
              <label htmlFor="gym-highlight-review-rating">Your rating</label>
              <select
                id="gym-highlight-review-rating"
                value={reviewRating}
                onChange={(event) => setReviewRating(Number(event.target.value))}
              >
                {[5, 4, 3, 2, 1].map((value) => (
                  <option key={value} value={value}>{`${value} star${value > 1 ? 's' : ''}`}</option>
                ))}
              </select>

              <label htmlFor="gym-highlight-review-comment">Your feedback</label>
              <textarea
                id="gym-highlight-review-comment"
                rows={4}
                maxLength={500}
                value={reviewComment}
                onChange={(event) => setReviewComment(event.target.value)}
                placeholder="What stood out about this gym?"
                required
              />

              {reviewStatus.error && <p className="gym-highlight__review-error">{reviewStatus.error}</p>}
              {reviewStatus.success && (
                <p className="gym-highlight__review-success">{reviewStatus.success}</p>
              )}

              <button type="submit" disabled={isSubmittingReview}>
                {existingUserReview ? 'Update review' : 'Submit review'}
              </button>
            </form>
          ) : (
            <p className="gym-highlight__review-notice">
              {reviewNotice ?? 'You need an active membership to leave a review.'}
            </p>
          )}
        </div>
      </section>
    </article>
  );
};

GymHighlight.propTypes = {
  gym: PropTypes.shape({
    id: PropTypes.string,
    name: PropTypes.string,
    pricing: PropTypes.shape({
      mrp: PropTypes.number,
      discounted: PropTypes.number,
      startingAt: PropTypes.number,
      startingAtMrp: PropTypes.number,
      startingPlanLabel: PropTypes.string,
      defaultPlanLabel: PropTypes.string,
      plans: PropTypes.arrayOf(
        PropTypes.shape({
          code: PropTypes.string,
          label: PropTypes.string,
          durationMonths: PropTypes.number,
          mrp: PropTypes.number,
          price: PropTypes.number,
        }),
      ),
    }),
    owner: PropTypes.shape({
      name: PropTypes.string,
      email: PropTypes.string,
    }),
    location: PropTypes.shape({
      address: PropTypes.string,
    }),
    contact: PropTypes.shape({
      phone: PropTypes.string,
      email: PropTypes.string,
      website: PropTypes.string,
    }),
    schedule: PropTypes.shape({
      days: PropTypes.arrayOf(PropTypes.string),
      open: PropTypes.string,
      close: PropTypes.string,
    }),
    features: PropTypes.arrayOf(PropTypes.string),
    description: PropTypes.string,
    reviews: PropTypes.arrayOf(
      PropTypes.shape({
        id: PropTypes.string,
        authorName: PropTypes.string,
        rating: PropTypes.number,
        comment: PropTypes.string,
      }),
    ),
    sponsorship: PropTypes.shape({
      status: PropTypes.string,
      tier: PropTypes.string,
    }),
    discovery: PropTypes.shape({
      tone: PropTypes.string,
      label: PropTypes.string,
      reason: PropTypes.string,
    }),
    analytics: PropTypes.shape({
      rating: PropTypes.number,
      ratingCount: PropTypes.number,
    }),
  }),
  isLoading: PropTypes.bool,
  membership: PropTypes.shape({
    id: PropTypes.string,
    status: PropTypes.string,
  }),
  isMembershipLoading: PropTypes.bool,
  canManageMembership: PropTypes.bool,
  isAuthenticated: PropTypes.bool,
  onJoin: PropTypes.func,
  onLeave: PropTypes.func,
  isJoining: PropTypes.bool,
  isLeaving: PropTypes.bool,
  actionError: PropTypes.string,
  userRole: PropTypes.string,
  trainers: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
    }),
  ),
  userId: PropTypes.string,
};

export default GymHighlight;
