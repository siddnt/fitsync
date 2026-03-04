import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import DashboardSection from './components/DashboardSection.jsx';
import EmptyState from './components/EmptyState.jsx';
import SkeletonPanel from '../../ui/SkeletonPanel.jsx';
import StreakGraph from '../../components/dashboard/StreakGraph.jsx';
import {
  useGetTraineeOverviewQuery,
  useGetTraineeProgressQuery,
} from '../../services/dashboardApi.js';
import {
  useSubmitGymReviewMutation,
  useGetGymReviewsQuery,
  useUploadGymPhotoMutation,
  useGetGymGalleryQuery,
} from '../../services/gymsApi.js';
import {
  formatCurrency,
  formatDate,
  formatDaysRemaining,
  formatStatus,
} from '../../utils/format.js';
import {
  buildAttendanceMap,
  getAttendanceStats,
  getAttendanceTotals,
  getMaxStreak,
} from '../../utils/attendance.js';
import './Dashboard.css';

const EMPTY_ATTENDANCE = [];

const TraineeDashboard = () => {
  const {
    data: overviewData,
    isLoading: isOverviewLoading,
    isError: isOverviewError,
    refetch: refetchOverview
  } = useGetTraineeOverviewQuery();

  const {
    data: progressData,
    isLoading: isProgressLoading,
    isError: isProgressError,
    refetch: refetchProgress
  } = useGetTraineeProgressQuery();

  const overview = overviewData?.data;
  const progress = progressData?.data;

  const membership = overview?.membership ?? null;
  const gymId = membership?.gym?.id ?? null;
  const gymName = membership?.gym?.name ?? null;
  const canInteractWithGym = Boolean(gymId) && ['active', 'paused'].includes(membership?.status);

  /* ── Review state ── */
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewStatus, setReviewStatus] = useState({ error: null, success: null });
  const [submitGymReview, { isLoading: isSubmittingReview }] = useSubmitGymReviewMutation();

  const {
    data: reviewsResponse,
    refetch: refetchReviews,
  } = useGetGymReviewsQuery(gymId, { skip: !gymId });

  const reviews = useMemo(() => {
    const list = reviewsResponse?.data?.reviews;
    return Array.isArray(list) ? list : [];
  }, [reviewsResponse?.data?.reviews]);

  const userId = overview?.membership?.trainee?.id ?? null;

  const existingUserReview = useMemo(() => {
    if (!reviews.length) return null;
    return reviews.find((r) => r.authorId === userId) ?? null;
  }, [reviews, userId]);

  useEffect(() => {
    if (existingUserReview) {
      setReviewRating(existingUserReview.rating);
      setReviewComment(existingUserReview.comment);
    }
  }, [existingUserReview]);

  const handleReviewSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!gymId || !canInteractWithGym) return;
    const trimmed = reviewComment.trim();
    if (!trimmed) {
      setReviewStatus({ error: 'Please add a few words about your experience.', success: null });
      return;
    }
    setReviewStatus({ error: null, success: null });
    try {
      await submitGymReview({ gymId, rating: reviewRating, comment: trimmed }).unwrap();
      setReviewStatus({ error: null, success: 'Thanks for sharing your experience!' });
      if (refetchReviews) refetchReviews();
    } catch (err) {
      setReviewStatus({ error: err?.data?.message ?? 'Could not save your review.', success: null });
    }
  }, [gymId, canInteractWithGym, submitGymReview, reviewRating, reviewComment, refetchReviews]);

  /* ── Photo upload state ── */
  const fileInputRef = useRef(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoStatus, setPhotoStatus] = useState({ error: null, success: null });
  const [uploadGymPhoto, { isLoading: isUploading }] = useUploadGymPhotoMutation();

  const {
    data: galleryResponse,
    refetch: refetchGallery,
  } = useGetGymGalleryQuery(gymId, { skip: !gymId });

  const myPhotos = useMemo(() => {
    const members = galleryResponse?.data?.memberPhotos;
    return Array.isArray(members) ? members : [];
  }, [galleryResponse?.data?.memberPhotos]);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setPhotoStatus({ error: 'File must be under 5 MB.', success: null });
      return;
    }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setPhotoStatus({ error: null, success: null });
  };

  const handlePhotoUpload = useCallback(async () => {
    if (!gymId || !photoFile) return;
    setPhotoStatus({ error: null, success: null });
    const formData = new FormData();
    formData.append('photo', photoFile);
    try {
      await uploadGymPhoto({ gymId, formData }).unwrap();
      setPhotoStatus({ error: null, success: 'Photo uploaded!' });
      setPhotoFile(null);
      setPhotoPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (refetchGallery) refetchGallery();
    } catch (err) {
      setPhotoStatus({ error: err?.data?.message ?? 'Upload failed.', success: null });
    }
  }, [gymId, photoFile, uploadGymPhoto, refetchGallery]);
  const attendanceRecords = progress?.rawAttendance ?? progress?.attendance?.records ?? EMPTY_ATTENDANCE;
  const enrollmentStart = membership?.startDate ?? null;

  const attendanceMap = useMemo(
    () => buildAttendanceMap(attendanceRecords, enrollmentStart),
    [attendanceRecords, enrollmentStart],
  );

  const attendanceStats = useMemo(
    () => getAttendanceStats(attendanceMap, enrollmentStart, 30),
    [attendanceMap, enrollmentStart],
  );

  const attendanceTotals = useMemo(
    () => getAttendanceTotals(attendanceMap, enrollmentStart),
    [attendanceMap, enrollmentStart],
  );

  const maxStreak = useMemo(
    () => getMaxStreak(attendanceMap, enrollmentStart),
    [attendanceMap, enrollmentStart],
  );

  const totalsCounts = attendanceTotals.counts ?? { present: 0, late: 0, absent: 0 };
  const totalsSinceLabel = attendanceTotals.range?.start ? formatDate(attendanceTotals.range.start) : null;
  const totalsContext = totalsSinceLabel ? `Since ${totalsSinceLabel}` : 'Tracking begins after your trainer logs attendance.';
  const attendanceWindowLabel = attendanceStats.totalDays
    ? `last ${attendanceStats.totalDays} day${attendanceStats.totalDays === 1 ? '' : 's'}`
    : null;
  const windowCounts = attendanceStats.counts ?? { present: 0, late: 0, absent: 0 };
  const presentWindowLine = attendanceWindowLabel ? `${attendanceWindowLabel}: ${windowCounts.present} present` : null;
  const lateWindowLine = attendanceWindowLabel ? `${attendanceWindowLabel}: ${windowCounts.late} late` : null;
  const absentWindowLine = attendanceWindowLabel ? `${attendanceWindowLabel}: ${windowCounts.absent} absent` : null;
  const currentStreak = overview?.progress?.streak ?? 0;
  const lastCheckInLabel = overview?.progress?.lastCheckIn ? formatDate(overview.progress.lastCheckIn) : 'No check-ins yet';
  const hasProgressSummary = Boolean(overview?.progress) || attendanceTotals.totalDays > 0;

  const isLoading = isOverviewLoading || isProgressLoading;
  const isError = isOverviewError || isProgressError;

  const handleRetry = () => {
    refetchOverview();
    refetchProgress();
  };

  if (isLoading) {
    return (
      <div className="trainee-dashboard-layout">
        <div className="dashboard-row row-overview">
          <SkeletonPanel lines={6} />
          <SkeletonPanel lines={6} />
        </div>
        <div className="dashboard-row row-streak">
          <SkeletonPanel lines={8} />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="dashboard-grid">
        <DashboardSection
          title="Dashboard unavailable"
          action={(
            <button type="button" onClick={handleRetry}>
              Retry
            </button>
          )}
        >
          <EmptyState message="We could not load your dashboard right now. Please try again." />
        </DashboardSection>
      </div>
    );
  }

  return (
    <div className="trainee-dashboard-layout">
      {/* Row 1: Key Metrics */}
      <div className="dashboard-row row-overview">
        <DashboardSection
          title="Active membership"
          action={
            membership ? (
              <span className="pill">{formatStatus(membership.status)}</span>
            ) : undefined
          }
        >
          {membership ? (
            <div className="stat-grid">
              <div className="stat-card">
                <small>Plan</small>
                <strong>{formatStatus(membership.plan)}</strong>
                <small>Auto renew: {membership.autoRenew ? 'On' : 'Off'}</small>
              </div>
              <div className="stat-card">
                <small>Ends on</small>
                <strong>{formatDate(membership.endDate)}</strong>
                <small>{formatDaysRemaining(membership.daysRemaining)} remaining</small>
              </div>
              <div className="stat-card">
                <small>Billing</small>
                <strong>{membership.billing ? formatCurrency(membership.billing) : '—'}</strong>
                <small>Started {formatDate(membership.startDate)}</small>
              </div>
              <div className="stat-card">
                <small>Training at</small>
                <strong>{membership.gym?.name ?? 'Not enrolled yet'}</strong>
                <small>{membership.gym?.city ? membership.gym.city : 'Gym assignment pending'}</small>
              </div>
              <div className="stat-card">
                <small>Trainer</small>
                <strong>{membership.trainer?.name ?? 'Trainer not assigned'}</strong>
                <small>
                  {membership.trainer?.name
                    ? `Assigned under ${membership.gym?.name ?? 'active gym'}`
                    : 'You will be matched soon'}
                </small>
              </div>
            </div>
          ) : (
            <EmptyState message="You do not have an active membership yet." />
          )}
        </DashboardSection>

        <DashboardSection title="Progress overview">
          {hasProgressSummary ? (
            <div className="stat-grid">
              <div className="stat-card">
                <small>Max streak</small>
                <strong>{maxStreak} days</strong>
                <small>Current streak {currentStreak} days</small>
                <small>Last check-in {lastCheckInLabel}</small>
              </div>
              <div className="stat-card">
                <small>Total present</small>
                <strong>{totalsCounts.present}</strong>
                <small>{totalsContext}</small>
                {presentWindowLine ? <small>{presentWindowLine}</small> : null}
              </div>
              <div className="stat-card">
                <small>Total late</small>
                <strong>{totalsCounts.late}</strong>
                <small>{totalsContext}</small>
                {lateWindowLine ? <small>{lateWindowLine}</small> : null}
              </div>
              <div className="stat-card">
                <small>Total absent</small>
                <strong>{totalsCounts.absent}</strong>
                <small>{totalsContext}</small>
                {absentWindowLine ? <small>{absentWindowLine}</small> : null}
              </div>
            </div>
          ) : (
            <EmptyState message="Your trainer has not submitted progress updates yet." />
          )}
        </DashboardSection>
      </div>

      {/* Row 2: Attendance Streak Graph */}
      <div className="dashboard-row row-streak">
        <StreakGraph
          data={attendanceRecords}
          enrollmentStart={enrollmentStart}
          attendanceMap={attendanceMap}
        />
      </div>

      {/* Row 3: My Gym — Photo Upload & Review */}
      {canInteractWithGym ? (
        <div className="dashboard-row row-overview">
          <DashboardSection title={`Upload a photo — ${gymName}`}>
            <div className="trainee-gym-upload">
              <p className="trainee-gym-upload__hint">
                Share a photo of your gym with the community. Accepted formats: JPEG, PNG, GIF (max 5 MB).
              </p>
              <div className="trainee-gym-upload__controls">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif"
                  onChange={handleFileChange}
                  className="trainee-gym-upload__input"
                />
                {photoPreview && (
                  <img src={photoPreview} alt="Preview" className="trainee-gym-upload__preview" />
                )}
                <button
                  type="button"
                  className="cta-button"
                  onClick={handlePhotoUpload}
                  disabled={!photoFile || isUploading}
                >
                  {isUploading ? 'Uploading…' : 'Upload photo'}
                </button>
              </div>
              {photoStatus.error && <p className="gym-review-form__error">{photoStatus.error}</p>}
              {photoStatus.success && <p className="gym-review-form__success">{photoStatus.success}</p>}
              {myPhotos.length > 0 && (
                <div className="trainee-gym-upload__gallery">
                  <small className="text-muted">Your uploaded photos</small>
                  <div className="trainee-gym-upload__grid">
                    {myPhotos.slice(0, 6).map((p) => (
                      <img key={p.id} src={p.imageUrl} alt={p.title} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </DashboardSection>

          <DashboardSection title={`Review — ${gymName}`}>
            <form className="gym-review-form" onSubmit={handleReviewSubmit}>
              <label htmlFor="trainee-review-rating">Your rating</label>
              <select
                id="trainee-review-rating"
                value={reviewRating}
                onChange={(e) => setReviewRating(Number(e.target.value))}
              >
                {[5, 4, 3, 2, 1].map((v) => (
                  <option key={v} value={v}>{`${v} star${v > 1 ? 's' : ''}`}</option>
                ))}
              </select>

              <label htmlFor="trainee-review-comment">Your feedback</label>
              <textarea
                id="trainee-review-comment"
                rows={4}
                maxLength={500}
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="What stood out about this gym?"
                required
              />

              {reviewStatus.error && <p className="gym-review-form__error">{reviewStatus.error}</p>}
              {reviewStatus.success && <p className="gym-review-form__success">{reviewStatus.success}</p>}

              <button type="submit" disabled={isSubmittingReview}>
                {existingUserReview ? 'Update review' : 'Submit review'}
              </button>
            </form>
          </DashboardSection>
        </div>
      ) : null}
    </div>
  );
};

export default TraineeDashboard;
