import { useMemo, useState } from 'react';
import DashboardSection from '../components/DashboardSection.jsx';
import EmptyState from '../components/EmptyState.jsx';
import SkeletonPanel from '../../../ui/SkeletonPanel.jsx';
import { useGetGymOwnerRosterQuery } from '../../../services/dashboardApi.js';
import {
  useRemoveTrainerFromGymMutation,
  useRemoveGymMemberMutation,
} from '../../../services/ownerApi.js';
import { useGetTrainerAvailabilityQuery } from '../../../services/trainerApi.js';
import useConfirmationModal from '../../../hooks/useConfirmationModal.js';
import { formatDate, formatStatus } from '../../../utils/format.js';
import { downloadCsvFile } from '../../../utils/csvExport.js';
import '../Dashboard.css';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const matchesQuery = (query, values = []) => {
  const normalized = String(query || '').trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  return values
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(normalized));
};

const formatAttendanceSnapshot = (attendance) => {
  if (!attendance) {
    return 'No attendance records yet';
  }

  return `${attendance.presentPercentage ?? 0}% present | streak ${attendance.streak ?? 0} | ${attendance.recentCount ?? 0} recent logs`;
};

const formatCheckInSnapshot = (checkIn) => {
  if (!checkIn?.lastDate) {
    return 'No recent check-in';
  }

  return `${formatStatus(checkIn.lastStatus || 'unknown')} on ${formatDate(checkIn.lastDate)}`;
};

const TrainerAvailabilitySummary = ({ trainerId, gymId }) => {
  const { data, isLoading, isError } = useGetTrainerAvailabilityQuery(
    { trainerId, gymId },
    { skip: !trainerId || !gymId },
  );

  const entries = data?.data?.availability ?? [];
  const slots = entries.flatMap((entry) => entry.slots ?? []);

  if (isLoading) {
    return <small className="owner-roster-schedule__state">Loading schedule...</small>;
  }

  if (isError) {
    return <small className="owner-roster-schedule__state">Schedule unavailable.</small>;
  }

  if (!slots.length) {
    return <small className="owner-roster-schedule__state">No availability shared yet.</small>;
  }

  return (
    <div className="owner-roster-schedule">
      {slots.slice(0, 3).map((slot, index) => (
        <span key={`${slot.dayOfWeek}-${slot.startTime}-${index}`} className="owner-roster-schedule__pill">
          {WEEKDAY_LABELS[slot.dayOfWeek] ?? `Day ${slot.dayOfWeek}`} {slot.startTime}-{slot.endTime}
        </span>
      ))}
      {slots.length > 3 ? (
        <span className="owner-roster-schedule__pill owner-roster-schedule__pill--muted">
          +{slots.length - 3} more
        </span>
      ) : null}
    </div>
  );
};

