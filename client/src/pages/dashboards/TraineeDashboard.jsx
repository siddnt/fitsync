import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import DashboardSection from './components/DashboardSection.jsx';
import EmptyState from './components/EmptyState.jsx';
import SkeletonPanel from '../../ui/SkeletonPanel.jsx';
import StreakGraph from '../../components/dashboard/StreakGraph.jsx';
import {
  useGetTraineeOverviewQuery,
  useGetTraineeProgressQuery,
} from '../../services/dashboardApi.js';
import NotificationsPanel from './components/NotificationsPanel.jsx';
import { useGetMyNotificationsQuery, useGetMyRecommendationsQuery } from '../../services/userApi.js';
import { useGetMyBookingsQuery } from '../../services/bookingApi.js';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
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
const EMPTY_LIST = [];
const STREAK_MILESTONES = [3, 5, 7, 10, 14, 21, 30];
const SESSION_MILESTONES = [4, 8, 12, 16, 20];

const getBookingStartDateTime = (booking) => {
  const [hours, minutes] = String(booking?.startTime || '00:00').split(':').map(Number);
  const date = new Date(booking?.bookingDate);
  date.setHours(Number.isFinite(hours) ? hours : 0, Number.isFinite(minutes) ? minutes : 0, 0, 0);
  return date;
};

const getNextMilestone = (currentValue, milestones) => {
  const normalized = Math.max(0, Number(currentValue) || 0);
  const nextTarget = milestones.find((entry) => entry > normalized);

  if (nextTarget) {
    return nextTarget;
  }

  const fallbackStep = milestones[milestones.length - 1] || 7;
  return Math.ceil((normalized + 1) / fallbackStep) * fallbackStep;
};

const getWeightTrend = (bodyMetrics = []) => {
  if (!Array.isArray(bodyMetrics) || bodyMetrics.length < 2) {
    return null;
  }

  const sorted = [...bodyMetrics]
    .filter((entry) => entry?.recordedAt)
    .sort((left, right) => new Date(left.recordedAt) - new Date(right.recordedAt));

  if (sorted.length < 2) {
    return null;
  }

  const latest = sorted[sorted.length - 1];
  const previous = sorted[sorted.length - 2];

  if (latest?.weightKg === undefined || previous?.weightKg === undefined) {
    return null;
  }

  return {
    latest: Number(latest.weightKg),
    change: Number((Number(latest.weightKg) - Number(previous.weightKg)).toFixed(1)),
    recordedAt: latest.recordedAt,
  };
};

const buildPerformanceMilestone = (metrics = []) => {
  const primaryMetric = Array.isArray(metrics) ? metrics[0] : null;
  const latestValue = Number(primaryMetric?.latestValue);

  if (!primaryMetric?.metric || !Number.isFinite(latestValue)) {
    return null;
  }

  const step = latestValue >= 100 ? 10 : latestValue >= 30 ? 5 : 1;
  let target = Math.ceil(latestValue / step) * step;
  if (target <= latestValue) {
    target += step;
  }

  return {
    label: `${formatStatus(primaryMetric.metric)} target`,
    title: `${target}${primaryMetric.unit ? ` ${primaryMetric.unit}` : ''}`,
    description: `Current best ${latestValue}${primaryMetric.unit ? ` ${primaryMetric.unit}` : ''}. ${target - latestValue}${primaryMetric.unit ? ` ${primaryMetric.unit}` : ''} to the next checkpoint.`,
    progress: Math.max(20, Math.min(100, (latestValue / target) * 100)),
    footer: primaryMetric.recordedAt ? `Updated ${formatDate(primaryMetric.recordedAt)}` : 'Next coach update pending',
  };
};

