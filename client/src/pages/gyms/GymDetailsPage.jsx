import { useEffect, useMemo, useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { Link, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  useGetGymByIdQuery,
  useRecordImpressionMutation,
  useRecordGymOpenMutation,
  useGetMyGymMembershipQuery,
  useJoinGymMutation,
  useLeaveGymMutation,
  useGetGymTrainersQuery,
  useGetGymReviewsQuery,
  useSubmitGymReviewMutation,
} from '../../services/gymsApi.js';
import { useGetBookableSlotsQuery } from '../../services/bookingApi.js';
import { formatDate, formatStatus } from '../../utils/format.js';
import { getGymImpressionViewerId } from '../../utils/impressionViewer.js';
import SkeletonPanel from '../../ui/SkeletonPanel.jsx';
import GymMembershipActions from './components/GymMembershipActions.jsx';
import './GymDetailsPage.css';

const SAVED_GYMS_STORAGE_KEY = 'fitsync:saved-gyms';
const WEEKDAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const parseAmount = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
};

const Icon = ({ name }) => {
  const props = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  };
  switch (name) {
    case 'star':
      return <svg {...props}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>;
    case 'clock':
      return <svg {...props}><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>;
    case 'badge':
      return <svg {...props}><path d="M12 2l3 6 6 .9-4.5 4.4 1 6.7L12 17l-5.5 3 1-6.7L3 8.9 9 8z" /></svg>;
    case 'pin':
      return <svg {...props}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>;
    case 'phone':
      return <svg {...props}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.86 19.86 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.86 19.86 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>;
    case 'dumbbell':
      return <svg {...props}><path d="M6 4v16M2 8v8M18 4v16M22 8v8M6 12h12" /></svg>;
    case 'calendar':
      return <svg {...props}><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>;
    default:
      return null;
  }
};
Icon.propTypes = { name: PropTypes.string.isRequired };

const normalizeWebsiteUrl = (value) => {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) {
    return '';
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed}`;
};

const buildMapLink = (gym) => {
  const parts = [
    gym?.location?.address,
    gym?.location?.city,
    gym?.location?.state,
  ].filter(Boolean);

  if (!parts.length) {
    return '';
  }

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(parts.join(', '))}`;
};

const formatWorkingDays = (workingDays = []) => {
  if (!Array.isArray(workingDays) || !workingDays.length) {
    return 'Schedule updates pending';
  }

  return workingDays.map((day) => formatStatus(day)).join(', ');
};

const getTrainerMeta = (trainer) => {
  const parts = [];

  if (typeof trainer?.experienceYears === 'number' && trainer.experienceYears > 0) {
    parts.push(`${trainer.experienceYears}+ years experience`);
  }

  if (typeof trainer?.mentoredCount === 'number' && trainer.mentoredCount > 0) {
    parts.push(`${trainer.mentoredCount} trainees supported`);
  }

  if (Array.isArray(trainer?.specializations) && trainer.specializations.length) {
    parts.push(trainer.specializations.slice(0, 3).join(', '));
  }

  return parts;
};

const buildWeeklyHours = (schedule = {}) => {
  const publishedDays = new Set(
    (Array.isArray(schedule?.workingDays) ? schedule.workingDays : [])
      .map((day) => String(day ?? '').trim().toLowerCase())
      .filter(Boolean),
  );
  const hoursLabel = schedule?.open && schedule?.close ? `${schedule.open} - ${schedule.close}` : 'Closed';

  return WEEKDAY_ORDER.map((day) => ({
    key: day,
    label: formatStatus(day),
    hours: publishedDays.has(day) ? hoursLabel : 'Closed',
  }));
};

const readSavedGyms = () => {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(SAVED_GYMS_STORAGE_KEY);
    const parsed = JSON.parse(raw ?? '[]');
    return Array.isArray(parsed) ? parsed.map((entry) => String(entry)) : [];
  } catch (_error) {
    return [];
  }
};

const writeSavedGyms = (ids) => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(SAVED_GYMS_STORAGE_KEY, JSON.stringify(ids));
};

