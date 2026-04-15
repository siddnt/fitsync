import { useMemo, useState } from 'react';
import DashboardSection from '../components/DashboardSection.jsx';
import EmptyState from '../components/EmptyState.jsx';
import SkeletonPanel from '../../../ui/SkeletonPanel.jsx';
import {
  useGetTrainerTraineesQuery,
} from '../../../services/dashboardApi.js';
import { formatDate, formatStatus } from '../../../utils/format.js';
import SearchSuggestInput from '../../../components/dashboard/SearchSuggestInput.jsx';
import { matchesPrefix, matchesAcrossFields } from '../../../utils/search.js';
import '../Dashboard.css';

const TrainerTraineesPage = () => {
  const { data, isLoading, isError, refetch } = useGetTrainerTraineesQuery();
  const rawAssignments = data?.data?.assignments;

  const assignments = useMemo(
    () => (Array.isArray(rawAssignments) ? rawAssignments : []),
    [rawAssignments],
  );

  const trainees = useMemo(
    () =>
      assignments.flatMap((assignment) =>
        (assignment.trainees || []).map((trainee, index) => {
          const resolvedId = trainee.id ?? trainee._id ?? `${assignment.id}-trainee-${index}`;
          return {
            ...trainee,
            assignmentId: assignment.id,
            gym: assignment.gym,
            internalId: String(resolvedId),
          };
        }),
      ),
    [assignments],
  );

  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({ gym: 'all', status: 'all' });

  const gymOptions = useMemo(() => {
    const uniqueGyms = new Map();
    trainees.forEach((trainee) => {
      const gymId = trainee.gym?._id ?? trainee.gym?.id;
      if (gymId && !uniqueGyms.has(gymId)) {
        uniqueGyms.set(gymId, trainee.gym?.name ?? 'Assigned gym');
      }
    });
    return Array.from(uniqueGyms, ([value, label]) => ({ value, label }));
  }, [trainees]);

  const statusOptions = useMemo(() => {
    const uniqueStatuses = new Set();
    trainees.forEach((trainee) => {
      if (trainee.status) {
        uniqueStatuses.add(trainee.status);
      }
    });
    return Array.from(uniqueStatuses);
  }, [trainees]);

  const filteredTrainees = useMemo(() => {
    const normalizedQuery = searchTerm.trim().toLowerCase();
    return trainees.filter((trainee) => {
      const gymId = trainee.gym?._id ?? trainee.gym?.id;
      const matchesGym = filters.gym === 'all' || gymId === filters.gym;
      const matchesStatus = filters.status === 'all' || trainee.status === filters.status;
      const matchesQuery =
        !normalizedQuery ||
        matchesAcrossFields(
          [trainee.name, trainee.email, trainee.gym?.name, trainee.status, ...(trainee.goals ?? [])],
          normalizedQuery,
        );
      return matchesGym && matchesStatus && matchesQuery;
    });
  }, [trainees, filters, searchTerm]);

  const searchSuggestions = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) {
      return [];
    }

    const suggestions = [];
    const seen = new Set();

    trainees.forEach((trainee) => {
      [
        {
          value: trainee.name,
          meta: `${trainee.gym?.name ?? 'No gym'} • ${formatStatus(trainee.status ?? 'active')}`,
        },
        {
          value: trainee.gym?.name,
          meta: `Gym • ${trainee.name ?? 'Unnamed trainee'}`,
        },
        ...((trainee.goals ?? []).map((goal) => ({
          value: goal,
          meta: `Goal • ${trainee.name ?? 'Unnamed trainee'}`,
        }))),
      ].forEach((entry, index) => {
        const normalized = entry.value?.toString().trim();
        if (!normalized) {
          return;
        }
        const lower = normalized.toLowerCase();
        if (!matchesPrefix(lower, query)) {
          return;
        }
        const key = `${index}:${lower}`;
        if (seen.has(key)) {
          return;
        }
        seen.add(key);
        suggestions.push({
          id: key,
          label: normalized,
          meta: entry.meta,
        });
      });
    });

    return suggestions;
  }, [trainees, searchTerm]);

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
                <SearchSuggestInput
                  id="trainee-search"
                  value={searchTerm}
                  onChange={setSearchTerm}
                  onSelect={(suggestion) => setSearchTerm(suggestion.label)}
                  suggestions={searchSuggestions}
                  placeholder="Search by trainee name, gym, or goal"
                  ariaLabel="Search trainees"
                  noResultsText="No trainees match those search attributes."
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
              <ul className="trainer-trainee-list">
                {filteredTrainees.map((trainee) => {
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