const PersonDetailDrawer = ({ person, onClose }) => {
  if (!person) {
    return null;
  }

  const { type, gymName, record } = person;

  return (
    <div className="dashboard-overlay" role="dialog" aria-modal="true" onClick={(event) => {
      if (event.target === event.currentTarget) {
        onClose();
      }
    }}>
      <div className="dashboard-overlay__panel">
        <DashboardSection
          title={type === 'member' ? 'Member details' : 'Trainer details'}
          className="dashboard-section--overlay"
          action={<button type="button" className="ghost-button" onClick={onClose}>Close</button>}
        >
          <div className="owner-roster-detail">
            <div className="owner-roster-detail__hero">
              <div className="owner-roster-avatar owner-roster-avatar--large">
                {record.profilePicture ? (
                  <img src={record.profilePicture} alt={record.name} />
                ) : (
                  <span>{record.name?.charAt(0) ?? '?'}</span>
                )}
              </div>
              <div>
                <h3>{record.name}</h3>
                <p>{record.email || 'No email provided'}</p>
                <small>{gymName}</small>
              </div>
            </div>

            <div className="owner-roster-detail__grid">
              <div className="owner-roster-detail__card">
                <small>Status</small>
                <strong>{formatStatus(record.status || 'unknown')}</strong>
                {type === 'member' ? (
                  <p>{record.plan ? formatStatus(record.plan) : 'Custom plan'}</p>
                ) : (
                  <p>{record.approvedAt ? `Approved ${formatDate(record.approvedAt)}` : `Requested ${formatDate(record.requestedAt)}`}</p>
                )}
              </div>

              <div className="owner-roster-detail__card">
                <small>Check-in snapshot</small>
                <strong>{type === 'member' ? formatCheckInSnapshot(record.checkIn) : 'Availability-driven role'}</strong>
                <p>{type === 'member' ? formatAttendanceSnapshot(record.attendance) : 'Availability slots are shown below.'}</p>
              </div>

              <div className="owner-roster-detail__card">
                <small>{type === 'member' ? 'Assigned trainer' : 'Role details'}</small>
                <strong>{type === 'member' ? (record.trainer?.name ?? 'Unassigned') : 'Gym trainer'}</strong>
                <p>
                  {type === 'member'
                    ? (record.autoRenew ? 'Auto renew enabled' : 'Auto renew disabled')
                    : 'Use the schedule preview to confirm future coaching windows.'}
                </p>
              </div>
            </div>

            {type === 'member' ? (
              <div className="owner-roster-detail__panel">
                <h4>Membership details</h4>
                <div className="owner-roster-detail__list">
                  <div><span>Plan</span><strong>{record.plan ? formatStatus(record.plan) : 'Custom plan'}</strong></div>
                  <div><span>Started</span><strong>{record.startDate ? formatDate(record.startDate) : 'Pending'}</strong></div>
                  <div><span>Ends</span><strong>{record.endDate ? formatDate(record.endDate) : 'Open ended'}</strong></div>
                  <div><span>Attendance</span><strong>{formatAttendanceSnapshot(record.attendance)}</strong></div>
                </div>
              </div>
            ) : (
              <div className="owner-roster-detail__panel">
                <h4>Availability snapshot</h4>
                <TrainerAvailabilitySummary trainerId={record.id} gymId={person.gymId} />
              </div>
            )}
          </div>
        </DashboardSection>
      </div>
    </div>
  );
};

