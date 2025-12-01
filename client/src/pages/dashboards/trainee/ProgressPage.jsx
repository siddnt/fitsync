import { useMemo } from 'react';
import DashboardSection from '../components/DashboardSection.jsx';
import EmptyState from '../components/EmptyState.jsx';
import SkeletonPanel from '../../../ui/SkeletonPanel.jsx';
import { useGetTraineeOverviewQuery, useGetTraineeProgressQuery } from '../../../services/dashboardApi.js';
import {
  formatDate,
  formatPercentage,
  formatStatus,
} from '../../../utils/format.js';
import {
  buildAttendanceMap,
  getAttendanceStats,
  getAttendanceTotals,
  getMaxStreak,
} from '../../../utils/attendance.js';
import '../Dashboard.css';

const EMPTY_ATTENDANCE = [];

const TraineeProgressPage = () => {
  const { data, isLoading, isError, refetch } = useGetTraineeProgressQuery();
  const { data: overviewData } = useGetTraineeOverviewQuery();
  const progress = data?.data;
  const membershipStart = overviewData?.data?.membership?.startDate ?? null;
  const attendanceRecords = progress?.rawAttendance ?? EMPTY_ATTENDANCE;
  const attendanceMap = useMemo(
    () => buildAttendanceMap(attendanceRecords, membershipStart),
    [attendanceRecords, membershipStart],
  );
  const attendanceStats = useMemo(
    () => getAttendanceStats(attendanceMap, membershipStart, 30),
    [attendanceMap, membershipStart],
  );
  const attendanceTotals = useMemo(
    () => getAttendanceTotals(attendanceMap, membershipStart),
    [attendanceMap, membershipStart],
  );
  const maxStreak = useMemo(
    () => getMaxStreak(attendanceMap, membershipStart),
    [attendanceMap, membershipStart],
  );
  const overviewProgress = overviewData?.data?.progress;
  const currentStreak = overviewProgress?.streak ?? progress?.attendance?.streak ?? 0;
  const lastCheckInLabel = overviewProgress?.lastCheckIn ? formatDate(overviewProgress.lastCheckIn) : 'No check-ins yet';
  const totalsCounts = attendanceTotals.counts ?? { present: 0, late: 0, absent: 0 };
  const totalsSinceLabel = attendanceTotals.range?.start ? formatDate(attendanceTotals.range.start) : null;
  const totalsContext = totalsSinceLabel ? `Since ${totalsSinceLabel}` : 'Tracking begins after your trainer logs attendance.';
  const attendanceWindowLabel = attendanceStats.totalDays
    ? `last ${attendanceStats.totalDays} day${attendanceStats.totalDays === 1 ? '' : 's'}`
    : null;
  const windowCounts = attendanceStats.counts ?? { present: 0, late: 0, absent: 0 };
  const hasAttendance = attendanceTotals.totalDays > 0 || Boolean(overviewProgress);

  if (isLoading) {
    return (
      <div className="dashboard-grid">
        {['Attendance insights', 'Performance metrics', 'Trainer feedback'].map((title) => (
          <DashboardSection key={title} title={title}>
            <SkeletonPanel lines={6} />
          </DashboardSection>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="dashboard-grid">
        <DashboardSection
          title="Unable to load progress"
          action={(
            <button type="button" onClick={() => refetch()}>
              Retry
            </button>
          )}
        >
          <EmptyState message="We ran into a problem fetching your progress data." />
        </DashboardSection>
      </div>
    );
  }

  return (
    <div className="dashboard-grid">
      <DashboardSection title="Attendance insights">
        {hasAttendance ? (
          <>
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
                {attendanceWindowLabel ? (
                  <small>{`${attendanceWindowLabel}: ${windowCounts.present} present`}</small>
                ) : null}
              </div>
              <div className="stat-card">
                <small>Total late</small>
                <strong>{totalsCounts.late}</strong>
                <small>{totalsContext}</small>
                {attendanceWindowLabel ? (
                  <small>{`${attendanceWindowLabel}: ${windowCounts.late} late`}</small>
                ) : null}
              </div>
              <div className="stat-card">
                <small>Total absent</small>
                <strong>{totalsCounts.absent}</strong>
                <small>{totalsContext}</small>
                {attendanceWindowLabel ? (
                  <small>{`${attendanceWindowLabel}: ${windowCounts.absent} absent`}</small>
                ) : null}
              </div>
            </div>
            {attendanceStats.totalDays ? (
              <div className="stat-grid">
                {['present', 'late', 'absent'].map((key) => (
                  <div className="stat-card" key={key}>
                    <small>{`${formatStatus(key)} (${attendanceWindowLabel})`}</small>
                    <strong>{formatPercentage(attendanceStats.percentages[key] ?? 0)}</strong>
                    <small>{`${windowCounts[key]} of ${attendanceStats.totalDays} days`}</small>
                  </div>
                ))}
              </div>
            ) : null}
          </>
        ) : (
          <EmptyState message="We do not have attendance data for you yet." />
        )}
      </DashboardSection>

      <DashboardSection title="Performance metrics">
        {progress?.metrics?.length ? (
          <div className="stat-grid">
            {progress.metrics.map((metric) => (
              <div key={metric.metric} className="stat-card">
                <small>{formatStatus(metric.metric)}</small>
                <strong>
                  {metric.latestValue}
                  {metric.unit ? ` ${metric.unit}` : ''}
                </strong>
                <small>Updated {formatDate(metric.recordedAt)}</small>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState message="Once your trainer logs measurements they will appear here." />
        )}
      </DashboardSection>

      <DashboardSection title="Trainer feedback">
        {progress?.feedback?.length ? (
          <ul>
            {progress.feedback.map((feedback, index) => (
              <li key={`${feedback.category}-${index}`}>
                <strong>{formatStatus(feedback.category)}:</strong> {feedback.message}{' '}
                <small>({formatDate(feedback.createdAt)})</small>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState message="Your trainer has not left fresh feedback yet." />
        )}
      </DashboardSection>


    </div>
  );
};

export default TraineeProgressPage;
