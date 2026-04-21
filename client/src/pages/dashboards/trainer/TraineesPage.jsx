import { useEffect, useMemo, useState } from 'react';
import DashboardSection from '../components/DashboardSection.jsx';
import EmptyState from '../components/EmptyState.jsx';
import SkeletonPanel from '../../../ui/SkeletonPanel.jsx';
import {
  useGetTrainerTraineesQuery,
} from '../../../services/dashboardApi.js';
import { formatDate, formatStatus } from '../../../utils/format.js';
import PaginationBar from '../../../ui/PaginationBar.jsx';
import '../Dashboard.css';

const TrainerTraineesPage = () => {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, refetch } = useGetTrainerTraineesQuery({ page });
  const rawAssignments = data?.data?.assignments;
  const pagedTrainees = data?.data?.trainees ?? [];
  const pagination = data?.data?.pagination ?? {};

  const assignments = useMemo(
    () => (Array.isArray(rawAssignments) ? rawAssignments : []),
    [rawAssignments],
  );

  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({ gym: 'all', status: 'all' });

  useEffect(() => { setPage(1); }, [searchTerm, filters.gym, filters.status]);

  const gymOptions = useMemo(() => {
    const uniqueGyms = new Map();
    pagedTrainees.forEach((trainee) => {
      const gymId = trainee.gym?._id ?? trainee.gym?.id;
      if (gymId && !uniqueGyms.has(gymId)) {
        uniqueGyms.set(gymId, trainee.gym?.name ?? 'Assigned gym');
      }
    });
    return Array.from(uniqueGyms, ([value, label]) => ({ value, label }));
  }, [pagedTrainees]);

  const statusOptions = useMemo(() => {
    const uniqueStatuses = new Set();
    pagedTrainees.forEach((trainee) => {
      if (trainee.status) uniqueStatuses.add(trainee.status);
    });
    return Array.from(uniqueStatuses);
  }, [pagedTrainees]);

  const filteredTrainees = useMemo(() => {
    const normalizedQuery = searchTerm.trim().toLowerCase();
    return pagedTrainees.filter((trainee) => {
      const gymId = trainee.gym?._id ?? trainee.gym?.id;
      const matchesGym = filters.gym === 'all' || gymId === filters.gym;
      const matchesStatus = filters.status === 'all' || trainee.status === filters.status;
      const matchesQuery =
        !normalizedQuery ||
        [trainee.name, trainee.email, trainee.gym?.name]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(normalizedQuery));
      return matchesGym && matchesStatus && matchesQuery;
    });
  }, [pagedTrainees, filters, searchTerm]);

  const totalPages = pagination.totalPages ?? 1;
  const totalItems = pagination.total ?? filteredTrainees.length;
  const startIndex = (page - 1) * (pagination.limit ?? 10) + 1;
  const endIndex = Math.min(page * (pagination.limit ?? 10), totalItems);

  if (isLoading) {
    return (
      <div className="dashboard-grid">
        <DashboardSection title="Active trainees">
          <SkeletonPanel lines={8} />
        </DashboardSection>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="dashboard-grid">
        <DashboardSection
          title="Trainer workspace"
          action={(
            <button type="button" onClick={() => refetch()}>
              Retry
            </button>
          )}
        >
          <EmptyState message="We could not load your trainee assignments." />
        </DashboardSection>
      </div>
    );
  }

  return (
    <div className="dashboard-grid">
      <DashboardSection
        action={(
          <button type="button" onClick={() => refetch()}>
            Refresh
          </button>
        )}
      >
        {trainees.length ? (
          <div className="trainer-trainee-panel">
            <div className="trainer-trainee-panel__filters">
              <label htmlFor="trainee-search">
                <span>Search</span>
                <input
                  id="trainee-search"
                  type="search"
                  placeholder="Name, email, or gym"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
              </label>
              <label htmlFor="trainee-gym">
                <span>Gym</span>
                <select
                  id="trainee-gym"
                  value={filters.gym}
                  onChange={(event) => setFilters((prev) => ({ ...prev, gym: event.target.value }))}
                >
                  <option value="all">All gyms</option>
                  {gymOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label htmlFor="trainee-status">
                <span>Status</span>
                <select
                  id="trainee-status"
                  value={filters.status}
                  onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
                >
                  <option value="all">All statuses</option>
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {formatStatus(status)}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="trainer-trainee-panel__reset"
                onClick={() => {
                  setSearchTerm('');
                  setFilters({ gym: 'all', status: 'all' });
                }}
              >
                Reset
              </button>
            </div>

            {filteredTrainees.length ? (
              <>
                <ul className="trainer-trainee-list">
                  {pagedTrainees.map((trainee) => {
                    const traineeGymId = trainee.gym?._id ?? trainee.gym?.id ?? trainee.assignmentId;
                    const plannedSessions =
                      trainee.sessionsPerWeek ?? trainee.trainingPlan?.sessionsPerWeek ?? '—';
                    return (
                      <li
                        key={`${trainee.internalId}-${traineeGymId}`}
                        className="trainer-trainee-card"
                      >
                        <div className="trainer-trainee-card__header">
                          <div>
                            <strong>{trainee.name ?? 'Unnamed trainee'}</strong>
                            {trainee.email && <span>{trainee.email}</span>}
                          </div>
                          <span className={`status-chip status-chip--${trainee.status ?? 'unknown'}`}>
                            {formatStatus(trainee.status)}
                          </span>
                        </div>
                        <div className="trainer-trainee-card__meta">
                          <div>
                            <small>Gym</small>
                            <span>{trainee.gym?.name ?? '—'}</span>
                          </div>
                          <div>
                            <small>Assigned</small>
                            <span>{formatDate(trainee.assignedAt)}</span>
                          </div>
                          <div>
                            <small>Sessions</small>
                            <span>{plannedSessions}</span>
                          </div>
                        </div>
                        <div className="trainer-trainee-card__tags">
                          {trainee.goals?.length ? (
                            trainee.goals.map((goal) => (
                              <span key={goal} className="trainer-trainee-card__pill">
                                {goal}
                              </span>
                            ))
                          ) : (
                            <span className="trainer-trainee-card__pill trainer-trainee-card__pill--muted">
                              No goals shared yet
                            </span>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <PaginationBar page={page} totalPages={totalPages} totalItems={totalItems} startIndex={startIndex} endIndex={endIndex} onPage={setPage} />
              </>
            ) : (
              <EmptyState message="No trainees match your filters yet." />
            )}
          </div>
        ) : (
          <EmptyState message="Assignments will appear once a gym owner pairs trainees with you." />
        )}
      </DashboardSection>
    </div>
  );
};

export default TrainerTraineesPage;
