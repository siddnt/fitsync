import { useMemo } from 'react';
import DashboardSection from './components/DashboardSection.jsx';
import EmptyState from './components/EmptyState.jsx';
import SkeletonPanel from '../../ui/SkeletonPanel.jsx';
import StreakGraph from '../../components/dashboard/StreakGraph.jsx';
import {
  useGetTraineeOverviewQuery,
  useGetTraineeProgressQuery,
} from '../../services/dashboardApi.js';
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
    </div>
  );
};

export default TraineeDashboard;