const TraineeDashboard = () => {
  const {
    data: overviewData,
    isLoading: isOverviewLoading,
    isError: isOverviewError,
    refetch: refetchOverview,
  } = useGetTraineeOverviewQuery();

  const {
    data: progressData,
    isLoading: isProgressLoading,
    isError: isProgressError,
    refetch: refetchProgress,
  } = useGetTraineeProgressQuery();

  const { data: notificationsResponse } = useGetMyNotificationsQuery({ limit: 6 });
  const { data: recommendationsResponse } = useGetMyRecommendationsQuery();
  const { data: bookingsResponse } = useGetMyBookingsQuery({ limit: 25 });

  const overview = overviewData?.data;
  const progress = progressData?.data;
  const membership = overview?.membership ?? null;
  const latestDiet = overview?.diet ?? null;
  const latestFeedback = overview?.progress?.feedback?.[0] ?? null;
  const recentOrders = Array.isArray(overview?.recentOrders) ? overview.recentOrders : EMPTY_LIST;
  const notifications = notificationsResponse?.data?.notifications ?? [];
  const recommendations = recommendationsResponse?.data ?? {};
  const bookings = Array.isArray(bookingsResponse?.data?.bookings) ? bookingsResponse.data.bookings : EMPTY_LIST;
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

  const nextSession = useMemo(
    () => bookings
      .filter((booking) => ['pending', 'confirmed'].includes(booking?.status))
      .sort((left, right) => getBookingStartDateTime(left).getTime() - getBookingStartDateTime(right).getTime())[0] ?? null,
    [bookings],
  );

  const highlightedOrder = useMemo(
    () => recentOrders.find((order) => ['processing', 'in-transit', 'out-for-delivery'].includes(order?.status))
      ?? recentOrders[0]
      ?? null,
    [recentOrders],
  );

  const weightTrend = useMemo(
    () => getWeightTrend(progress?.bodyMetrics ?? []),
    [progress?.bodyMetrics],
  );

  const performanceMilestone = useMemo(
    () => buildPerformanceMilestone(progress?.metrics ?? []),
    [progress?.metrics],
  );

  const membershipBillingLabel = useMemo(() => {
    if (!membership?.billing) {
      return '--';
    }

    if (typeof membership.billing === 'string') {
      return membership.billing;
    }

    return formatCurrency(membership.billing);
  }, [membership?.billing]);

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

  const presentSessions = totalsCounts.present;
  const streakTarget = getNextMilestone(currentStreak, STREAK_MILESTONES);
  const sessionTarget = getNextMilestone(presentSessions, SESSION_MILESTONES);
  const milestones = [
    {
      label: 'Attendance streak',
      title: `${currentStreak} / ${streakTarget} days`,
      description: currentStreak >= streakTarget
        ? 'You have already cleared the next streak checkpoint.'
        : `${streakTarget - currentStreak} more check-in${streakTarget - currentStreak === 1 ? '' : 's'} to hit the next streak badge.`,
      progress: streakTarget ? Math.max(10, Math.min(100, (currentStreak / streakTarget) * 100)) : 0,
      footer: `Longest run so far: ${maxStreak} day${maxStreak === 1 ? '' : 's'}`,
    },
    {
      label: 'Session consistency',
      title: `${presentSessions} / ${sessionTarget} presents`,
      description: sessionTarget > presentSessions
        ? `${sessionTarget - presentSessions} more attended sessions to reach the next consistency checkpoint.`
        : 'You are on track. Keep this month clean to stack another consistency badge.',
      progress: sessionTarget ? Math.max(10, Math.min(100, (presentSessions / sessionTarget) * 100)) : 0,
      footer: attendanceWindowLabel ? `Based on ${attendanceWindowLabel}` : totalsContext,
    },
    performanceMilestone,
  ].filter(Boolean);

  const todayActions = useMemo(() => {
    const actions = [];

    if (nextSession) {
      actions.push({
        label: 'Next session',
        title: `Prepare for ${formatStatus(nextSession.sessionType)}`,
        description: `${formatDateTime(getBookingStartDateTime(nextSession))} with ${nextSession.trainer?.name ?? membership?.trainer?.name ?? 'your trainer'}.`,
        detail: nextSession.notes || `Location: ${nextSession.locationLabel || nextSession.gym?.name || membership?.gym?.name || 'Gym floor'}`,
        cta: nextSession.status === 'pending' ? 'Review booking' : 'View session details',
        href: '/dashboard/trainee/sessions',
      });
    } else if (membership) {
      actions.push({
        label: 'Training plan',
        title: 'Book your next session',
        description: `Your ${formatStatus(membership.plan)} membership is active at ${membership.gym?.name ?? 'your gym'}.`,
        detail: membership.trainer?.name
          ? `Trainer assigned: ${membership.trainer.name}`
          : 'Trainer assignment is still being finalized.',
        cta: 'Browse trainer slots',
        href: '/dashboard/trainee/sessions',
      });
    }

    if (latestDiet) {
      actions.push({
        label: 'Nutrition',
        title: `Stay on the ${formatDate(latestDiet.weekOf)} meal plan`,
        description: `${latestDiet.meals?.length ?? 0} meals mapped for this cycle.`,
        detail: latestDiet.notes || 'Review the updated macros before your next training day.',
        cta: 'Open meal plan',
        href: '/dashboard/trainee/diet',
      });
    }

    if (highlightedOrder) {
      actions.push({
        label: 'Marketplace',
        title: `Track order ${highlightedOrder.orderNumber}`,
        description: `${highlightedOrder.itemsCount} item${highlightedOrder.itemsCount === 1 ? '' : 's'} currently ${formatStatus(highlightedOrder.status)}.`,
        detail: `Placed ${formatDate(highlightedOrder.createdAt)}`,
        cta: 'Open order history',
        href: '/dashboard/trainee/orders',
      });
    }

    if (latestFeedback) {
      actions.push({
        label: 'Coach note',
        title: 'Review your latest trainer feedback',
        description: latestFeedback.message,
        detail: latestFeedback.createdAt ? `Logged ${formatDate(latestFeedback.createdAt)}` : 'Fresh note from your trainer.',
        cta: 'See progress history',
        href: '/dashboard/trainee/progress',
      });
    }

    if (!actions.length) {
      actions.push({
        label: 'Getting started',
        title: 'Join a gym and set your weekly routine',
        description: 'Membership, bookings, meal plans, and product orders will surface here once your trainee profile is active.',
        detail: 'Start with gym discovery, then return here for a daily plan.',
        cta: 'Explore gyms',
        href: '/gyms',
      });
    }

    return actions.slice(0, 3);
  }, [highlightedOrder, latestDiet, latestFeedback, membership, nextSession]);

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
        <div className="dashboard-row row-split">
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
                <strong>{membershipBillingLabel}</strong>
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

      <div className="dashboard-row row-split">
        <DashboardSection
          title="What should I do today?"
          action={<Link to="/dashboard/trainee/sessions" className="pill dashboard-pill-link">Session planner</Link>}
        >
          <div className="stat-grid trainee-action-grid">
            {todayActions.map((action) => (
              <div key={`${action.label}-${action.title}`} className="stat-card">
                <small>{action.label}</small>
                <strong>{action.title}</strong>
                <p className="dashboard-card-note">{action.description}</p>
                <small>{action.detail}</small>
                <div className="dashboard-card-link-row">
                  <Link to={action.href} className="pill dashboard-pill-link">
                    {action.cta}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </DashboardSection>

        <DashboardSection title="Next milestones">
          <div className="stat-grid trainee-milestone-grid">
            {milestones.map((milestone) => (
              <div key={milestone.label} className="stat-card trainee-milestone-card">
                <small>{milestone.label}</small>
                <strong>{milestone.title}</strong>
                <p className="dashboard-card-note">{milestone.description}</p>
                <div className="dashboard-progress-bar" aria-hidden="true">
                  <span style={{ width: `${milestone.progress}%` }} />
                </div>
                <small>{milestone.footer}</small>
              </div>
            ))}
            {weightTrend ? (
              <div className="stat-card trainee-milestone-card">
                <small>Body trend</small>
                <strong>{weightTrend.latest} kg</strong>
                <p className="dashboard-card-note">
                  {weightTrend.change === 0
                    ? 'Weight is holding steady between your latest two check-ins.'
                    : `${weightTrend.change > 0 ? '+' : ''}${weightTrend.change} kg since the last logged measurement.`}
                </p>
                <div className="dashboard-progress-bar" aria-hidden="true">
                  <span style={{ width: `${Math.min(100, Math.max(20, 55 + (weightTrend.change * -10)))}%` }} />
                </div>
                <small>Last measurement {formatDate(weightTrend.recordedAt)}</small>
              </div>
            ) : null}
          </div>
        </DashboardSection>
      </div>

      <div className="dashboard-row row-streak">
        <StreakGraph
          data={attendanceRecords}
          enrollmentStart={enrollmentStart}
          attendanceMap={attendanceMap}
        />
      </div>

      <div className="dashboard-row row-overview">
        <DashboardSection title="Recommended gyms">
          {recommendations.gyms?.length ? (
            <div className="stat-grid">
              {recommendations.gyms.map((gym) => (
                <div key={gym.id} className="stat-card">
                  <small>{gym.city ?? 'Gym'}</small>
                  <strong>{gym.name}</strong>
                  <small>Rating {gym.rating ?? 0} | Members {gym.membershipCount ?? 0}</small>
                  <small>{gym.monthlyPrice ? formatCurrency(gym.monthlyPrice) : 'Pricing on request'}</small>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState message="Recommendations will appear after we learn more from your memberships and orders." />
          )}
        </DashboardSection>

        <DashboardSection title="Notifications">
          <NotificationsPanel
            notifications={notifications}
            emptyMessage="Membership reminders and order updates will appear here."
          />
        </DashboardSection>
      </div>
    </div>
  );
};

export default TraineeDashboard;