const GymDetailsPage = () => {
  const { gymId } = useParams();
  const { data, isLoading, refetch } = useGetGymByIdQuery(gymId, { skip: !gymId });
  const [recordImpression] = useRecordImpressionMutation();
  const [recordGymOpen] = useRecordGymOpenMutation();
  const [joinGym, { isLoading: isJoining }] = useJoinGymMutation();
  const [leaveGym, { isLoading: isLeaving }] = useLeaveGymMutation();
  const [submitGymReview, { isLoading: isSubmittingReview }] = useSubmitGymReviewMutation();
  const [actionError, setActionError] = useState(null);
  const viewerId = useMemo(() => getGymImpressionViewerId(), []);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewStatus, setReviewStatus] = useState({ error: null, success: null });
  const [selectedMediaIndex, setSelectedMediaIndex] = useState(0);
  const [pageNotice, setPageNotice] = useState(null);
  const [isSaved, setIsSaved] = useState(false);

  const user = useSelector((state) => state.auth.user);
  const userRole = user?.role ?? null;
  const isAuthenticated = Boolean(user);
  const canManageMembership = ['trainee', 'trainer'].includes(userRole);
  const shouldFetchSessionPreview = userRole === 'trainee' && Boolean(gymId);

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
  const { data: sessionPreviewResponse } = useGetBookableSlotsQuery(
    { gymId, days: 10 },
    { skip: !shouldFetchSessionPreview },
  );

  const trainers = useMemo(
    () => (Array.isArray(trainersResponse?.data?.trainers) ? trainersResponse.data.trainers : []),
    [trainersResponse?.data?.trainers],
  );

  const sessionPreview = useMemo(() => {
    const slots = Array.isArray(sessionPreviewResponse?.data?.slots) ? sessionPreviewResponse.data.slots : [];
    return slots.slice(0, 4);
  }, [sessionPreviewResponse?.data?.slots]);

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

  const userId = user?._id ?? user?.id ?? null;
  const existingUserReview = useMemo(() => {
    if (!reviews.length || !userId) {
      return null;
    }
    return reviews.find((review) => review.authorId === userId) ?? null;
  }, [reviews, userId]);

  const mediaGallery = useMemo(
    () => (Array.isArray(gym?.gallery) ? gym.gallery.filter(Boolean) : []),
    [gym?.gallery],
  );
  const activeMedia = mediaGallery[selectedMediaIndex] ?? mediaGallery[0] ?? '';

  const featurePills = useMemo(() => {
    const values = [
      ...(Array.isArray(gym?.keyFeatures) ? gym.keyFeatures : []),
      ...(Array.isArray(gym?.amenities) ? gym.amenities : []),
      ...(Array.isArray(gym?.tags) ? gym.tags : []),
      ...(Array.isArray(gym?.features) ? gym.features : []),
    ]
      .map((entry) => String(entry ?? '').trim())
      .filter(Boolean);

    return [...new Set(values)];
  }, [gym?.amenities, gym?.features, gym?.keyFeatures, gym?.tags]);

  const locationLabel = useMemo(() => {
    const address = String(gym?.location?.address ?? '').trim();
    const cityState = [gym?.location?.city, gym?.location?.state].filter(Boolean).join(', ').trim();
    if (address && cityState && address.toLowerCase() !== cityState.toLowerCase()) {
      return `${address} | ${cityState}`;
    }
    return address || cityState;
  }, [gym?.location?.address, gym?.location?.city, gym?.location?.state]);

  const mapLink = useMemo(() => buildMapLink(gym), [gym]);
  const websiteUrl = useMemo(() => normalizeWebsiteUrl(gym?.contact?.website), [gym?.contact?.website]);
  const pricingPlans = useMemo(() => {
    const plans = Array.isArray(gym?.pricing?.plans) ? gym.pricing.plans : [];
    return [...plans]
      .filter((plan) => Number(plan?.price ?? plan?.mrp) > 0)
      .sort((left, right) => Number(left?.price ?? left?.mrp ?? 0) - Number(right?.price ?? right?.mrp ?? 0));
  }, [gym?.pricing?.plans]);
  const recommendedPlan = pricingPlans[0] ?? null;
  const weeklyHours = useMemo(() => buildWeeklyHours(gym?.schedule), [gym?.schedule]);

  useEffect(() => {
    if (gymId) {
      recordImpression({ id: gymId, viewerId });
      recordGymOpen({ id: gymId, viewerId });
    }
  }, [gymId, viewerId, recordImpression, recordGymOpen]);

  useEffect(() => {
    setActionError(null);
  }, [gymId]);

  useEffect(() => {
    setReviewStatus({ error: null, success: null });
  }, [gymId]);

  useEffect(() => {
    setSelectedMediaIndex(0);
    setPageNotice(null);
    setIsSaved(readSavedGyms().includes(String(gymId)));
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
      const response = await joinGym({ gymId, ...payload }).unwrap();
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

  const handleShareGym = useCallback(async () => {
    if (typeof window === 'undefined' || !gym) {
      return;
    }

    const url = window.location.href;
    const sharePayload = {
      title: gym.name,
      text: `Check out ${gym.name} on FitSync.`,
      url,
    };

    try {
      if (navigator.share) {
        await navigator.share(sharePayload);
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        throw new Error('Share not supported');
      }
      setPageNotice('Gym link ready to share.');
    } catch (_error) {
      setPageNotice('Could not share this link right now.');
    }
  }, [gym]);

  const handleToggleSave = useCallback(() => {
    if (!gymId) {
      return;
    }

    const current = new Set(readSavedGyms());
    const key = String(gymId);

    if (current.has(key)) {
      current.delete(key);
      setIsSaved(false);
      setPageNotice('Removed from your saved gyms.');
    } else {
      current.add(key);
      setIsSaved(true);
      setPageNotice('Saved for later.');
    }

    writeSavedGyms([...current]);
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
        setReviewStatus({ error: null, success: 'Thanks for sharing your experience.' });
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

  const currencyPrefix = gym.pricing?.currency === 'INR' || !gym.pricing?.currency ? 'Rs ' : `${gym.pricing.currency} `;
  const headlinePrice = parseAmount(gym.pricing?.startingAt ?? gym.pricing?.discounted ?? gym.pricing?.mrp);
  const headlineMrp = parseAmount(
    gym.pricing?.startingAt !== undefined && gym.pricing?.startingAt !== null
      ? gym.pricing?.startingAtMrp
      : gym.pricing?.mrp,
  );
  const headlinePlanLabel = gym.pricing?.startingPlanLabel ?? gym.pricing?.defaultPlanLabel ?? null;

  const heroImage = activeMedia || mediaGallery[0] || null;
  const heroInitial = (gym.name ?? 'G').trim().charAt(0).toUpperCase();
  const ratingValue = gym.analytics?.ratingCount
    ? `${(Number(gym.analytics?.rating ?? 0)).toFixed(1)} / 5`
    : 'No ratings yet';
  const ratingMeta = gym.analytics?.ratingCount
    ? `${gym.analytics.ratingCount} member reviews`
    : 'Be the first to review this gym.';
  const openingHours = `${gym.schedule?.open || 'Schedule pending'}${gym.schedule?.close ? ` - ${gym.schedule.close}` : ''}`;
  const bestFitLabel = recommendedPlan?.label ?? 'Membership enquiry';
  const bestFitMeta = recommendedPlan
    ? `${recommendedPlan.durationMonths ? `${recommendedPlan.durationMonths} month plan` : 'Flexible plan'} at ${currencyPrefix}${Number(recommendedPlan.price ?? recommendedPlan.mrp ?? 0).toLocaleString('en-IN')}`
    : 'Ask the gym to confirm the best plan for your goals.';

  return (
    <div className="gym-details">
      <div className="gym-details__hero-banner">
        {heroImage ? (
          <img src={heroImage} alt={`${gym.name} preview`} />
        ) : (
          <div className="gym-details__hero-placeholder" aria-hidden>
            <span>{heroInitial}</span>
          </div>
        )}
        <span className="gym-details__hero-eyebrow">Gym listing</span>
      </div>

      {mediaGallery.length > 1 ? (
        <div className="gym-details__media-grid">
          {mediaGallery.slice(0, 5).map((image, index) => (
            <button
              key={`${image}-${index}`}
              type="button"
              className={`gym-details__media-thumb${image === activeMedia ? ' is-active' : ''}`}
              onClick={() => setSelectedMediaIndex(index)}
            >
              <img src={image} alt={`${gym.name} gallery ${index + 1}`} />
            </button>
          ))}
        </div>
      ) : null}

      <header className="gym-details__header">
        <div className="gym-details__headline">
          <h1>{gym.name}</h1>
          <p>{locationLabel || 'Location details pending'}</p>
        </div>
        <div className="gym-details__pricing">
          <span className="price">
            {headlinePrice !== null ? `${currencyPrefix}${headlinePrice.toLocaleString('en-IN')}` : 'Pricing unavailable'}
          </span>
          {headlineMrp !== null && headlinePrice !== null && headlineMrp > headlinePrice ? (
            <span className="price--mrp">{currencyPrefix}{headlineMrp.toLocaleString('en-IN')}</span>
          ) : null}
          {headlinePlanLabel ? (
            <small>Starting with {headlinePlanLabel}</small>
          ) : null}
        </div>
        <div className="gym-details__header-actions">
          <button type="button" onClick={handleShareGym}>Share</button>
          <button type="button" onClick={handleToggleSave}>{isSaved ? 'Saved' : 'Save'}</button>
          <Link to={`/support/new?gymId=${gym.id}&subject=${encodeURIComponent(`Question about ${gym.name}`)}`}>
            Contact
          </Link>
          <a className="gym-details__header-actions-primary" href="#gym-membership-options">Join membership</a>
          <Link className="gym-details__header-actions-primary" to="/dashboard/trainee/sessions">Book session</Link>
        </div>
      </header>
      {pageNotice ? <p className="gym-details__notice">{pageNotice}</p> : null}

      <section className="gym-details__quick-stats">
        <div>
          <span className="gym-details__quick-icon"><Icon name="star" /></span>
          <div>
            <strong>Rating</strong>
            <p>{ratingValue}</p>
            <small>{ratingMeta}</small>
          </div>
        </div>
        <div>
          <span className="gym-details__quick-icon"><Icon name="clock" /></span>
          <div>
            <strong>Opening hours</strong>
            <p>{openingHours}</p>
            <small>{formatWorkingDays(gym.schedule?.workingDays)}</small>
          </div>
        </div>
        <div>
          <span className="gym-details__quick-icon"><Icon name="badge" /></span>
          <div>
            <strong>Best fit</strong>
            <p>{bestFitLabel}</p>
            <small>{bestFitMeta}</small>
          </div>
        </div>
      </section>

      <div className="gym-details__quick-actions">
        {mapLink ? <a href={mapLink} target="_blank" rel="noreferrer">Open in Maps</a> : null}
        {gym.contact?.phone ? <a href={`tel:${gym.contact.phone}`}>Call gym</a> : null}
        {gym.contact?.email ? (
          <a href={`mailto:${gym.contact.email}?subject=${encodeURIComponent(`Enquiry about ${gym.name}`)}`}>Email gym</a>
        ) : null}
        <Link to={`/support/new?gymId=${gym.id}&subject=${encodeURIComponent(`Question about ${gym.name}`)}`}>Contact support</Link>
        {websiteUrl ? <a href={websiteUrl} target="_blank" rel="noreferrer">Visit website</a> : null}
      </div>

      <section className="gym-details__membership-section" id="gym-membership-options">
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
          pricingPlans={gym.pricing?.plans ?? []}
          currency={currencyPrefix}
        />
      </section>

      <section className="gym-details__section">
        <div className="gym-details__section-header">
          <h2>Membership plans</h2>
          <p>Compare durations, discounts, and the best entry point before you join.</p>
        </div>
        {pricingPlans.length ? (
          <div className="gym-details__plan-grid">
            {pricingPlans.map((plan) => {
              const planPrice = Number(plan.price ?? plan.mrp ?? 0);
              const planMrp = Number(plan.mrp ?? plan.price ?? 0);
              const hasDiscount = Number.isFinite(planMrp) && planMrp > planPrice;

              return (
                <article key={plan.code ?? plan.label} className="gym-details__plan-card">
                  <small>{plan.durationMonths ? `${plan.durationMonths} month${plan.durationMonths > 1 ? 's' : ''}` : 'Flexible duration'}</small>
                  <strong>{plan.label}</strong>
                  <p className="gym-details__plan-price">
                    {currencyPrefix}{planPrice.toLocaleString('en-IN')}
                  </p>
                  {hasDiscount ? (
                    <p className="gym-details__plan-note">
                      MRP {currencyPrefix}{planMrp.toLocaleString('en-IN')} | Save {Math.round(((planMrp - planPrice) / planMrp) * 100)}%
                    </p>
                  ) : (
                    <p className="gym-details__plan-note">Current listed plan price.</p>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <div className="gym-details__empty-card">
            <p>This gym has not published membership plans yet.</p>
          </div>
        )}
      </section>

      <section className="gym-details__grid">
        <article>
          <h2><span className="gym-details__section-icon"><Icon name="pin" /></span>Location</h2>
          <p>{gym.location?.address || 'Address pending'}</p>
          <p>{[gym.location?.city, gym.location?.state].filter(Boolean).join(', ') || 'City pending'}</p>
          {gym.location?.coordinates?.lat && gym.location?.coordinates?.lng ? (
            <p>
              {Number(gym.location.coordinates.lat).toFixed(5)}, {Number(gym.location.coordinates.lng).toFixed(5)}
            </p>
          ) : null}
          {mapLink ? (
            <a href={mapLink} target="_blank" rel="noreferrer">Get directions</a>
          ) : null}
        </article>
        <article>
          <h2><span className="gym-details__section-icon"><Icon name="phone" /></span>Contact</h2>
          <p>{gym.contact?.phone || 'Phone not published'}</p>
          <p>{gym.contact?.email || 'Email not published'}</p>
          <p>{websiteUrl || 'Website not published'}</p>
        </article>
        <article>
          <h2><span className="gym-details__section-icon"><Icon name="dumbbell" /></span>Facilities and focus</h2>
          {featurePills.length ? (
            <div className="gym-details__chips">
              {featurePills.map((feature) => (
                <span key={feature}>{feature}</span>
              ))}
            </div>
          ) : (
            <p>No amenities or focus areas have been published yet.</p>
          )}
        </article>
        <article>
          <h2><span className="gym-details__section-icon"><Icon name="calendar" /></span>Weekly hours</h2>
          <div className="gym-details__hours-list">
            {weeklyHours.map((entry) => (
              <div key={entry.key} className="gym-details__hours-row">
                <span>{entry.label}</span>
                <strong>{entry.hours}</strong>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="gym-details__about">
        <h2>About this gym</h2>
        <p>{gym.description || 'This gym has not added a description yet.'}</p>
      </section>

      <section className="gym-details__section">
        <div className="gym-details__section-header">
          <h2>Trainer preview</h2>
          <p>Meet the active trainers currently assigned to this gym.</p>
        </div>
        {trainers.length ? (
          <div className="gym-details__trainer-grid">
            {trainers.slice(0, 6).map((trainer) => (
              <article key={trainer.id} className="gym-details__trainer-card">
                <div className="gym-details__trainer-avatar">
                  {trainer.profilePicture ? (
                    <img src={trainer.profilePicture} alt={trainer.name} />
                  ) : (
                    <span>{trainer.name?.slice(0, 1) ?? 'T'}</span>
                  )}
                </div>
                <div>
                  <h3>{trainer.name}</h3>
                  <p>{trainer.headline || 'Active trainer at this gym'}</p>
                </div>
                <div className="gym-details__trainer-meta">
                  {getTrainerMeta(trainer).length ? (
                    getTrainerMeta(trainer).map((entry) => <span key={entry}>{entry}</span>)
                  ) : (
                    <span>Profile details will appear once the trainer completes them.</span>
                  )}
                </div>
                <p className="gym-details__trainer-bio">
                  {trainer.bio || 'Trainer biography will appear once published.'}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <div className="gym-details__empty-card">
            <p>No active trainers are assigned to this gym yet.</p>
          </div>
        )}
      </section>

      <section className="gym-details__section">
        <div className="gym-details__section-header">
          <h2>Session preview</h2>
          <p>Preview upcoming trainer availability when you have an active membership.</p>
        </div>
        {userRole === 'trainee' ? (
          sessionPreview.length ? (
            <div className="gym-details__session-grid">
              {sessionPreview.map((slot) => (
                <article key={`${slot.date}-${slot.availabilitySlotKey}`} className="gym-details__session-card">
                  <strong>{formatDate(slot.date)}</strong>
                  <p>{slot.startTime} - {slot.endTime}</p>
                  <small>{formatStatus(slot.sessionType)}</small>
                  <small>{slot.locationLabel || 'Gym floor'}</small>
                  <span>{slot.remainingCapacity}/{slot.capacity} seats left</span>
                </article>
              ))}
            </div>
          ) : (
            <div className="gym-details__empty-card">
              <p>Join this gym and select a trainer to unlock the live booking calendar.</p>
            </div>
          )
        ) : (
          <div className="gym-details__empty-card">
            <p>Session slots are shown to signed-in trainees with an active membership.</p>
          </div>
        )}
        <div className="gym-details__cta-row">
          <Link to="/dashboard/trainee/sessions">Open booking dashboard</Link>
          <a href="#gym-membership-options">Join membership first</a>
          <Link to={`/support/new?gymId=${gym.id}&subject=${encodeURIComponent(`Trainer enquiry for ${gym.name}`)}`}>
            Ask about sessions
          </Link>
        </div>
      </section>

      <section className="gym-details__reviews">
        <div className="gym-details__reviews-header">
          <h2>Member reviews</h2>
          {gym.analytics?.ratingCount ? (
            <span>
              {(Number(gym.analytics?.rating ?? 0)).toFixed(1)} / 5 from {gym.analytics.ratingCount} ratings
            </span>
          ) : (
            <span>Be the first to review this gym</span>
          )}
        </div>

        <div className="gym-details__reviews-list">
          {isReviewsFetching && !reviews.length ? <p>Loading reviews...</p> : null}
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
                    <span>{starCount ? `${starCount} / 5` : '-'}</span>
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
