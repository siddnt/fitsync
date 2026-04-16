import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import DashboardSection from '../components/DashboardSection.jsx';
import EmptyState from '../components/EmptyState.jsx';
import GrowthLineChart from '../components/GrowthLineChart.jsx';
import SkeletonPanel from '../../../ui/SkeletonPanel.jsx';
import SearchSuggestInput from '../../../components/dashboard/SearchSuggestInput.jsx';
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
import './GymDetailsPage.css';

const EMPTY_VALUE = '-';
const EMPTY_LIST = [];
const EMPTY_OBJECT = {};

const getGymId = (gym) => String(gym?.id ?? gym?._id ?? '');
const getUserId = (user) => String(user?.id ?? user?._id ?? '');

const BASE_RELATIONSHIP_OPTIONS = [
  { value: 'members', label: 'Memberships', searchLabel: 'memberships' },
  { value: 'trainers', label: 'Linked trainers', searchLabel: 'trainers' },
  { value: 'trainees', label: 'Enrolled trainees', searchLabel: 'trainees' },
  { value: 'relationships', label: 'Trainer-trainee relationships', searchLabel: 'trainer-trainee relationships' },
];

const getStatusTone = (value) => {
  const normalized = String(value || '').toLowerCase();
  if (['active', 'approved', 'published', 'paid', 'delivered'].includes(normalized)) return 'success';
  if (['pending', 'processing', 'grace', 'paused', 'unpublished'].includes(normalized)) return 'info';
  return 'warning';
};

const displayValue = (value) => {
  if (value === null || value === undefined || value === '') return EMPTY_VALUE;
  if (Array.isArray(value)) return value.length ? value.join(', ') : EMPTY_VALUE;
  return String(value);
};

const joinValues = (values = []) => {
  if (!Array.isArray(values)) return EMPTY_VALUE;
  const filtered = values.map((value) => String(value || '').trim()).filter(Boolean);
  return filtered.length ? filtered.join(', ') : EMPTY_VALUE;
};

const matchesQuery = (query, values = []) => {
  const normalizedQuery = String(query || '').trim().toLowerCase();
  if (!normalizedQuery) return true;
  return values.filter(Boolean).some((value) => String(value).toLowerCase().includes(normalizedQuery));
};

const buildSuggestions = (entries = []) => {
  const suggestions = [];
  const seen = new Set();

  entries.forEach((entry) => {
    const label = String(entry?.label ?? entry ?? '').trim();
    if (!label) return;
    const key = label.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    suggestions.push({ id: key, label });
  });

  return suggestions;
};

const formatLocation = (...parts) => {
  const filtered = parts.map((part) => String(part || '').trim()).filter(Boolean);
  return filtered.length ? filtered.join(', ') : EMPTY_VALUE;
};

