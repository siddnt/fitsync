import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import DashboardSection from '../components/DashboardSection.jsx';
import EmptyState from '../components/EmptyState.jsx';
import SkeletonPanel from '../../../ui/SkeletonPanel.jsx';
import AutosuggestInput from '../../../ui/AutosuggestInput.jsx';
import { useGetAdminGymDetailsQuery } from '../../../services/dashboardApi.js';
import { useDeleteGymMutation } from '../../../services/adminApi.js';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatNumber,
  formatStatus,
} from '../../../utils/format.js';
import '../Dashboard.css';

const getGymId = (gym) => String(gym?.id ?? gym?._id ?? '');
const getUserId = (user) => String(user?.id ?? user?._id ?? '');
const RELATIONSHIP_OPTIONS = [
  { value: 'members', label: 'Members' },
  { value: 'trainers', label: 'Trainers' },
  { value: 'trainees', label: 'Trainees' },
  { value: 'assignments', label: 'Assignments' },
  { value: 'assignedTrainers', label: 'Assigned Trainers' },
  { value: 'assignedTrainees', label: 'Assigned Trainees' },
];

const AdminGymDetailsPage = () => {
  const navigate = useNavigate();
  const { gymId } = useParams();
  const { data, isLoading, isError, refetch } = useGetAdminGymDetailsQuery(gymId, {
    skip: !gymId,
  });
  const [deleteGymRecord, { isLoading: isDeletingGym }] = useDeleteGymMutation();

  const gym = data?.data?.gym ?? null;
  const members = Array.isArray(gym?.members) ? gym.members : [];
  const trainers = Array.isArray(gym?.trainers) ? gym.trainers : [];
  const trainees = Array.isArray(gym?.trainees) ? gym.trainees : [];
  const assignments = Array.isArray(gym?.assignments) ? gym.assignments : [];
  const assignedTrainers = Array.isArray(gym?.assignedTrainers) ? gym.assignedTrainers : [];
  const assignedTrainees = Array.isArray(gym?.assignedTrainees) ? gym.assignedTrainees : [];
  const [relationshipView, setRelationshipView] = useState('members');
  const [relationshipSearch, setRelationshipSearch] = useState('');
  const [notice, setNotice] = useState(null);
  const [errorNotice, setErrorNotice] = useState(null);

  const toJoinedText = (values) => {
    if (!Array.isArray(values) || !values.length) {
      return '-';
    }
    const parts = values.map((value) => String(value || '').trim()).filter(Boolean);
    return parts.length ? parts.join(', ') : '-';
  };

  const toDisplayValue = (value, suffix = '') => {
    if (value === null || value === undefined || value === '') {
      return '-';
    }
    return `${value}${suffix}`;
  };

  const metricCards = [
    { label: 'Members', value: members.length },
    { label: 'Trainers', value: trainers.length },
    { label: 'Trainees', value: trainees.length },
    { label: 'Impressions', value: formatNumber(gym?.analytics?.impressions ?? 0) },
    { label: 'Rating', value: gym?.analytics?.rating ?? 0 },
    { label: 'Reviews', value: gym?.analytics?.ratingCount ?? 0 },
    { label: 'Assignments', value: assignments.length },
    { label: 'Assigned Trainers', value: assignedTrainers.length },
    { label: 'Assigned Trainees', value: assignedTrainees.length },
  ];

  const relationshipSuggestions = useMemo(() => {
    const pushUnique = (collector, seen, value) => {
      const text = String(value || '').trim();
      if (!text) {
        return;
      }
      const key = text.toLowerCase();
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      collector.push(text);
    };

    const suggestions = [];
    const seen = new Set();

    if (relationshipView === 'members') {
      members.forEach((member) => {
        [member.trainee?.name, member.trainer?.name]
          .forEach((value) => pushUnique(suggestions, seen, value));
      });
      return suggestions;
    }

    if (relationshipView === 'trainers') {
      trainers.forEach((trainer) => {
        [trainer.name]
          .forEach((value) => pushUnique(suggestions, seen, value));
      });
      return suggestions;
    }

    if (relationshipView === 'trainees') {
      trainees.forEach((trainee) => {
        [trainee.name]
          .forEach((value) => pushUnique(suggestions, seen, value));
      });
      return suggestions;
    }

    if (relationshipView === 'assignments') {
      assignments.forEach((assignment) => {
        [assignment.trainer?.name]
          .forEach((value) => pushUnique(suggestions, seen, value));
        (assignment.trainees ?? []).forEach((entry) => {
          [entry.trainee?.name]
            .forEach((value) => pushUnique(suggestions, seen, value));
        });
      });
      return suggestions;
    }

    if (relationshipView === 'assignedTrainers') {
      assignedTrainers.forEach((trainer) => {
        [trainer.name]
          .forEach((value) => pushUnique(suggestions, seen, value));
      });
      return suggestions;
    }

    assignedTrainees.forEach((trainee) => {
      [trainee.name]
        .forEach((value) => pushUnique(suggestions, seen, value));
    });
    return suggestions;
  }, [relationshipView, members, trainers, trainees, assignments, assignedTrainers, assignedTrainees]);

  const relationshipData = useMemo(() => {
    const query = relationshipSearch.trim().toLowerCase();
    const includesQuery = (values) => !query || values
      .filter((value) => value !== null && value !== undefined)
      .some((value) => String(value).toLowerCase().includes(query));

    if (relationshipView === 'members') {
      const rows = members.filter((member) => includesQuery([
        member.trainee?.name,
        member.trainee?.email,
        member.trainer?.name,
        member.trainer?.email,
        member.plan,
        member.status,
      ]));
      return {
        rows,
        emptyMessage: query ? 'No members match this search.' : 'No active members found for this gym.',
      };
    }

    if (relationshipView === 'trainers') {
      const rows = trainers.filter((trainer) => includesQuery([
        trainer.name,
        trainer.email,
        trainer.role,
        trainer.status,
      ]));
      return {
        rows,
        emptyMessage: query ? 'No trainers match this search.' : 'No trainers linked to this gym.',
      };
    }

    if (relationshipView === 'trainees') {
      const rows = trainees.filter((trainee) => includesQuery([
        trainee.name,
        trainee.email,
        trainee.role,
        trainee.status,
      ]));
      return {
        rows,
        emptyMessage: query ? 'No trainees match this search.' : 'No trainees enrolled in this gym.',
      };
    }

    if (relationshipView === 'assignments') {
      const rows = assignments.filter((assignment) => includesQuery([
        assignment.trainer?.name,
        assignment.trainer?.email,
        assignment.status,
        ...(assignment.trainees ?? []).flatMap((entry) => [entry.trainee?.name, entry.trainee?.email, entry.status]),
      ]));
      return {
        rows,
        emptyMessage: query ? 'No assignments match this search.' : 'No trainer assignments for this gym.',
      };
    }

    if (relationshipView === 'assignedTrainers') {
      const rows = assignedTrainers.filter((trainer) => includesQuery([
        trainer.name,
        trainer.email,
        trainer.role,
        trainer.status,
      ]));
      return {
        rows,
        emptyMessage: query
          ? 'No assigned trainers match this search.'
          : 'No assigned trainers found from active/pending assignments.',
      };
    }

    const rows = assignedTrainees.filter((trainee) => includesQuery([
      trainee.name,
      trainee.email,
      trainee.role,
      trainee.status,
      trainee.assignmentCount,
    ]));
    return {
      rows,
      emptyMessage: query ? 'No assigned trainees match this search.' : 'No active assigned trainees found.',
    };
  }, [
    relationshipView,
    relationshipSearch,
    members,
    trainers,
    trainees,
    assignments,
    assignedTrainers,
    assignedTrainees,
  ]);

  const renderRelationshipTable = () => {
    if (!relationshipData.rows.length) {
      return <EmptyState message={relationshipData.emptyMessage} />;
    }

    if (relationshipView === 'members') {
      return (
        <div className="admin-table-wrapper">
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Assigned Trainer</th>
                <th>Plan</th>
                <th>Status</th>
                <th>Period</th>
              </tr>
            </thead>
            <tbody>
              {relationshipData.rows.map((member) => (
                <tr key={member.id}>
                  <td>
                    {getUserId(member.trainee) ? (
                      <Link to={`/dashboard/admin/users/${getUserId(member.trainee)}`} className="dashboard-table__user--link">
                        {member.trainee?.name ?? '-'}
                      </Link>
                    ) : (
                      member.trainee?.name ?? '-'
                    )}
                    <div><small>{member.trainee?.email ?? '-'}</small></div>
                  </td>
                  <td>
                    {getUserId(member.trainer) ? (
                      <Link to={`/dashboard/admin/users/${getUserId(member.trainer)}`} className="dashboard-table__user--link">
                        {member.trainer?.name ?? '-'}
                      </Link>
                    ) : (
                      member.trainer?.name ?? '-'
                    )}
                  </td>
                  <td>{formatStatus(member.plan || 'monthly')}</td>
                  <td>{formatStatus(member.status)}</td>
                  <td>{member.startDate && member.endDate ? `${formatDate(member.startDate)} - ${formatDate(member.endDate)}` : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    if (relationshipView === 'assignments') {
      return (
        <div className="admin-table-wrapper">
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Assigned Trainer</th>
                <th>Assigned Trainees</th>
                <th>Status</th>
                <th>Requested</th>
                <th>Approved</th>
              </tr>
            </thead>
            <tbody>
              {relationshipData.rows.map((assignment) => (
                <tr key={assignment.id}>
                  <td>
                    {getUserId(assignment.trainer) ? (
                      <Link to={`/dashboard/admin/users/${getUserId(assignment.trainer)}`} className="dashboard-table__user--link">
                        {assignment.trainer?.name ?? '-'}
                      </Link>
                    ) : (
                      assignment.trainer?.name ?? '-'
                    )}
                    <div><small>{assignment.trainer?.email ?? '-'}</small></div>
                  </td>
                  <td>
                    {assignment.trainees?.length
                      ? assignment.trainees
                        .map((entry) => `${entry.trainee?.name ?? 'Unknown'} (${formatStatus(entry.status)})`)
                        .join(', ')
                      : '-'}
                  </td>
                  <td>{formatStatus(assignment.status)}</td>
                  <td>{assignment.requestedAt ? formatDate(assignment.requestedAt) : '-'}</td>
                  <td>{assignment.approvedAt ? formatDate(assignment.approvedAt) : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    if (relationshipView === 'assignedTrainees') {
      return (
        <div className="admin-table-wrapper">
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Trainee</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Assignments</th>
              </tr>
            </thead>
            <tbody>
              {relationshipData.rows.map((trainee) => (
                <tr key={getUserId(trainee) || trainee?.email || trainee?.name}>
                  <td>
                    {getUserId(trainee) ? (
                      <Link to={`/dashboard/admin/users/${getUserId(trainee)}`} className="dashboard-table__user--link">
                        {trainee?.name ?? '-'}
                      </Link>
                    ) : (
                      trainee?.name ?? '-'
                    )}
                  </td>
                  <td>{trainee?.email ?? '-'}</td>
                  <td>{formatStatus(trainee?.role)}</td>
                  <td>{formatStatus(trainee?.status)}</td>
                  <td>{trainee?.assignmentCount ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    return (
      <div className="admin-table-wrapper">
        <table className="dashboard-table">
          <thead>
            <tr>
              <th>{relationshipView === 'trainees' ? 'Trainee' : 'Trainer'}</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {relationshipData.rows.map((person) => (
              <tr key={getUserId(person) || person?.email || person?.name}>
                <td>
                  {getUserId(person) ? (
                    <Link to={`/dashboard/admin/users/${getUserId(person)}`} className="dashboard-table__user--link">
                      {person?.name ?? '-'}
                    </Link>
                  ) : (
                    person?.name ?? '-'
                  )}
                </td>
                <td>{person?.email ?? '-'}</td>
                <td>{formatStatus(person?.role)}</td>
                <td>{formatStatus(person?.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const handleRemoveGym = async () => {
    if (!gym) {
      return;
    }

    const targetGymId = getGymId(gym);
    if (!targetGymId) {
      return;
    }

    setNotice(null);
    setErrorNotice(null);

    const confirmed = window.confirm(`Remove ${gym.name ?? 'this gym'}? This will cancel memberships and listings.`);
    if (!confirmed) {
      return;
    }

    try {
      await deleteGymRecord(targetGymId).unwrap();
      setNotice('Gym removed successfully.');
      navigate('/dashboard/admin/gyms');
    } catch (mutationError) {
      setErrorNotice(mutationError?.data?.message ?? 'Unable to remove this gym.');
    }
  };

  if (isLoading) {
    return (
      <div className="dashboard-grid dashboard-grid--stacked ud-page">
        <DashboardSection title="Gym details">
          <SkeletonPanel lines={8} />
        </DashboardSection>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="dashboard-grid dashboard-grid--stacked ud-page">
        <DashboardSection
          title="Gym details"
          action={(
            <div className="ud-actions">
              <button type="button" className="ud-btn" onClick={() => navigate('/dashboard/admin/gyms')}>
                Back to gyms
              </button>
              <button type="button" className="ud-btn" onClick={() => refetch()}>
                Retry
              </button>
            </div>
          )}
        >
          <EmptyState message="Could not load this gym right now." />
        </DashboardSection>
      </div>
    );
  }

  if (!gym) {
    return (
      <div className="dashboard-grid dashboard-grid--stacked ud-page">
        <DashboardSection
          title="Gym details"
          action={(
            <button type="button" className="ud-btn" onClick={() => navigate('/dashboard/admin/gyms')}>
              Back to gyms
            </button>
          )}
        >
          <EmptyState message="Gym was not found in the current admin list." />
        </DashboardSection>
      </div>
    );
  }

  return (
    <div className="dashboard-grid dashboard-grid--stacked ud-page">
      <DashboardSection
        title="Gym details"
        action={(
          <div className="ud-actions">
            <button type="button" className="ud-btn" onClick={() => navigate('/dashboard/admin/gyms')}>
              Back to gyms
            </button>
            <button type="button" className="ud-btn ud-btn--danger" onClick={handleRemoveGym} disabled={isDeletingGym}>
              {isDeletingGym ? 'Removing...' : 'Remove gym'}
            </button>
          </div>
        )}
      >
        {(notice || errorNotice) ? (
          <div className={`status-pill ${errorNotice ? 'status-pill--warning' : 'status-pill--success'}`}>
            {errorNotice || notice}
          </div>
        ) : null}
        <div className="user-detail__header">
          <div className="user-detail__avatar user-detail__avatar--placeholder user-detail__avatar--lg">
            {gym.name?.charAt(0) ?? 'G'}
          </div>
          <div className="user-detail__meta">
            <h3>{gym.name ?? 'Unnamed gym'}</h3>
            <small>{[gym.location?.city, gym.location?.state].filter(Boolean).join(', ') || 'Location unavailable'}</small>
            <div className="user-detail__badges">
              <span className={`status-pill ${gym.status === 'active' ? 'status-pill--success' : 'status-pill--warning'}`}>
                {formatStatus(gym.status ?? 'unknown')}
              </span>
              <span className={`status-pill ${gym.isPublished ? 'status-pill--success' : 'status-pill--warning'}`}>
                {gym.isPublished ? 'Published' : 'Unpublished'}
              </span>
              <span className={`status-pill ${gym.approvalStatus === 'approved' ? 'status-pill--success' : 'status-pill--warning'}`}>
                {formatStatus(gym.approvalStatus ?? 'approved')}
              </span>
            </div>
          </div>
        </div>

        <div className="user-detail__stats">
          {metricCards.map((metric) => (
            <div key={metric.label} className="user-detail__stat">
              <span className="user-detail__stat-value">{metric.value}</span>
              <span className="user-detail__stat-label">{metric.label}</span>
            </div>
          ))}
        </div>

        <h4 className="user-detail__section-title">🏋️ Gym Account</h4>
        <div className="user-detail__grid">
          <div className="user-detail__item">
            <span className="user-detail__label">Gym name</span>
            <span>{gym.name ?? '-'}</span>
          </div>
          <div className="user-detail__item">
            <span className="user-detail__label">Gym ID</span>
            <span>{getGymId(gym)}</span>
          </div>
          <div className="user-detail__item">
            <span className="user-detail__label">Owner</span>
            <span>
              {getUserId(gym.owner) ? (
                <Link to={`/dashboard/admin/users/${getUserId(gym.owner)}`} className="dashboard-table__user--link">
                  {gym.owner?.name}
                </Link>
              ) : (
                gym.owner?.name ?? '-'
              )}
            </span>
          </div>
          <div className="user-detail__item">
            <span className="user-detail__label">Owner email</span>
            <span>{gym.owner?.email ?? '-'}</span>
          </div>
          <div className="user-detail__item">
            <span className="user-detail__label">Owner phone</span>
            <span>{gym.owner?.contactNumber ?? '-'}</span>
          </div>
          <div className="user-detail__item">
            <span className="user-detail__label">Status</span>
            <span>{formatStatus(gym.status ?? 'unknown')}</span>
          </div>
          <div className="user-detail__item">
            <span className="user-detail__label">Published</span>
            <span>{gym.isPublished ? 'Yes' : 'No'}</span>
          </div>
          <div className="user-detail__item">
            <span className="user-detail__label">Approval</span>
            <span>{formatStatus(gym.approvalStatus ?? 'approved')}</span>
          </div>
          <div className="user-detail__item">
            <span className="user-detail__label">Active Flag</span>
            <span>{gym.isActive ? 'Yes' : 'No'}</span>
          </div>
          <div className="user-detail__item">
            <span className="user-detail__label">Sponsorship</span>
            <span>{formatStatus(gym.sponsorship?.status ?? 'none')}</span>
          </div>
          <div className="user-detail__item">
            <span className="user-detail__label">Created</span>
            <span>{formatDate(gym.createdAt)}</span>
          </div>
          <div className="user-detail__item">
            <span className="user-detail__label">Updated</span>
            <span>{formatDate(gym.updatedAt)}</span>
          </div>
          <div className="user-detail__item user-detail__item--full">
            <span className="user-detail__label">Location</span>
            <span>{[gym.location?.city, gym.location?.state].filter(Boolean).join(', ') || '-'}</span>
          </div>
        </div>

        <h4 className="user-detail__section-title">📝 Description</h4>
        <div className="user-detail__grid">
          <div className="user-detail__item user-detail__item--full">
            <span className="user-detail__label">About gym</span>
            <span>{gym.description || '-'}</span>
          </div>
        </div>

        <h4 className="user-detail__section-title">📍 Location & Contact</h4>
        <div className="user-detail__grid">
          <div className="user-detail__item user-detail__item--full">
            <span className="user-detail__label">Address</span>
            <span>{gym.location?.address || '-'}</span>
          </div>
          <div className="user-detail__item">
            <span className="user-detail__label">City</span>
            <span>{gym.location?.city || '-'}</span>
          </div>
          <div className="user-detail__item">
            <span className="user-detail__label">State</span>
            <span>{gym.location?.state || '-'}</span>
          </div>
          <div className="user-detail__item">
            <span className="user-detail__label">Postal code</span>
            <span>{gym.location?.postalCode || '-'}</span>
          </div>
          <div className="user-detail__item">
            <span className="user-detail__label">Coordinates</span>
            <span>
              {gym.location?.coordinates?.lat !== undefined && gym.location?.coordinates?.lng !== undefined
                ? `${gym.location.coordinates.lat}, ${gym.location.coordinates.lng}`
                : '-'}
            </span>
          </div>
          <div className="user-detail__item">
            <span className="user-detail__label">Phone</span>
            <span>{gym.contact?.phone || '-'}</span>
          </div>
          <div className="user-detail__item">
            <span className="user-detail__label">Email</span>
            <span>{gym.contact?.email || '-'}</span>
          </div>
          <div className="user-detail__item">
            <span className="user-detail__label">Website</span>
            <span>{gym.contact?.website || '-'}</span>
          </div>
          <div className="user-detail__item">
            <span className="user-detail__label">Whatsapp</span>
            <span>{gym.contact?.whatsapp || '-'}</span>
          </div>
        </div>

        <h4 className="user-detail__section-title">💰 Pricing & Schedule</h4>
        <div className="user-detail__grid">
          <div className="user-detail__item">
            <span className="user-detail__label">Monthly MRP</span>
            <span>{formatCurrency({ amount: gym.pricing?.monthlyMrp, currency: gym.pricing?.currency })}</span>
          </div>
          <div className="user-detail__item">
            <span className="user-detail__label">Monthly Price</span>
            <span>{formatCurrency({ amount: gym.pricing?.monthlyPrice, currency: gym.pricing?.currency })}</span>
          </div>
          <div className="user-detail__item">
            <span className="user-detail__label">Currency</span>
            <span>{gym.pricing?.currency || 'INR'}</span>
          </div>
          <div className="user-detail__item">
            <span className="user-detail__label">Open time</span>
            <span>{gym.schedule?.openTime || '-'}</span>
          </div>
          <div className="user-detail__item">
            <span className="user-detail__label">Close time</span>
            <span>{gym.schedule?.closeTime || '-'}</span>
          </div>
          <div className="user-detail__item user-detail__item--full">
            <span className="user-detail__label">Working days</span>
            <span>{toJoinedText(gym.schedule?.workingDays)}</span>
          </div>
        </div>

        <h4 className="user-detail__section-title">✨ Features & Amenities</h4>
        <div className="user-detail__grid">
          <div className="user-detail__item user-detail__item--full">
            <span className="user-detail__label">Amenities</span>
            <span>{toJoinedText(gym.amenities)}</span>
          </div>
          <div className="user-detail__item user-detail__item--full">
            <span className="user-detail__label">Key features</span>
            <span>{toJoinedText(gym.keyFeatures)}</span>
          </div>
          <div className="user-detail__item user-detail__item--full">
            <span className="user-detail__label">Features</span>
            <span>{toJoinedText(gym.features)}</span>
          </div>
          <div className="user-detail__item user-detail__item--full">
            <span className="user-detail__label">Tags</span>
            <span>{toJoinedText(gym.tags)}</span>
          </div>
          <div className="user-detail__item">
            <span className="user-detail__label">Images</span>
            <span>{toDisplayValue(gym.images?.length)}</span>
          </div>
          <div className="user-detail__item">
            <span className="user-detail__label">Gallery</span>
            <span>{toDisplayValue(gym.gallery?.length)}</span>
          </div>
        </div>

        <h4 className="user-detail__section-title">🏆 Sponsorship & Listing</h4>
        <div className="user-detail__grid">
          <div className="user-detail__item">
            <span className="user-detail__label">Sponsorship status</span>
            <span>{formatStatus(gym.sponsorship?.status || 'none')}</span>
          </div>
          <div className="user-detail__item">
            <span className="user-detail__label">Sponsorship package</span>
            <span>{gym.sponsorship?.package ? formatStatus(gym.sponsorship.package) : '-'}</span>
          </div>
          <div className="user-detail__item">
            <span className="user-detail__label">Sponsorship amount</span>
            <span>{formatCurrency({ amount: gym.sponsorship?.amount, currency: gym.pricing?.currency })}</span>
          </div>
          <div className="user-detail__item">
            <span className="user-detail__label">Sponsorship expires</span>
            <span>{gym.sponsorship?.expiresAt ? formatDate(gym.sponsorship.expiresAt) : '-'}</span>
          </div>
          <div className="user-detail__item">
            <span className="user-detail__label">Listing plan</span>
            <span>{gym.listingSubscription?.planCode ? formatStatus(gym.listingSubscription.planCode) : '-'}</span>
          </div>
          <div className="user-detail__item">
            <span className="user-detail__label">Listing status</span>
            <span>{gym.listingSubscription?.status ? formatStatus(gym.listingSubscription.status) : '-'}</span>
          </div>
          <div className="user-detail__item">
            <span className="user-detail__label">Listing amount</span>
            <span>
              {gym.listingSubscription
                ? formatCurrency({ amount: gym.listingSubscription.amount, currency: gym.listingSubscription.currency })
                : '-'}
            </span>
          </div>
          <div className="user-detail__item">
            <span className="user-detail__label">Invoices</span>
            <span>{toDisplayValue(gym.listingSubscription?.invoiceCount)}</span>
          </div>
          <div className="user-detail__item">
            <span className="user-detail__label">Listing period</span>
            <span>
              {gym.listingSubscription?.periodStart && gym.listingSubscription?.periodEnd
                ? `${formatDate(gym.listingSubscription.periodStart)} - ${formatDate(gym.listingSubscription.periodEnd)}`
                : '-'}
            </span>
          </div>
          <div className="user-detail__item">
            <span className="user-detail__label">Auto renew</span>
            <span>{gym.listingSubscription ? (gym.listingSubscription.autoRenew ? 'Yes' : 'No') : '-'}</span>
          </div>
        </div>

        <h4 className="user-detail__section-title">📈 Analytics</h4>
        <div className="user-detail__grid">
          <div className="user-detail__item">
            <span className="user-detail__label">Impressions</span>
            <span>{formatNumber(gym.analytics?.impressions ?? 0)}</span>
          </div>
          <div className="user-detail__item">
            <span className="user-detail__label">Rating</span>
            <span>{toDisplayValue(gym.analytics?.rating)}</span>
          </div>
          <div className="user-detail__item">
            <span className="user-detail__label">Rating count</span>
            <span>{toDisplayValue(gym.analytics?.ratingCount)}</span>
          </div>
          <div className="user-detail__item">
            <span className="user-detail__label">Last impression</span>
            <span>{gym.analytics?.lastImpressionAt ? formatDateTime(gym.analytics.lastImpressionAt) : '-'}</span>
          </div>
          <div className="user-detail__item">
            <span className="user-detail__label">Last review</span>
            <span>{gym.analytics?.lastReviewAt ? formatDateTime(gym.analytics.lastReviewAt) : '-'}</span>
          </div>
        </div>

        <h4 className="user-detail__section-title">🔍 Relationship Explorer</h4>
        <div className="admin-toolbar">
          <select
            className="inventory-toolbar__input inventory-toolbar__input--select"
            value={relationshipView}
            onChange={(event) => {
              setRelationshipView(event.target.value);
              setRelationshipSearch('');
            }}
            aria-label="Select relationship view"
          >
            {RELATIONSHIP_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <AutosuggestInput
            className="inventory-toolbar__input"
            placeholder={`Search ${RELATIONSHIP_OPTIONS.find((option) => option.value === relationshipView)?.label?.toLowerCase() || 'records'}`}
            value={relationshipSearch}
            onChange={setRelationshipSearch}
            suggestions={relationshipSuggestions}
            ariaLabel="Search selected relationship records"
          />
          {relationshipSearch.trim() ? (
            <button type="button" className="admin-toolbar__reset" onClick={() => setRelationshipSearch('')}>
              Reset
            </button>
          ) : null}
        </div>
        {renderRelationshipTable()}
      </DashboardSection>
    </div>
  );
};

export default AdminGymDetailsPage;