const GymOwnerRosterPage = () => {
  const {
    data: rosterResponse,
    isLoading: isRosterLoading,
    isError: isRosterError,
    refetch: refetchRoster,
  } = useGetGymOwnerRosterQuery();

  const [removeTrainerFromGym, { isLoading: isRemovingTrainer }] = useRemoveTrainerFromGymMutation();
  const [removeGymMember, { isLoading: isRemovingMember }] = useRemoveGymMemberMutation();

  const [rosterMessage, setRosterMessage] = useState(null);
  const [rosterError, setRosterError] = useState(null);
  const [removalContext, setRemovalContext] = useState(null);
  const [selectedGymId, setSelectedGymId] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [activePerson, setActivePerson] = useState(null);
  const { confirm, confirmationModal } = useConfirmationModal();

  const rosterGyms = useMemo(
    () => (Array.isArray(rosterResponse?.data?.gyms) ? rosterResponse.data.gyms : []),
    [rosterResponse?.data?.gyms],
  );

  const isProcessingRemoval = Boolean(
    removalContext
      && ((removalContext.type === 'trainer' && isRemovingTrainer)
        || (removalContext.type === 'member' && isRemovingMember)),
  );

  const resetRosterAlerts = () => {
    setRosterMessage(null);
    setRosterError(null);
  };

  const handleRemoveTrainer = async ({ assignmentId, name }, gymName) => {
    if (!assignmentId) {
      return;
    }

    const confirmed = await confirm({
      title: 'Remove trainer',
      message: `Remove ${name ?? 'this trainer'} from ${gymName}? Their assignment history will be preserved, but they will no longer be active for this gym.`,
      confirmLabel: 'Remove trainer',
      cancelLabel: 'Keep trainer',
      tone: 'warning',
    });
    if (!confirmed) {
      return;
    }
    resetRosterAlerts();
    setRemovalContext({ type: 'trainer', id: assignmentId });

    try {
      await removeTrainerFromGym({ assignmentId }).unwrap();
      setRosterMessage('Trainer removed successfully.');
      setActivePerson(null);
      await refetchRoster();
    } catch (error) {
      setRosterError(error?.data?.message ?? 'Unable to remove trainer right now.');
    } finally {
      setRemovalContext(null);
    }
  };

  const handleRemoveMember = async ({ membershipId, name }, gymName) => {
    if (!membershipId) {
      return;
    }

    const confirmed = await confirm({
      title: 'Remove member',
      message: `Remove ${name ?? 'this member'} from ${gymName}? Their membership will be ended and they will lose roster access for this gym.`,
      confirmLabel: 'Remove member',
      cancelLabel: 'Keep member',
      tone: 'danger',
    });
    if (!confirmed) {
      return;
    }
    resetRosterAlerts();
    setRemovalContext({ type: 'member', id: membershipId });

    try {
      await removeGymMember({ membershipId }).unwrap();
      setRosterMessage('Member removed successfully.');
      setActivePerson(null);
      await refetchRoster();
    } catch (error) {
      setRosterError(error?.data?.message ?? 'Unable to remove member right now.');
    } finally {
      setRemovalContext(null);
    }
  };

  const filteredGyms = useMemo(() => {
    return rosterGyms
      .filter((gym) => selectedGymId === 'all' || gym.id === selectedGymId)
      .map((gym) => {
        const filteredMembers = (gym.trainees ?? []).filter((member) => matchesQuery(searchTerm, [
          gym.name,
          member.name,
          member.email,
          member.plan,
          member.trainer?.name,
          member.status,
        ]));

        const filteredTrainers = (gym.trainers ?? []).filter((trainer) => matchesQuery(searchTerm, [
          gym.name,
          trainer.name,
          trainer.email,
          trainer.status,
        ]));

        const keepGym = !searchTerm.trim()
          || matchesQuery(searchTerm, [gym.name, gym.city])
          || filteredMembers.length
          || filteredTrainers.length;

        if (!keepGym) {
          return null;
        }

        return {
          ...gym,
          trainees: filteredMembers,
          trainers: filteredTrainers,
        };
      })
      .filter(Boolean);
  }, [rosterGyms, searchTerm, selectedGymId]);

  const rosterSummary = useMemo(() => {
    const members = filteredGyms.flatMap((gym) => gym.trainees ?? []);
    const trainers = filteredGyms.flatMap((gym) => gym.trainers ?? []);
    const expiringSoon = members.filter((member) => {
      if (!member.endDate) {
        return false;
      }
      const daysUntilEnd = (new Date(member.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      return daysUntilEnd >= 0 && daysUntilEnd <= 14;
    }).length;
    const staleCheckIns = members.filter((member) => {
      if (!member.checkIn?.lastDate) {
        return true;
      }
      const daysSinceCheckIn = (Date.now() - new Date(member.checkIn.lastDate).getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceCheckIn > 7;
    }).length;
    const averagePresentRate = members.length
      ? Math.round(
          members.reduce((sum, member) => sum + Number(member.attendance?.presentPercentage ?? 0), 0) / members.length,
        )
      : 0;

    return {
      members: members.length,
      trainers: trainers.length,
      expiringSoon,
      staleCheckIns,
      averagePresentRate,
    };
  }, [filteredGyms]);

  const exportRows = useMemo(() => filteredGyms.flatMap((gym) => {
    const rows = [];

    if (roleFilter !== 'trainers') {
      (gym.trainees ?? []).forEach((member) => {
        rows.push({
          gym: gym.name,
          type: 'Member',
          name: member.name,
          email: member.email || '',
          status: member.status || '',
          plan: member.plan || '',
          assignedTrainer: member.trainer?.name || '',
          attendance: formatAttendanceSnapshot(member.attendance),
          lastCheckIn: formatCheckInSnapshot(member.checkIn),
          started: member.startDate ? formatDate(member.startDate) : '',
        });
      });
    }

    if (roleFilter !== 'members') {
      (gym.trainers ?? []).forEach((trainer) => {
        rows.push({
          gym: gym.name,
          type: 'Trainer',
          name: trainer.name,
          email: trainer.email || '',
          status: trainer.status || '',
          plan: '',
          assignedTrainer: '',
          attendance: 'Availability based',
          lastCheckIn: trainer.approvedAt ? `Approved ${formatDate(trainer.approvedAt)}` : '',
          started: trainer.requestedAt ? formatDate(trainer.requestedAt) : '',
        });
      });
    }

    return rows;
  }), [filteredGyms, roleFilter]);

  const handleExportRoster = () => {
    downloadCsvFile({
      filename: 'gym-roster-export.csv',
      columns: [
        { key: 'gym', label: 'Gym' },
        { key: 'type', label: 'Role' },
        { key: 'name', label: 'Name' },
        { key: 'email', label: 'Email' },
        { key: 'status', label: 'Status' },
        { key: 'plan', label: 'Plan' },
        { key: 'assignedTrainer', label: 'Assigned Trainer' },
        { key: 'attendance', label: 'Attendance Snapshot' },
        { key: 'lastCheckIn', label: 'Last Check-in' },
        { key: 'started', label: 'Joined / Requested' },
      ],
      rows: exportRows,
    });
    setRosterMessage('Roster exported as CSV.');
  };

  return (
    <>
      <div className="dashboard-grid dashboard-grid--owner">
        <DashboardSection
          title="People roster"
          className="dashboard-section--span-12"
          action={(
            <div className="users-toolbar">
              <input
                type="search"
                className="inventory-toolbar__input"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search gyms, members, trainers, or plans"
                aria-label="Search roster"
              />
              <select
                className="inventory-toolbar__input inventory-toolbar__input--select"
                value={selectedGymId}
                onChange={(event) => setSelectedGymId(event.target.value)}
                aria-label="Filter roster by gym"
              >
                <option value="all">All gyms</option>
                {rosterGyms.map((gym) => (
                  <option key={gym.id} value={gym.id}>{gym.name}</option>
                ))}
              </select>
              <select
                className="inventory-toolbar__input inventory-toolbar__input--select"
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value)}
                aria-label="Filter roster by role"
              >
                <option value="all">Members and trainers</option>
                <option value="members">Members only</option>
                <option value="trainers">Trainers only</option>
              </select>
              <button type="button" onClick={handleExportRoster} disabled={!exportRows.length}>
                Export roster
              </button>
              <button type="button" onClick={() => { resetRosterAlerts(); refetchRoster(); }}>
                Refresh
              </button>
            </div>
          )}
        >
          <div className="stat-grid" style={{ marginBottom: '1.25rem' }}>
            <div className="stat-card">
              <small>Visible members</small>
              <strong>{rosterSummary.members}</strong>
              <small>Across the current roster filters</small>
            </div>
            <div className="stat-card">
              <small>Visible trainers</small>
              <strong>{rosterSummary.trainers}</strong>
              <small>Assignments active or pending</small>
            </div>
            <div className="stat-card">
              <small>Plans expiring soon</small>
              <strong>{rosterSummary.expiringSoon}</strong>
              <small>Members ending within 14 days</small>
            </div>
            <div className="stat-card">
              <small>Attention needed</small>
              <strong>{rosterSummary.staleCheckIns}</strong>
              <small>{rosterSummary.averagePresentRate}% average present rate</small>
            </div>
          </div>

          {rosterMessage && (
            <p className="dashboard-message dashboard-message--success">{rosterMessage}</p>
          )}
          {(rosterError || isRosterError) && (
            <p className="dashboard-message dashboard-message--error">
              {rosterError ?? 'We could not load your roster right now.'}
            </p>
          )}

          {isRosterLoading && !rosterGyms.length ? (
            <SkeletonPanel lines={8} />
          ) : filteredGyms.length ? (
            <div className="owner-roster-grid">
              {filteredGyms.map((gym) => (
                <div key={gym.id} className="owner-roster-card">
                  <div className="owner-roster-card__header">
                    <div>
                      <h4>{gym.name}</h4>
                      <p>{gym.city || 'Location pending'}</p>
                    </div>
                    <div className="owner-roster-card__meta">
                      <span className={`owner-roster-badge owner-roster-badge--${gym.status}`}>
                        {formatStatus(gym.status)}
                      </span>
                      {!gym.isPublished && <span className="owner-roster-tag owner-roster-tag--draft">Draft</span>}
                    </div>
                  </div>

                  <div className="owner-roster-summary">
                    <div>
                      <small>Members</small>
                      <strong>{gym.trainees.length}</strong>
                    </div>
                    <div>
                      <small>Trainers</small>
                      <strong>{gym.trainers.length}</strong>
                    </div>
                  </div>

                  <div className="owner-roster-columns">
                    {roleFilter !== 'trainers' ? (
                      <div className="owner-roster-list">
                        <div className="owner-roster-list__title">
                          <span>Members</span>
                          <small>{gym.trainees.length}</small>
                        </div>
                        {gym.trainees.length ? (
                          <ul className="owner-roster-list__items">
                            {gym.trainees.map((member) => (
                              <li key={member.membershipId} className="owner-roster-list__item">
                                <div className="owner-roster-avatar">
                                  {member.profilePicture ? (
                                    <img src={member.profilePicture} alt={member.name} />
                                  ) : (
                                    <span>{member.name?.charAt(0) ?? '?'}</span>
                                  )}
                                </div>
                                <div className="owner-roster-meta">
                                  <strong>{member.name}</strong>
                                  <small>{member.email || 'No email provided'}</small>
                                  <small>
                                    {member.plan ? formatStatus(member.plan) : 'Custom plan'} | {member.startDate ? `Since ${formatDate(member.startDate)}` : 'Start pending'}
                                  </small>
                                  <small>
                                    Status: {formatStatus(member.status || 'unknown')}
                                    {' | '}
                                    {member.endDate ? `Plan ends ${formatDate(member.endDate)}` : 'No end date published'}
                                  </small>
                                  {member.trainer?.name ? <small>Trainer: {member.trainer.name}</small> : null}
                                  <small>Attendance: {formatAttendanceSnapshot(member.attendance)}</small>
                                  <small>Check-in: {formatCheckInSnapshot(member.checkIn)}</small>
                                </div>
                                <div className="owner-roster-actions">
                                  <button
                                    type="button"
                                    className="owner-roster-action"
                                    onClick={() => setActivePerson({ type: 'member', gymId: gym.id, gymName: gym.name, record: member })}
                                  >
                                    View
                                  </button>
                                  <button
                                    type="button"
                                    className="owner-roster-action"
                                    disabled={
                                      removalContext?.type === 'member'
                                      && removalContext?.id === member.membershipId
                                      && isProcessingRemoval
                                    }
                                    onClick={() => handleRemoveMember(member, gym.name)}
                                  >
                                    {removalContext?.type === 'member'
                                      && removalContext?.id === member.membershipId
                                      && isProcessingRemoval
                                      ? 'Removing...'
                                      : 'Remove'}
                                  </button>
                                </div>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="owner-roster-empty">No members match the current filters.</p>
                        )}
                      </div>
                    ) : null}

                    {roleFilter !== 'members' ? (
                      <div className="owner-roster-list">
                        <div className="owner-roster-list__title">
                          <span>Trainers</span>
                          <small>{gym.trainers.length}</small>
                        </div>
                        {gym.trainers.length ? (
                          <ul className="owner-roster-list__items">
                            {gym.trainers.map((trainer) => (
                              <li key={trainer.assignmentId} className="owner-roster-list__item">
                                <div className="owner-roster-avatar">
                                  {trainer.profilePicture ? (
                                    <img src={trainer.profilePicture} alt={trainer.name} />
                                  ) : (
                                    <span>{trainer.name?.charAt(0) ?? '?'}</span>
                                  )}
                                </div>
                                <div className="owner-roster-meta">
                                  <strong>{trainer.name}</strong>
                                  <small>{trainer.email || 'No email provided'}</small>
                                  <small>
                                    {trainer.status === 'pending'
                                      ? `Requested ${trainer.requestedAt ? formatDate(trainer.requestedAt) : 'recently'}`
                                      : `Approved ${trainer.approvedAt ? formatDate(trainer.approvedAt) : 'recently'}`}
                                  </small>
                                  <TrainerAvailabilitySummary trainerId={trainer.id} gymId={gym.id} />
                                </div>
                                <div className="owner-roster-actions">
                                  <button
                                    type="button"
                                    className="owner-roster-action"
                                    onClick={() => setActivePerson({ type: 'trainer', gymId: gym.id, gymName: gym.name, record: trainer })}
                                  >
                                    View
                                  </button>
                                  <button
                                    type="button"
                                    className="owner-roster-action owner-roster-action--danger"
                                    disabled={
                                      removalContext?.type === 'trainer'
                                      && removalContext?.id === trainer.assignmentId
                                      && isProcessingRemoval
                                    }
                                    onClick={() => handleRemoveTrainer(trainer, gym.name)}
                                  >
                                    {removalContext?.type === 'trainer'
                                      && removalContext?.id === trainer.assignmentId
                                      && isProcessingRemoval
                                      ? 'Removing...'
                                      : 'Remove'}
                                  </button>
                                </div>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="owner-roster-empty">No trainers match the current filters.</p>
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState message="No roster records match the current filters." />
          )}
        </DashboardSection>
      </div>

      <PersonDetailDrawer person={activePerson} onClose={() => setActivePerson(null)} />
      {confirmationModal}
    </>
  );
};

export default GymOwnerRosterPage;