const formatCoordinates = (coordinates) => {
  const lat = Number(coordinates?.lat);
  const lng = Number(coordinates?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return EMPTY_VALUE;
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
};

const formatRatingValue = (value) => {
  const rating = Number(value);
  if (!Number.isFinite(rating) || rating <= 0) return EMPTY_VALUE;
  return `${rating.toFixed(1)}/5`;
};

const formatPeriodRange = (startDate, endDate) => {
  if (!startDate && !endDate) return EMPTY_VALUE;
  return `${formatDate(startDate)} - ${formatDate(endDate)}`;
};

const toTimestamp = (value) => {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatBillingSummary = (amount, currency, status) => {
  const resolvedAmount = Number(amount) || 0;
  const parts = [];

  if (resolvedAmount > 0) {
    parts.push(formatCurrency({ amount: resolvedAmount, currency: currency || 'INR' }));
  }

  if (status) {
    parts.push(formatStatus(status));
  }

  return parts.length ? parts.join(' · ') : EMPTY_VALUE;
};

const formatMembershipPlanSummary = (plan, currency) => {
  if (!plan) return EMPTY_VALUE;

  const label = plan.label || formatStatus(plan.code || plan.planCode || 'membership');
  const duration = Number(plan.durationMonths) > 0 ? `${plan.durationMonths} mo` : null;
  const amount = Number(plan.price ?? plan.configuredPrice ?? plan.mrp) || 0;
  const amountLabel = amount > 0 ? formatCurrency({ amount, currency }) : null;
  const parts = [label, duration, amountLabel].filter(Boolean);

  return parts.length ? parts.join(' / ') : label;
};

const formatConfiguredPlanValue = (plan, currency) => {
  if (!plan) return EMPTY_VALUE;

  const label = plan.label || formatStatus(plan.code || plan.planCode || 'membership');
  const price = Number(plan.price ?? plan.configuredPrice ?? plan.mrp) || 0;
  const mrp = Number(plan.mrp) || 0;
  const discount = Number(plan.discountPercent) || 0;
  const priceLabel = price > 0 ? formatCurrency({ amount: price, currency }) : null;
  const mrpLabel = mrp > price ? `MRP ${formatCurrency({ amount: mrp, currency })}` : null;
  const discountLabel = discount > 0 ? `${discount}% off` : null;
  const meta = [priceLabel, mrpLabel, discountLabel].filter(Boolean).join(' / ');

  return meta ? `${label}: ${meta}` : label;
};

const hasPositiveAmount = (amount) => (Number(amount) || 0) > 0;

const toExternalHref = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
};

const renderExternalLinkValue = (value) => {
  const label = String(value || '').trim();
  const href = toExternalHref(value);
  if (!label || !href) return EMPTY_VALUE;
  return <a href={href} target="_blank" rel="noreferrer">{label}</a>;
};

const renderUserLink = (user) => {
  const id = getUserId(user);
  const label = user?.name || user?.email || EMPTY_VALUE;
  return id ? <Link to={`/dashboard/admin/users/${id}`}>{label}</Link> : label;
};

const StatusChip = ({ value }) => (
  <span className={`status-pill status-pill--${getStatusTone(value)}`}>{formatStatus(value || 'unknown')}</span>
);

const DetailCard = ({ title, rows = [], children, className = '' }) => (
  <div className={`detail-card ${className}`.trim()}>
    <h4>{title}</h4>
    {rows.map((row) => (
      <div key={row.label} className="detail-row">
        <span className="detail-label">{row.label}</span>
        <div className="detail-value">{row.value}</div>
      </div>
    ))}
    {children}
  </div>
);

const AttributeGroup = ({ label, values }) => {
  const items = Array.isArray(values) ? values.map((value) => String(value || '').trim()).filter(Boolean) : [];
  return (
    <div className="admin-gym-details__attribute-group">
      <small className="admin-gym-details__attribute-label">{label}</small>
      {items.length ? (
        <div className="pill-row admin-gym-details__attribute-values">
          {items.map((item) => <span key={`${label}-${item}`} className="pill">{item}</span>)}
        </div>
      ) : (
        <div className="admin-gym-details__attribute-empty">{EMPTY_VALUE}</div>
      )}
    </div>
  );
};

const ExplorerToolbar = ({
  activeValue,
  onChange,
  options,
  searchValue,
  onSearchChange,
  suggestions,
  searchPlaceholder,
}) => (
  <div className="admin-gym-details__explorer-toolbar">
    <div className="filter-group admin-gym-details__explorer-filters">
      {options.map((option) => (
        <button key={option.value} type="button" className={`filter-btn ${activeValue === option.value ? 'active' : ''}`} onClick={() => onChange(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
    <div className="admin-gym-details__explorer-search">
      <SearchSuggestInput
        id={`gym-relationship-${activeValue}`}
        value={searchValue}
        onChange={onSearchChange}
        onSelect={(suggestion) => onSearchChange(suggestion.label)}
        suggestions={suggestions}
        placeholder={searchPlaceholder}
        ariaLabel="Search gym related records"
      />
    </div>
  </div>
);

const SectionHeading = ({ title, subtitle }) => (
  <div className="admin-gym-details__section-heading">
    <h4>{title}</h4>
    {subtitle ? <p>{subtitle}</p> : null}
  </div>
);

const InfoTile = ({ label, value, meta }) => (
  <div className="admin-gym-details__info-tile">
    <small className="admin-gym-details__info-label">{label}</small>
    <div className="admin-gym-details__info-value">{value}</div>
    {meta ? <div className="admin-gym-details__info-meta">{meta}</div> : null}
  </div>
);

const TableShell = ({ children }) => (
  <div className="admin-gym-details__table-wrap">
    {children}
  </div>
);

const AdminGymDetailsPage = () => {
  const navigate = useNavigate();
  const { gymId } = useParams();
  const { data, isLoading, isError, refetch } = useGetAdminGymDetailsQuery(gymId, {
    skip: !gymId,
    refetchOnMountOrArgChange: true,
    refetchOnFocus: true,
    refetchOnReconnect: true,
    pollingInterval: 30000,
  });
  const [deleteGymRecord, { isLoading: isDeletingGym }] = useDeleteGymMutation();
  const [relationshipView, setRelationshipView] = useState('members');
  const [relationshipSearch, setRelationshipSearch] = useState('');
  const [notice, setNotice] = useState(null);
  const [errorNotice, setErrorNotice] = useState(null);

  const gym = data?.data?.gym ?? null;
  const generatedAt = data?.data?.generatedAt ?? null;
  const members = Array.isArray(gym?.members) ? gym.members : EMPTY_LIST;
  const trainers = Array.isArray(gym?.trainers) ? gym.trainers : EMPTY_LIST;
  const assignedTrainers = Array.isArray(gym?.assignedTrainers) ? gym.assignedTrainers : EMPTY_LIST;
  const trainees = Array.isArray(gym?.trainees) ? gym.trainees : EMPTY_LIST;
  const assignedTrainees = Array.isArray(gym?.assignedTrainees) ? gym.assignedTrainees : EMPTY_LIST;
  const assignments = Array.isArray(gym?.assignments) ? gym.assignments : EMPTY_LIST;
  const features = Array.isArray(gym?.features) ? gym.features : EMPTY_LIST;
  const amenities = Array.isArray(gym?.amenities) ? gym.amenities : EMPTY_LIST;
  const keyFeatures = Array.isArray(gym?.keyFeatures) ? gym.keyFeatures : EMPTY_LIST;
  const tags = Array.isArray(gym?.tags) ? gym.tags : EMPTY_LIST;
  const images = Array.isArray(gym?.images) ? gym.images : EMPTY_LIST;
  const gallery = Array.isArray(gym?.gallery) ? gym.gallery : EMPTY_LIST;
  const listingSubscriptions = Array.isArray(gym?.listingSubscriptions) ? gym.listingSubscriptions : EMPTY_LIST;
  const sponsorshipHistory = Array.isArray(gym?.sponsorshipHistory) ? gym.sponsorshipHistory : EMPTY_LIST;
  const membershipInsights = gym?.subscriptionInsights?.memberships ?? EMPTY_OBJECT;
  const listingInsights = gym?.subscriptionInsights?.listings ?? EMPTY_OBJECT;
  const sponsorshipInsights = gym?.subscriptionInsights?.sponsorships ?? EMPTY_OBJECT;
  const membershipOfferings = Array.isArray(membershipInsights?.offerings) ? membershipInsights.offerings : EMPTY_LIST;
  const configuredMembershipPlans = Array.isArray(membershipInsights?.configuredPlans) && membershipInsights.configuredPlans.length
    ? membershipInsights.configuredPlans
    : Array.isArray(gym?.pricing?.plans)
      ? gym.pricing.plans
      : EMPTY_LIST;
  const defaultMembershipPlan = membershipInsights?.defaultPlan ?? null;
  const startingMembershipPlan = membershipInsights?.startingPlan ?? null;
  const revenue = gym?.revenue ?? EMPTY_OBJECT;
  const revenueEvents = Array.isArray(revenue?.events) ? revenue.events : EMPTY_LIST;
  const revenueTrend = Array.isArray(revenue?.trend?.monthly) ? revenue?.trend?.monthly : EMPTY_LIST;

  const trainerMembershipCount = useMemo(() => {
    const counts = {};
    members.forEach((membership) => {
      const id = getUserId(membership.trainer);
      if (id) counts[id] = (counts[id] || 0) + 1;
    });
    return counts;
  }, [members]);

  const trainerAssignmentCount = useMemo(() => {
    const counts = {};
    assignments.forEach((assignment) => {
      const id = getUserId(assignment.trainer);
      if (id) counts[id] = (counts[id] || 0) + 1;
    });
    return counts;
  }, [assignments]);

  const traineeMembershipCount = useMemo(() => {
    const counts = {};
    members.forEach((membership) => {
      const id = getUserId(membership.trainee);
      if (id) counts[id] = (counts[id] || 0) + 1;
    });
    return counts;
  }, [members]);

  const traineeAssignmentCount = useMemo(() => {
    const counts = {};
    assignments.forEach((assignment) => {
      (assignment.trainees ?? []).forEach((entry) => {
        const id = getUserId(entry.trainee);
        if (id) counts[id] = (counts[id] || 0) + 1;
      });
    });
    return counts;
  }, [assignments]);

  const trainerTraineeRelationships = useMemo(() => {
    const relationshipMap = {};

    const ensureRelationship = (trainer, trainee) => {
      const trainerId = getUserId(trainer);
      const traineeId = getUserId(trainee);

      if (!trainerId || !traineeId) {
        return null;
      }

      const key = `${trainerId}:${traineeId}`;
      if (!relationshipMap[key]) {
        relationshipMap[key] = {
          id: key,
          trainer,
          trainee,
          membershipCount: 0,
          assignmentCount: 0,
          membershipStatuses: new Set(),
          assignmentStatuses: new Set(),
          sourceLabels: new Set(),
          latestMembershipAt: null,
          latestAssignmentAt: null,
        };
      }

      return relationshipMap[key];
    };

    members.forEach((membership) => {
      const relationship = ensureRelationship(membership.trainer, membership.trainee);
      if (!relationship) {
        return;
      }

      relationship.membershipCount += 1;
      relationship.sourceLabels.add('Membership');

      if (membership.status) {
        relationship.membershipStatuses.add(formatStatus(membership.status));
      }

      const membershipTimestamp = Math.max(
        toTimestamp(membership.startDate),
        toTimestamp(membership.createdAt),
        toTimestamp(membership.endDate),
      );

      if (!relationship.latestMembershipAt || membershipTimestamp > toTimestamp(relationship.latestMembershipAt)) {
        relationship.latestMembershipAt = membership.startDate || membership.createdAt || membership.endDate || null;
      }
    });

    assignments.forEach((assignment) => {
      (assignment.trainees ?? []).forEach((entry) => {
        const relationship = ensureRelationship(assignment.trainer, entry.trainee);
        if (!relationship) {
          return;
        }

        relationship.assignmentCount += 1;
        relationship.sourceLabels.add('Assignment');

        if (assignment.status) {
          relationship.assignmentStatuses.add(formatStatus(assignment.status));
        }
        if (entry.status) {
          relationship.assignmentStatuses.add(formatStatus(entry.status));
        }

        const assignmentTimestamp = Math.max(
          toTimestamp(entry.assignedAt),
          toTimestamp(assignment.approvedAt),
          toTimestamp(assignment.requestedAt),
        );

        if (!relationship.latestAssignmentAt || assignmentTimestamp > toTimestamp(relationship.latestAssignmentAt)) {
          relationship.latestAssignmentAt = entry.assignedAt || assignment.approvedAt || assignment.requestedAt || null;
        }
      });
    });

    return Object.values(relationshipMap)
      .map((relationship) => ({
        ...relationship,
        sourceLabels: Array.from(relationship.sourceLabels),
        membershipStatuses: Array.from(relationship.membershipStatuses),
        assignmentStatuses: Array.from(relationship.assignmentStatuses),
        latestLinkedAt: [relationship.latestMembershipAt, relationship.latestAssignmentAt]
          .filter(Boolean)
          .sort((left, right) => toTimestamp(right) - toTimestamp(left))[0] || null,
      }))
      .sort((left, right) => {
        const latestDifference = toTimestamp(right.latestLinkedAt) - toTimestamp(left.latestLinkedAt);
        if (latestDifference !== 0) {
          return latestDifference;
        }

        return `${left.trainer?.name || left.trainer?.email || ''}:${left.trainee?.name || left.trainee?.email || ''}`
          .localeCompare(`${right.trainer?.name || right.trainer?.email || ''}:${right.trainee?.name || right.trainee?.email || ''}`);
      });
  }, [assignments, members]);

  const relationshipOptions = useMemo(() => {
    const countLookup = {
      members: members.length,
      trainers: trainers.length,
      trainees: trainees.length,
      relationships: trainerTraineeRelationships.length,
    };

    const options = BASE_RELATIONSHIP_OPTIONS.map((option) => ({
      ...option,
      label: `${option.label} (${countLookup[option.value] ?? 0})`,
    }));

    if (assignments.length) {
      options.push({
        value: 'assignments',
        label: `Assignments (${assignments.length})`,
        searchLabel: 'assignments',
      });
    }

    return options;
  }, [assignments.length, members.length, trainerTraineeRelationships.length, trainees.length, trainers.length]);

  useEffect(() => {
    if (!relationshipOptions.some((option) => option.value === relationshipView)) {
      setRelationshipView(relationshipOptions[0]?.value ?? 'members');
      setRelationshipSearch('');
    }
  }, [relationshipOptions, relationshipView]);

  const mediaAssets = useMemo(() => {
    const combined = [];
    const seen = new Set();
    const pushAsset = (url, source) => {
      const value = String(url || '').trim();
      if (!value) return;
      const key = value.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      combined.push({ id: `${source}-${combined.length}`, url: value, source });
    };
    images.forEach((url) => pushAsset(url, 'Image'));
    gallery.forEach((url) => pushAsset(url, 'Gallery'));
    return combined;
  }, [gallery, images]);

  const relationshipSuggestions = useMemo(() => {
    if (relationshipView === 'members') {
      return buildSuggestions(members.flatMap((membership) => [membership.trainee?.name, membership.trainee?.email, membership.trainer?.name, membership.plan, membership.status]));
    }
    if (relationshipView === 'trainers') {
      return buildSuggestions(trainers.flatMap((trainer) => [trainer.name, trainer.email, trainer.role, trainer.status]));
    }
    if (relationshipView === 'trainees') {
      return buildSuggestions(trainees.flatMap((trainee) => [trainee.name, trainee.email, trainee.role, trainee.status]));
    }
    if (relationshipView === 'relationships') {
      return buildSuggestions(trainerTraineeRelationships.flatMap((relationship) => [
        relationship.trainer?.name,
        relationship.trainer?.email,
        relationship.trainee?.name,
        relationship.trainee?.email,
        ...relationship.sourceLabels,
        ...relationship.membershipStatuses,
        ...relationship.assignmentStatuses,
      ]));
    }
    return buildSuggestions(assignments.flatMap((assignment) => [assignment.trainer?.name, assignment.status, ...((assignment.trainees ?? []).flatMap((entry) => [entry.trainee?.name, entry.status]))]));
  }, [assignments, members, relationshipView, trainerTraineeRelationships, trainees, trainers]);

  const filteredMembers = useMemo(() => members.filter((membership) => matchesQuery(relationshipSearch, [membership.trainee?.name, membership.trainee?.email, membership.trainer?.name, membership.trainer?.email, membership.plan, membership.status])), [members, relationshipSearch]);
  const filteredTrainers = useMemo(() => trainers.filter((trainer) => matchesQuery(relationshipSearch, [trainer.name, trainer.email, trainer.role, trainer.status])), [relationshipSearch, trainers]);
  const filteredTrainees = useMemo(() => trainees.filter((trainee) => matchesQuery(relationshipSearch, [trainee.name, trainee.email, trainee.role, trainee.status])), [relationshipSearch, trainees]);
  const filteredTrainerTraineeRelationships = useMemo(() => trainerTraineeRelationships.filter((relationship) => matchesQuery(relationshipSearch, [
    relationship.trainer?.name,
    relationship.trainer?.email,
    relationship.trainee?.name,
    relationship.trainee?.email,
    ...relationship.sourceLabels,
    ...relationship.membershipStatuses,
    ...relationship.assignmentStatuses,
  ])), [relationshipSearch, trainerTraineeRelationships]);
  const filteredAssignments = useMemo(() => assignments.filter((assignment) => matchesQuery(relationshipSearch, [assignment.trainer?.name, assignment.trainer?.email, assignment.status, ...((assignment.trainees ?? []).flatMap((entry) => [entry.trainee?.name, entry.trainee?.email, entry.status]))])), [assignments, relationshipSearch]);

  const metricCards = [
    { label: 'Members', value: formatNumber(gym?.metrics?.activeMembers ?? members.length) },
    { label: 'Paid subscriptions', value: formatNumber(gym?.metrics?.paidMemberships ?? membershipInsights?.paidCount ?? 0) },
    { label: 'Trainers', value: formatNumber(gym?.metrics?.activeTrainers ?? trainers.length) },
    { label: 'Assignments', value: formatNumber(gym?.metrics?.activeAssignments ?? assignments.length) },
    { label: 'Tracked value', value: formatCurrency({ amount: revenue?.totals?.trackedValue ?? 0, currency: gym?.pricing?.currency }) },
    { label: 'Platform monetisation', value: formatCurrency({ amount: revenue?.totals?.platformMonetisation ?? 0, currency: gym?.pricing?.currency }) },
    { label: 'Impressions', value: formatNumber(gym?.analytics?.impressions ?? 0) },
    { label: 'Rating', value: formatRatingValue(gym?.analytics?.rating) },
    { label: 'Media assets', value: formatNumber(gym?.metrics?.mediaAssets ?? mediaAssets.length) },
  ];
  const heroHighlights = [
    {
      label: 'Owner',
      value: gym?.owner ? renderUserLink(gym.owner) : EMPTY_VALUE,
      meta: displayValue(gym?.owner?.email),
    },
    {
      label: 'Default plan',
      value: formatMembershipPlanSummary(defaultMembershipPlan, gym?.pricing?.currency),
      meta: `${formatNumber(membershipInsights?.configuredPlanCount ?? configuredMembershipPlans.length)} configured plans`,
    },
    {
      label: 'Tracked value',
      value: formatCurrency({ amount: revenue?.totals?.trackedValue ?? 0, currency: gym?.pricing?.currency }),
      meta: `${formatNumber(revenueEvents.length)} revenue events recorded`,
    },
    {
      label: 'Last updated',
      value: formatDateTime(gym?.updatedAt),
      meta: gym?.approvedAt ? `Approved ${formatDate(gym.approvedAt)}` : 'Approval date not recorded',
    },
  ];
  const relationshipSummaryCards = [
    {
      label: 'Memberships',
      value: formatNumber(members.length),
      meta: `${formatNumber(membershipInsights?.paidCount ?? 0)} paid subscriptions`,
    },
    {
      label: 'Trainers',
      value: formatNumber(trainers.length),
      meta: `${formatNumber(assignedTrainers.length)} assigned`,
    },
    {
      label: 'Trainees',
      value: formatNumber(trainees.length),
      meta: `${formatNumber(assignedTrainees.length)} assigned`,
    },
    {
      label: 'Relationships',
      value: formatNumber(trainerTraineeRelationships.length),
      meta: assignments.length ? `${formatNumber(assignments.length)} assignment records` : 'No assignment records',
    },
  ];
  const membershipStatusValues = useMemo(
    () => Object.entries(membershipInsights?.statusBreakdown ?? {}).map(([status, count]) => `${formatStatus(status)}: ${formatNumber(count)}`),
    [membershipInsights],
  );
  const configuredPlanValues = useMemo(
    () => configuredMembershipPlans.map((plan) => formatConfiguredPlanValue(plan, gym?.pricing?.currency)),
    [configuredMembershipPlans, gym?.pricing?.currency],
  );
  const recentRevenueEvents = useMemo(() => revenueEvents.slice(0, 12), [revenueEvents]);
  const hasRevenueTrend = useMemo(
    () => revenueTrend.some((entry) => hasPositiveAmount(entry?.total)),
    [revenueTrend],
  );

  const handleRemoveGym = async () => {
    if (!gym) return;
    setNotice(null);
    setErrorNotice(null);
    const confirmed = window.confirm(`Remove ${gym.name ?? 'this gym'}? This will cancel memberships and listings.`);
    if (!confirmed) return;
    try {
      await deleteGymRecord(getGymId(gym)).unwrap();
      setNotice('Gym removed successfully.');
      navigate('/dashboard/admin/gyms');
    } catch (err) {
      setErrorNotice(err?.data?.message ?? 'Unable to remove this gym.');
    }
  };

  if (isLoading) {
    return (
      <div className="dashboard-grid dashboard-grid--stacked admin-gym-details">
        <DashboardSection title="Gym details" className="admin-gym-details__section admin-gym-details__section--loading">
          <SkeletonPanel lines={12} />
        </DashboardSection>
      </div>
    );
  }

  if (isError || !gym) {
    return (
      <div className="dashboard-grid dashboard-grid--stacked admin-gym-details">
        <DashboardSection
          title="Gym details"
          className="admin-gym-details__section admin-gym-details__section--error"
          action={(
            <div className="admin-gym-details__header-actions">
              <button type="button" className="admin-gym-details__action-button admin-gym-details__action-button--secondary" onClick={() => navigate('/dashboard/admin/gyms')}>Back to gyms</button>
              <button type="button" className="admin-gym-details__action-button" onClick={() => refetch()}>Retry</button>
            </div>
          )}
        >
          <EmptyState message={isError ? 'Could not load this gym right now.' : 'Gym was not found.'} />
        </DashboardSection>
      </div>
    );
  }

  return (
    <div className="dashboard-grid dashboard-grid--stacked admin-gym-details">
      <DashboardSection
        title="Gym details"
        className="admin-gym-details__section admin-gym-details__overview-section"
        action={(
          <div className="admin-gym-details__header-actions">
            {generatedAt ? <span className="admin-gym-details__timestamp">Live snapshot: {formatDateTime(generatedAt)}</span> : null}
            <button type="button" className="admin-gym-details__action-button admin-gym-details__action-button--secondary" onClick={() => navigate('/dashboard/admin/gyms')}>Back to gyms</button>
            <button type="button" className="admin-gym-details__action-button admin-gym-details__action-button--danger" onClick={handleRemoveGym} disabled={isDeletingGym}>{isDeletingGym ? 'Removing...' : 'Remove gym'}</button>
          </div>
        )}
      >
        {(notice || errorNotice) ? <div className={`status-pill admin-gym-details__notice ${errorNotice ? 'status-pill--warning' : 'status-pill--success'}`}>{errorNotice || notice}</div> : null}

        <div className="admin-gym-details__hero">
          <div className="admin-gym-details__hero-main">
            <div className="dashboard-table__user-placeholder admin-gym-details__avatar">{gym.name?.charAt(0) ?? 'G'}</div>
            <div className="admin-gym-details__hero-copy">
              <div className="admin-gym-details__eyebrow">Admin gym intelligence</div>
              <h3 className="admin-gym-details__title">{gym.name ?? 'Unnamed gym'}</h3>
              <p className="admin-gym-details__location">{formatLocation(gym.location?.city, gym.location?.state, gym.location?.postalCode)}</p>
              <p className="admin-gym-details__description">{displayValue(gym.description || 'No gym description has been added yet.')}</p>
              <div className="admin-gym-details__status-row">
                <StatusChip value={gym.status} />
                <StatusChip value={gym.approvalStatus} />
                <StatusChip value={gym.isPublished ? 'published' : 'unpublished'} />
                <StatusChip value={gym.isActive ? 'active' : 'inactive'} />
                {gym.listingSubscription?.status ? <StatusChip value={gym.listingSubscription.status} /> : null}
                {gym.sponsorship?.status && gym.sponsorship.status !== 'none' ? <StatusChip value={gym.sponsorship.status} /> : null}
              </div>
            </div>
          </div>

          <div className="admin-gym-details__hero-aside">
            {heroHighlights.map((item) => (
              <InfoTile key={item.label} label={item.label} value={item.value} meta={item.meta} />
            ))}
          </div>
        </div>

        <div className="stat-grid admin-gym-details__metric-grid">
          {metricCards.map((metric) => (
            <div key={metric.label} className="stat-card">
              <small>{metric.label}</small>
              <strong>{metric.value}</strong>
            </div>
          ))}
        </div>

        <div className="details-grid admin-gym-details__details-grid">
          <DetailCard title="Gym lifecycle" rows={[
            { label: 'Gym ID', value: <span className="admin-gym-details__mono-value">{getGymId(gym)}</span> },
            { label: 'Status', value: <StatusChip value={gym.status} /> },
            { label: 'Approval', value: <StatusChip value={gym.approvalStatus} /> },
            { label: 'Published', value: gym.isPublished ? 'Yes' : 'No' },
            { label: 'Account active', value: gym.isActive ? 'Yes' : 'No' },
            { label: 'Created', value: formatDateTime(gym.createdAt) },
            { label: 'Updated', value: formatDateTime(gym.updatedAt) },
            { label: 'Approved on', value: gym.approvedAt ? formatDateTime(gym.approvedAt) : EMPTY_VALUE },
            { label: 'Last updated by', value: gym.lastUpdatedBy ? renderUserLink(gym.lastUpdatedBy) : EMPTY_VALUE },
          ]} />

          <DetailCard title="Ownership & team" rows={[
            { label: 'Owner', value: gym.owner ? renderUserLink(gym.owner) : EMPTY_VALUE },
            { label: 'Owner email', value: displayValue(gym.owner?.email) },
            { label: 'Owner phone', value: displayValue(gym.owner?.contactNumber) },
            { label: 'Owner status', value: gym.owner?.status ? <StatusChip value={gym.owner.status} /> : EMPTY_VALUE },
            { label: 'Owner role', value: gym.owner?.role ? formatStatus(gym.owner.role) : EMPTY_VALUE },
            { label: 'Linked trainers', value: formatNumber(gym.metrics?.activeTrainers ?? trainers.length) },
            { label: 'Assigned trainers', value: formatNumber(gym.metrics?.assignedTrainers ?? assignedTrainers.length) },
            { label: 'Assigned trainees', value: formatNumber(gym.metrics?.activeTrainees ?? assignedTrainees.length) },
          ]}>
            <div className="admin-gym-details__attribute-stack">
              <AttributeGroup label="Owner profile" values={[gym.owner?.profile?.company && `Company: ${gym.owner.profile.company}`, gym.owner?.profile?.headline && `Headline: ${gym.owner.profile.headline}`, gym.owner?.profile?.location && `Location: ${gym.owner.profile.location}`].filter(Boolean)} />
            </div>
          </DetailCard>

          <DetailCard title="Location & contact" rows={[
            { label: 'Address', value: displayValue(gym.location?.address) },
            { label: 'City', value: displayValue(gym.location?.city) },
            { label: 'State', value: displayValue(gym.location?.state) },
            { label: 'Postal code', value: displayValue(gym.location?.postalCode) },
            { label: 'Coordinates', value: formatCoordinates(gym.location?.coordinates) },
            { label: 'Phone', value: displayValue(gym.contact?.phone) },
            { label: 'Email', value: displayValue(gym.contact?.email) },
            { label: 'WhatsApp', value: displayValue(gym.contact?.whatsapp) },
            { label: 'Website', value: renderExternalLinkValue(gym.contact?.website) },
          ]} />

          <DetailCard title="Pricing, listing & sponsorship" rows={[
            { label: 'Configured plans', value: formatNumber(membershipInsights?.configuredPlanCount ?? configuredMembershipPlans.length) },
            { label: 'Default plan', value: formatMembershipPlanSummary(defaultMembershipPlan, gym.pricing?.currency) },
            { label: 'Starting plan', value: formatMembershipPlanSummary(startingMembershipPlan, gym.pricing?.currency) },
            { label: 'Listing plan', value: gym.listingSubscription?.planCode ? formatStatus(gym.listingSubscription.planCode) : EMPTY_VALUE },
            { label: 'Listing status', value: gym.listingSubscription?.status ? <StatusChip value={gym.listingSubscription.status} /> : EMPTY_VALUE },
            { label: 'Listing period', value: gym.listingSubscription ? formatPeriodRange(gym.listingSubscription.periodStart, gym.listingSubscription.periodEnd) : EMPTY_VALUE },
            { label: 'Auto renew', value: gym.listingSubscription ? (gym.listingSubscription.autoRenew ? 'Enabled' : 'Disabled') : EMPTY_VALUE },
            { label: 'Listing invoices', value: gym.listingSubscription ? formatNumber(gym.listingSubscription.invoiceCount ?? 0) : EMPTY_VALUE },
            { label: 'Sponsorship', value: gym.sponsorship?.status ? <StatusChip value={gym.sponsorship.status} /> : EMPTY_VALUE },
            { label: 'Sponsor package', value: gym.sponsorship?.package ? formatStatus(gym.sponsorship.package) : EMPTY_VALUE },
            { label: 'Sponsor amount', value: Number(gym.sponsorship?.amount) > 0 ? formatCurrency({ amount: gym.sponsorship.amount, currency: gym.pricing?.currency }) : EMPTY_VALUE },
            { label: 'Sponsor expiry', value: gym.sponsorship?.expiresAt ? formatDateTime(gym.sponsorship.expiresAt) : EMPTY_VALUE },
          ]}>
            <div className="admin-gym-details__attribute-stack">
              <AttributeGroup label="Membership plans" values={configuredPlanValues} />
            </div>
          </DetailCard>

          <DetailCard title="Operations & reach" rows={[
            { label: 'Open hours', value: gym.schedule?.openTime || gym.schedule?.closeTime ? `${displayValue(gym.schedule?.openTime)} - ${displayValue(gym.schedule?.closeTime)}` : EMPTY_VALUE },
            { label: 'Working days', value: joinValues(gym.schedule?.workingDays) },
            { label: 'Active members', value: formatNumber(gym.metrics?.activeMembers ?? members.length) },
            { label: 'Trainees', value: formatNumber(gym.metrics?.totalTrainees ?? trainees.length) },
            { label: 'Assignments', value: formatNumber(gym.metrics?.activeAssignments ?? assignments.length) },
            { label: 'Lifetime impressions', value: formatNumber(gym.analytics?.impressions ?? 0) },
            { label: '30-day impressions', value: formatNumber(gym.analytics?.impressions30d ?? 0) },
            { label: 'Average rating', value: formatRatingValue(gym.analytics?.rating) },
            { label: 'Review count', value: formatNumber(gym.metrics?.reviewCount ?? gym.analytics?.ratingCount ?? 0) },
            { label: 'Last impression', value: gym.analytics?.lastImpressionAt ? formatDateTime(gym.analytics.lastImpressionAt) : EMPTY_VALUE },
            { label: 'Last review', value: gym.analytics?.lastReviewAt ? formatDateTime(gym.analytics.lastReviewAt) : EMPTY_VALUE },
          ]} />

          <DetailCard title="Discovery profile" className="admin-gym-details__detail-card--wide">
            <div className="admin-gym-details__discovery-copy">{gym.description || 'No discovery description is available for this gym.'}</div>
            <div className="admin-gym-details__attribute-stack">
              <AttributeGroup label="Features" values={features} />
              <AttributeGroup label="Key features" values={keyFeatures} />
              <AttributeGroup label="Amenities" values={amenities} />
              <AttributeGroup label="Search tags" values={tags} />
            </div>
          </DetailCard>
        </div>
      </DashboardSection>

      <DashboardSection
        title="Revenue & subscriptions"
        className="admin-gym-details__section admin-gym-details__revenue-section"
        action={<span className="admin-gym-details__timestamp">Auto refreshes every 30 seconds</span>}
      >
        <p className="admin-gym-details__section-note">
          Member subscription billing, listing plans, and sponsorship purchases currently linked to this gym.
        </p>

        <div className="stat-grid admin-gym-details__metric-grid admin-gym-details__metric-grid--compact">
          {[
            { label: 'Total tracked value', value: formatCurrency({ amount: revenue?.totals?.trackedValue ?? 0, currency: gym?.pricing?.currency }) },
            { label: 'Member subscriptions', value: formatCurrency({ amount: revenue?.totals?.membershipSubscriptions ?? 0, currency: gym?.pricing?.currency }) },
            { label: 'Listing plans', value: formatCurrency({ amount: revenue?.totals?.listingSubscriptions ?? 0, currency: gym?.pricing?.currency }) },
            { label: 'Sponsorships', value: formatCurrency({ amount: revenue?.totals?.sponsorships ?? 0, currency: gym?.pricing?.currency }) },
            { label: 'Gym share', value: formatCurrency({ amount: revenue?.totals?.gymShare ?? 0, currency: gym?.pricing?.currency }) },
            { label: 'Trainer share', value: formatCurrency({ amount: revenue?.totals?.trainerShare ?? 0, currency: gym?.pricing?.currency }) },
          ].map((metric) => (
            <div key={metric.label} className="stat-card">
              <small>{metric.label}</small>
              <strong>{metric.value}</strong>
            </div>
          ))}
        </div>

        <div className="details-grid admin-gym-details__details-grid admin-gym-details__details-grid--tight">
          <DetailCard title="Member subscriptions" className="admin-gym-details__detail-card--wide" rows={[
            { label: 'Configured plans', value: formatNumber(membershipInsights?.configuredPlanCount ?? configuredMembershipPlans.length) },
            { label: 'Default billing plan', value: formatMembershipPlanSummary(defaultMembershipPlan, membershipInsights?.currency || gym?.pricing?.currency) },
            { label: 'Starting plan', value: formatMembershipPlanSummary(startingMembershipPlan, membershipInsights?.currency || gym?.pricing?.currency) },
            { label: 'Active members', value: formatNumber(membershipInsights?.activeCount ?? 0) },
            { label: 'Paid subscriptions', value: formatNumber(membershipInsights?.paidCount ?? 0) },
            { label: 'Lifetime billing', value: formatCurrency({ amount: membershipInsights?.totalCollected ?? 0, currency: membershipInsights?.currency || gym?.pricing?.currency }) },
            { label: 'Last 30 days', value: formatCurrency({ amount: membershipInsights?.collectedLast30Days ?? 0, currency: membershipInsights?.currency || gym?.pricing?.currency }) },
            { label: 'Avg ticket size', value: formatCurrency({ amount: membershipInsights?.averageTicketSize ?? 0, currency: membershipInsights?.currency || gym?.pricing?.currency }) },
            { label: 'Latest purchase', value: membershipInsights?.latestPurchasedAt ? formatDateTime(membershipInsights.latestPurchasedAt) : EMPTY_VALUE },
          ]}>
            <div className="admin-gym-details__attribute-stack">
              <AttributeGroup label="Configured plans" values={configuredPlanValues} />
              <AttributeGroup label="Status mix" values={membershipStatusValues} />
            </div>
          </DetailCard>

          <DetailCard title="Listing monetisation" rows={[
            { label: 'Active plans', value: formatNumber(listingInsights?.activeCount ?? 0) },
            { label: 'Total plans bought', value: formatNumber(listingInsights?.totalCount ?? 0) },
            { label: 'Lifetime listing fees', value: formatCurrency({ amount: listingInsights?.totalCollected ?? 0, currency: gym?.pricing?.currency }) },
            { label: 'Last 30 days', value: formatCurrency({ amount: listingInsights?.collectedLast30Days ?? 0, currency: gym?.pricing?.currency }) },
            { label: 'Invoices billed', value: formatNumber(listingInsights?.invoiceCount ?? 0) },
            { label: 'Auto renew enabled', value: formatNumber(listingInsights?.autoRenewEnabled ?? 0) },
            { label: 'Latest plan', value: listingInsights?.latestPlanCode ? formatStatus(listingInsights.latestPlanCode) : EMPTY_VALUE },
            { label: 'Current period end', value: listingInsights?.latestPeriodEnd ? formatDateTime(listingInsights.latestPeriodEnd) : EMPTY_VALUE },
          ]} />

          <DetailCard title="Sponsorship monetisation" rows={[
            { label: 'Current status', value: sponsorshipInsights?.status ? <StatusChip value={sponsorshipInsights.status} /> : EMPTY_VALUE },
            { label: 'Active package', value: sponsorshipInsights?.package ? formatStatus(sponsorshipInsights.package) : EMPTY_VALUE },
            { label: 'Lifetime sponsor spend', value: formatCurrency({ amount: sponsorshipInsights?.totalCollected ?? 0, currency: gym?.pricing?.currency }) },
            { label: 'Last 30 days', value: formatCurrency({ amount: sponsorshipInsights?.collectedLast30Days ?? 0, currency: gym?.pricing?.currency }) },
            { label: 'Purchases', value: formatNumber(sponsorshipInsights?.purchases ?? 0) },
            { label: 'Current sponsor amount', value: hasPositiveAmount(sponsorshipInsights?.amount) ? formatCurrency({ amount: sponsorshipInsights.amount, currency: gym?.pricing?.currency }) : EMPTY_VALUE },
            { label: 'Latest purchase', value: sponsorshipInsights?.latestPurchasedAt ? formatDateTime(sponsorshipInsights.latestPurchasedAt) : EMPTY_VALUE },
            { label: 'Current expiry', value: sponsorshipInsights?.expiresAt ? formatDateTime(sponsorshipInsights.expiresAt) : EMPTY_VALUE },
          ]} />
        </div>

        {hasRevenueTrend ? (
          <div className="admin-gym-details__chart-shell">
            <GrowthLineChart
              role="admin"
              data={revenueTrend}
              series={[
                { dataKey: 'membership', stroke: '#f97316', label: 'Member subscriptions' },
                { dataKey: 'listing', stroke: '#22c55e', label: 'Listing plans' },
                { dataKey: 'sponsorship', stroke: '#38bdf8', label: 'Sponsorships' },
              ]}
            />
          </div>
        ) : (
          <EmptyState message="Revenue history will appear after paid subscriptions, listing plans, or sponsorships are recorded." />
        )}
      </DashboardSection>

      <DashboardSection title="Monetisation history" className="admin-gym-details__section admin-gym-details__history-section">
        {!membershipOfferings.length && !listingSubscriptions.length && !sponsorshipHistory.length && !recentRevenueEvents.length ? (
          <EmptyState message="No monetisation history is recorded for this gym yet." />
        ) : (
          <>
            {membershipOfferings.length ? (
              <div className="admin-gym-details__table-block">
                <SectionHeading title="Observed membership plans" subtitle="Subscription plans sold to members at this gym." />
                <TableShell>
                  <table className="dashboard-table">
                    <thead>
                      <tr>
                        <th>Plan</th>
                        <th>Configured offer</th>
                        <th>Active members</th>
                        <th>Paid subscriptions</th>
                        <th>Avg price</th>
                        <th>Lifetime billing</th>
                        <th>Latest purchase</th>
                      </tr>
                    </thead>
                    <tbody>
                      {membershipOfferings.map((offering) => (
                        <tr key={offering.id}>
                          <td>{[offering.label || formatStatus(offering.planCode), Number(offering.durationMonths) > 0 ? `${offering.durationMonths} mo` : null].filter(Boolean).join(' / ') || EMPTY_VALUE}</td>
                          <td>{formatConfiguredPlanValue(offering, offering.currency || gym?.pricing?.currency)}</td>
                          <td>{formatNumber(offering.activeCount ?? 0)}</td>
                          <td>{formatNumber(offering.paidCount ?? 0)}</td>
                          <td>{formatCurrency({ amount: offering.averageTicketSize ?? 0, currency: offering.currency || gym?.pricing?.currency })}</td>
                          <td>{formatCurrency({ amount: offering.totalCollected ?? 0, currency: offering.currency || gym?.pricing?.currency })}</td>
                          <td>{offering.latestPurchasedAt ? formatDateTime(offering.latestPurchasedAt) : EMPTY_VALUE}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableShell>
              </div>
            ) : null}

            {listingSubscriptions.length ? (
              <div className="admin-gym-details__table-block">
                <SectionHeading title="Listing subscriptions" subtitle="All listing plans purchased for this gym." />
                <TableShell>
                  <table className="dashboard-table">
                    <thead>
                      <tr>
                        <th>Plan</th>
                        <th>Period</th>
                        <th>Status</th>
                        <th>Invoices</th>
                        <th>Collected</th>
                        <th>Auto renew</th>
                      </tr>
                    </thead>
                    <tbody>
                      {listingSubscriptions.map((subscription) => (
                        <tr key={subscription.id}>
                          <td>{formatStatus(subscription.planCode)}</td>
                          <td>{formatPeriodRange(subscription.periodStart, subscription.periodEnd)}</td>
                          <td><StatusChip value={subscription.status} /></td>
                          <td>{formatNumber(subscription.invoiceCount ?? 0)}</td>
                          <td>{formatCurrency({ amount: subscription.collectedTotal ?? subscription.amount ?? 0, currency: subscription.currency || gym?.pricing?.currency })}</td>
                          <td>{subscription.autoRenew ? 'Enabled' : 'Disabled'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableShell>
              </div>
            ) : null}

            {sponsorshipHistory.length ? (
              <div className="admin-gym-details__table-block">
                <SectionHeading title="Sponsorship purchases" subtitle="Recorded sponsorship spend for this gym." />
                <TableShell>
                  <table className="dashboard-table">
                    <thead>
                      <tr>
                        <th>Purchased</th>
                        <th>Tier</th>
                        <th>Amount</th>
                        <th>Payment ref</th>
                        <th>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sponsorshipHistory.map((item) => (
                        <tr key={item.id}>
                          <td>{item.createdAt ? formatDateTime(item.createdAt) : EMPTY_VALUE}</td>
                          <td>{item.tier ? formatStatus(item.tier) : EMPTY_VALUE}</td>
                          <td>{formatCurrency({ amount: item.amount ?? 0, currency: gym?.pricing?.currency })}</td>
                          <td>{displayValue(item.paymentReference)}</td>
                          <td>{displayValue(item.description)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableShell>
              </div>
            ) : null}

            {recentRevenueEvents.length ? (
              <div className="admin-gym-details__table-block">
                <SectionHeading title="Revenue ledger" subtitle="Most recent monetisation events tied to this gym." />
                <TableShell>
                  <table className="dashboard-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Type</th>
                        <th>Amount</th>
                        <th>Meta</th>
                        <th>Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentRevenueEvents.map((event) => (
                        <tr key={event.id}>
                          <td>{event.createdAt ? formatDateTime(event.createdAt) : EMPTY_VALUE}</td>
                          <td>{formatStatus(event.type)}</td>
                          <td>{formatCurrency({ amount: event.amount ?? 0, currency: gym?.pricing?.currency })}</td>
                          <td>{displayValue(event.share || event.planCode || event.tier || event.paymentReference)}</td>
                          <td>{displayValue(event.description)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableShell>
              </div>
            ) : null}
          </>
        )}
      </DashboardSection>

      <DashboardSection title="Media & assets" className="admin-gym-details__section admin-gym-details__media-section">
        <div className="details-grid admin-gym-details__details-grid admin-gym-details__details-grid--tight">
          <DetailCard title="Asset inventory" rows={[
            { label: 'Primary images', value: formatNumber(gym.metrics?.imageAssets ?? images.length) },
            { label: 'Gallery items', value: formatNumber(gym.metrics?.galleryAssets ?? gallery.length) },
            { label: 'Total media', value: formatNumber(gym.metrics?.mediaAssets ?? mediaAssets.length) },
          ]} />
          <DetailCard title="Asset notes" rows={[
            { label: 'Owner linked', value: gym.owner ? renderUserLink(gym.owner) : EMPTY_VALUE },
            { label: 'Public listing', value: gym.isPublished ? 'Visible' : 'Hidden' },
            { label: 'Approval state', value: <StatusChip value={gym.approvalStatus} /> },
          ]} />
        </div>

        {mediaAssets.length ? (
          <div className="admin-gym-details__media-grid">
            {mediaAssets.map((asset, index) => (
              <a key={asset.id} href={asset.url} target="_blank" rel="noreferrer" className="admin-gym-details__media-card">
                <img src={asset.url} alt={`${gym.name || 'Gym'} asset ${index + 1}`} />
                <div className="admin-gym-details__media-card-body">
                  <strong className="admin-gym-details__media-card-title">{asset.source} asset {index + 1}</strong>
                  <small className="admin-gym-details__media-card-url">{asset.url}</small>
                </div>
              </a>
            ))}
          </div>
        ) : <EmptyState message="No media assets are stored for this gym." />}
      </DashboardSection>

      <DashboardSection title="Relationship explorer" className="admin-gym-details__section admin-gym-details__explorer-section">
        <div className="admin-gym-details__explorer-header">
          <div className="admin-gym-details__explorer-copy">
            <p className="admin-gym-details__section-note">
              Memberships, trainers, trainees, trainer-trainee relationships, and trainer assignments linked to this gym.
            </p>
          </div>
          <div className="admin-gym-details__explorer-summary">
            {relationshipSummaryCards.map((item) => (
              <InfoTile key={item.label} label={item.label} value={item.value} meta={item.meta} />
            ))}
          </div>
        </div>

        <ExplorerToolbar
          activeValue={relationshipView}
          onChange={(value) => {
            setRelationshipView(value);
            setRelationshipSearch('');
          }}
          options={relationshipOptions}
          searchValue={relationshipSearch}
          onSearchChange={setRelationshipSearch}
          suggestions={relationshipSuggestions}
          searchPlaceholder={`Search ${relationshipOptions.find((option) => option.value === relationshipView)?.searchLabel || 'records'}`}
        />

        {relationshipView === 'members' && (
          filteredMembers.length ? (
            <TableShell>
              <table className="dashboard-table">
                <thead><tr><th>Member</th><th>Assigned trainer</th><th>Plan</th><th>Billing</th><th>Status</th><th>Membership window</th></tr></thead>
                <tbody>
                  {filteredMembers.map((membership) => (
                    <tr key={membership.id}>
                      <td>{membership.trainee ? renderUserLink(membership.trainee) : EMPTY_VALUE}</td>
                      <td>{membership.trainer ? renderUserLink(membership.trainer) : EMPTY_VALUE}</td>
                      <td>{formatStatus(membership.plan || 'monthly')}</td>
                      <td>{formatBillingSummary(membership.billingAmount, membership.billingCurrency, membership.billingStatus)}</td>
                      <td><StatusChip value={membership.status} /></td>
                      <td>{formatPeriodRange(membership.startDate, membership.endDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableShell>
          ) : <EmptyState message={relationshipSearch ? 'No memberships match this search.' : 'No memberships are linked to this gym.'} />
        )}

        {relationshipView === 'trainers' && (
          filteredTrainers.length ? (
            <TableShell>
              <table className="dashboard-table">
                <thead><tr><th>Trainer</th><th>Email</th><th>Status</th><th>Memberships</th><th>Assignments</th></tr></thead>
                <tbody>
                  {filteredTrainers.map((trainer) => {
                    const id = getUserId(trainer);
                    return (
                      <tr key={id || trainer.email}>
                        <td>{renderUserLink(trainer)}</td>
                        <td>{displayValue(trainer.email)}</td>
                        <td><StatusChip value={trainer.status} /></td>
                        <td>{formatNumber(trainerMembershipCount[id] || 0)}</td>
                        <td>{formatNumber(trainerAssignmentCount[id] || 0)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableShell>
          ) : <EmptyState message={relationshipSearch ? 'No trainers match this search.' : 'No trainers are linked to this gym.'} />
        )}

        {relationshipView === 'trainees' && (
          filteredTrainees.length ? (
            <TableShell>
              <table className="dashboard-table">
                <thead><tr><th>Trainee</th><th>Email</th><th>Status</th><th>Memberships</th><th>Assignments</th></tr></thead>
                <tbody>
                  {filteredTrainees.map((trainee) => {
                    const id = getUserId(trainee);
                    return (
                      <tr key={id || trainee.email}>
                        <td>{renderUserLink(trainee)}</td>
                        <td>{displayValue(trainee.email)}</td>
                        <td><StatusChip value={trainee.status} /></td>
                        <td>{formatNumber(traineeMembershipCount[id] || 0)}</td>
                        <td>{formatNumber(traineeAssignmentCount[id] || 0)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableShell>
          ) : <EmptyState message={relationshipSearch ? 'No trainees match this search.' : 'No trainees are enrolled in this gym.'} />
        )}

        {relationshipView === 'relationships' && (
          filteredTrainerTraineeRelationships.length ? (
            <TableShell>
              <table className="dashboard-table">
                <thead><tr><th>Trainer</th><th>Trainee</th><th>Sources</th><th>Memberships</th><th>Assignments</th><th>Latest linked</th></tr></thead>
                <tbody>
                  {filteredTrainerTraineeRelationships.map((relationship) => (
                    <tr key={relationship.id}>
                      <td>{relationship.trainer ? renderUserLink(relationship.trainer) : EMPTY_VALUE}</td>
                      <td>{relationship.trainee ? renderUserLink(relationship.trainee) : EMPTY_VALUE}</td>
                      <td>{joinValues(relationship.sourceLabels)}</td>
                      <td>{relationship.membershipCount ? `${formatNumber(relationship.membershipCount)}${relationship.membershipStatuses.length ? ` (${joinValues(relationship.membershipStatuses)})` : ''}` : EMPTY_VALUE}</td>
                      <td>{relationship.assignmentCount ? `${formatNumber(relationship.assignmentCount)}${relationship.assignmentStatuses.length ? ` (${joinValues(relationship.assignmentStatuses)})` : ''}` : EMPTY_VALUE}</td>
                      <td>{relationship.latestLinkedAt ? formatDateTime(relationship.latestLinkedAt) : EMPTY_VALUE}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableShell>
          ) : <EmptyState message={relationshipSearch ? 'No trainer-trainee relationships match this search.' : 'No trainer-trainee relationships are recorded for this gym.'} />
        )}

        {relationshipView === 'assignments' && (
          filteredAssignments.length ? (
            <TableShell>
              <table className="dashboard-table">
                <thead><tr><th>Trainer</th><th>Trainees</th><th>Status</th><th>Approved</th><th>Requested</th></tr></thead>
                <tbody>
                  {filteredAssignments.map((assignment) => (
                    <tr key={assignment.id}>
                      <td>{assignment.trainer ? renderUserLink(assignment.trainer) : EMPTY_VALUE}</td>
                      <td>{(assignment.trainees ?? []).length ? assignment.trainees.map((entry) => `${entry.trainee?.name || 'Unknown'} (${formatStatus(entry.status)})`).join(', ') : EMPTY_VALUE}</td>
                      <td><StatusChip value={assignment.status} /></td>
                      <td>{assignment.approvedAt ? formatDateTime(assignment.approvedAt) : EMPTY_VALUE}</td>
                      <td>{assignment.requestedAt ? formatDateTime(assignment.requestedAt) : EMPTY_VALUE}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableShell>
          ) : <EmptyState message={relationshipSearch ? 'No assignments match this search.' : 'No trainer assignments exist for this gym.'} />
        )}

      </DashboardSection>
    </div>
  );
};

export default AdminGymDetailsPage;
