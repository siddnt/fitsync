import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import DashboardSection from '../components/DashboardSection.jsx';
import EmptyState from '../components/EmptyState.jsx';
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

const EMPTY_VALUE = '-';

const getGymId = (gym) => String(gym?.id ?? gym?._id ?? '');
const getUserId = (user) => String(user?.id ?? user?._id ?? '');

const BASE_RELATIONSHIP_OPTIONS = [
  { value: 'members', label: 'Memberships', searchLabel: 'memberships' },
  { value: 'trainers', label: 'Linked trainers', searchLabel: 'trainers' },
  { value: 'trainees', label: 'Enrolled trainees', searchLabel: 'trainees' },
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

const DetailCard = ({ title, rows = [], children }) => (
  <div className="detail-card">
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
    <div>
      <small style={{ display: 'block', color: 'var(--muted-text-color)', fontSize: '0.75rem', letterSpacing: '0.06em', marginBottom: '0.55rem', textTransform: 'uppercase' }}>{label}</small>
      {items.length ? (
        <div className="pill-row" style={{ marginBottom: 0 }}>
          {items.map((item) => <span key={`${label}-${item}`} className="pill">{item}</span>)}
        </div>
      ) : (
        <div style={{ color: 'var(--muted-text-color)', fontSize: '0.92rem' }}>{EMPTY_VALUE}</div>
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
  <div style={{ display: 'flex', gap: '0.9rem', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1rem' }}>
    <div className="filter-group" style={{ flexWrap: 'wrap' }}>
      {options.map((option) => (
        <button key={option.value} type="button" className={`filter-btn ${activeValue === option.value ? 'active' : ''}`} onClick={() => onChange(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
    <div style={{ minWidth: '260px', flex: '1 1 320px', maxWidth: '420px' }}>
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

const AdminGymDetailsPage = () => {
  const navigate = useNavigate();
  const { gymId } = useParams();
  const { data, isLoading, isError, refetch } = useGetAdminGymDetailsQuery(gymId, { skip: !gymId });
  const [deleteGymRecord, { isLoading: isDeletingGym }] = useDeleteGymMutation();
  const [relationshipView, setRelationshipView] = useState('members');
  const [relationshipSearch, setRelationshipSearch] = useState('');
  const [notice, setNotice] = useState(null);
  const [errorNotice, setErrorNotice] = useState(null);

  const gym = data?.data?.gym ?? null;
  const members = Array.isArray(gym?.members) ? gym.members : [];
  const trainers = Array.isArray(gym?.trainers) ? gym.trainers : [];
  const assignedTrainers = Array.isArray(gym?.assignedTrainers) ? gym.assignedTrainers : [];
  const trainees = Array.isArray(gym?.trainees) ? gym.trainees : [];
  const assignedTrainees = Array.isArray(gym?.assignedTrainees) ? gym.assignedTrainees : [];
  const assignments = Array.isArray(gym?.assignments) ? gym.assignments : [];
  const features = Array.isArray(gym?.features) ? gym.features : [];
  const amenities = Array.isArray(gym?.amenities) ? gym.amenities : [];
  const keyFeatures = Array.isArray(gym?.keyFeatures) ? gym.keyFeatures : [];
  const tags = Array.isArray(gym?.tags) ? gym.tags : [];
  const images = Array.isArray(gym?.images) ? gym.images : [];
  const gallery = Array.isArray(gym?.gallery) ? gym.gallery : [];

  const relationshipOptions = useMemo(() => {
    const countLookup = {
      members: members.length,
      trainers: trainers.length,
      trainees: trainees.length,
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
  }, [assignments.length, members.length, trainees.length, trainers.length]);

  useEffect(() => {
    if (!relationshipOptions.some((option) => option.value === relationshipView)) {
      setRelationshipView(relationshipOptions[0]?.value ?? 'members');
      setRelationshipSearch('');
    }
  }, [relationshipOptions, relationshipView]);

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
    return buildSuggestions(assignments.flatMap((assignment) => [assignment.trainer?.name, assignment.status, ...((assignment.trainees ?? []).flatMap((entry) => [entry.trainee?.name, entry.status]))]));
  }, [assignments, members, relationshipView, trainees, trainers]);

  const filteredMembers = useMemo(() => members.filter((membership) => matchesQuery(relationshipSearch, [membership.trainee?.name, membership.trainee?.email, membership.trainer?.name, membership.trainer?.email, membership.plan, membership.status])), [members, relationshipSearch]);
  const filteredTrainers = useMemo(() => trainers.filter((trainer) => matchesQuery(relationshipSearch, [trainer.name, trainer.email, trainer.role, trainer.status])), [relationshipSearch, trainers]);
  const filteredTrainees = useMemo(() => trainees.filter((trainee) => matchesQuery(relationshipSearch, [trainee.name, trainee.email, trainee.role, trainee.status])), [relationshipSearch, trainees]);
  const filteredAssignments = useMemo(() => assignments.filter((assignment) => matchesQuery(relationshipSearch, [assignment.trainer?.name, assignment.trainer?.email, assignment.status, ...((assignment.trainees ?? []).flatMap((entry) => [entry.trainee?.name, entry.trainee?.email, entry.status]))])), [assignments, relationshipSearch]);

  const metricCards = [
    { label: 'Members', value: formatNumber(gym?.metrics?.activeMembers ?? members.length) },
    { label: 'Trainers', value: formatNumber(gym?.metrics?.activeTrainers ?? trainers.length) },
    { label: 'Trainees', value: formatNumber(gym?.metrics?.totalTrainees ?? trainees.length) },
    { label: 'Assignments', value: formatNumber(gym?.metrics?.activeAssignments ?? assignments.length) },
    { label: 'Assigned trainers', value: formatNumber(gym?.metrics?.assignedTrainers ?? assignedTrainers.length) },
    { label: 'Impressions', value: formatNumber(gym?.analytics?.impressions ?? 0) },
    { label: 'Rating', value: formatRatingValue(gym?.analytics?.rating) },
    { label: 'Media assets', value: formatNumber(gym?.metrics?.mediaAssets ?? mediaAssets.length) },
  ];

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
    return <div className="dashboard-grid dashboard-grid--stacked"><DashboardSection title="Gym details"><SkeletonPanel lines={12} /></DashboardSection></div>;
  }

  if (isError || !gym) {
    return (
      <div className="dashboard-grid dashboard-grid--stacked">
        <DashboardSection title="Gym details" action={(<div style={{ display: 'flex', gap: '0.5rem' }}><button type="button" onClick={() => navigate('/dashboard/admin/gyms')}>Back to gyms</button><button type="button" onClick={() => refetch()}>Retry</button></div>)}>
          <EmptyState message={isError ? 'Could not load this gym right now.' : 'Gym was not found.'} />
        </DashboardSection>
      </div>
    );
  }

  return (
    <div className="dashboard-grid dashboard-grid--stacked">
      <DashboardSection
        title="Gym details"
        action={(<div style={{ display: 'flex', gap: '0.5rem' }}><button type="button" onClick={() => navigate('/dashboard/admin/gyms')}>Back to gyms</button><button type="button" onClick={handleRemoveGym} disabled={isDeletingGym}>{isDeletingGym ? 'Removing...' : 'Remove gym'}</button></div>)}
      >
        {(notice || errorNotice) ? <div className={`status-pill ${errorNotice ? 'status-pill--warning' : 'status-pill--success'}`}>{errorNotice || notice}</div> : null}

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1.25rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
          <div className="dashboard-table__user-placeholder" style={{ width: 72, height: 72, fontSize: '1.8rem' }}>{gym.name?.charAt(0) ?? 'G'}</div>
          <div style={{ flex: '1 1 420px', minWidth: '280px' }}>
            <h3 style={{ margin: 0 }}>{gym.name ?? 'Unnamed gym'}</h3>
            <small>{formatLocation(gym.location?.city, gym.location?.state, gym.location?.postalCode)}</small>
            <p style={{ margin: '0.75rem 0 0.9rem', color: 'var(--muted-text-color)' }}>{displayValue(gym.description || 'No gym description has been added yet.')}</p>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <StatusChip value={gym.status} />
              <StatusChip value={gym.approvalStatus} />
              <StatusChip value={gym.isPublished ? 'published' : 'unpublished'} />
              <StatusChip value={gym.isActive ? 'active' : 'inactive'} />
              {gym.listingSubscription?.status ? <StatusChip value={gym.listingSubscription.status} /> : null}
              {gym.sponsorship?.status && gym.sponsorship.status !== 'none' ? <StatusChip value={gym.sponsorship.status} /> : null}
            </div>
          </div>
        </div>

        <div className="stat-grid">
          {metricCards.map((metric) => (
            <div key={metric.label} className="stat-card">
              <small>{metric.label}</small>
              <strong>{metric.value}</strong>
            </div>
          ))}
        </div>

        <div className="details-grid">
          <DetailCard title="Gym lifecycle" rows={[
            { label: 'Gym ID', value: <span style={{ fontSize: '0.82rem', opacity: 0.8 }}>{getGymId(gym)}</span> },
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
            <div style={{ marginTop: '1.2rem', display: 'grid', gap: '0.95rem' }}>
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
            { label: 'Monthly MRP', value: formatCurrency({ amount: gym.pricing?.monthlyMrp, currency: gym.pricing?.currency }) },
            { label: 'Monthly price', value: formatCurrency({ amount: gym.pricing?.monthlyPrice, currency: gym.pricing?.currency }) },
            { label: 'Listing plan', value: gym.listingSubscription?.planCode ? formatStatus(gym.listingSubscription.planCode) : EMPTY_VALUE },
            { label: 'Listing status', value: gym.listingSubscription?.status ? <StatusChip value={gym.listingSubscription.status} /> : EMPTY_VALUE },
            { label: 'Listing period', value: gym.listingSubscription ? formatPeriodRange(gym.listingSubscription.periodStart, gym.listingSubscription.periodEnd) : EMPTY_VALUE },
            { label: 'Auto renew', value: gym.listingSubscription ? (gym.listingSubscription.autoRenew ? 'Enabled' : 'Disabled') : EMPTY_VALUE },
            { label: 'Listing invoices', value: gym.listingSubscription ? formatNumber(gym.listingSubscription.invoiceCount ?? 0) : EMPTY_VALUE },
            { label: 'Sponsorship', value: gym.sponsorship?.status ? <StatusChip value={gym.sponsorship.status} /> : EMPTY_VALUE },
            { label: 'Sponsor package', value: gym.sponsorship?.package ? formatStatus(gym.sponsorship.package) : EMPTY_VALUE },
            { label: 'Sponsor amount', value: Number(gym.sponsorship?.amount) > 0 ? formatCurrency({ amount: gym.sponsorship.amount, currency: gym.pricing?.currency }) : EMPTY_VALUE },
            { label: 'Sponsor expiry', value: gym.sponsorship?.expiresAt ? formatDateTime(gym.sponsorship.expiresAt) : EMPTY_VALUE },
          ]} />

          <DetailCard title="Operations & reach" rows={[
            { label: 'Open hours', value: gym.schedule?.openTime || gym.schedule?.closeTime ? `${displayValue(gym.schedule?.openTime)} - ${displayValue(gym.schedule?.closeTime)}` : EMPTY_VALUE },
            { label: 'Working days', value: joinValues(gym.schedule?.workingDays) },
            { label: 'Active members', value: formatNumber(gym.metrics?.activeMembers ?? members.length) },
            { label: 'Trainees', value: formatNumber(gym.metrics?.totalTrainees ?? trainees.length) },
            { label: 'Assignments', value: formatNumber(gym.metrics?.activeAssignments ?? assignments.length) },
            { label: 'Impressions', value: formatNumber(gym.analytics?.impressions ?? 0) },
            { label: 'Average rating', value: formatRatingValue(gym.analytics?.rating) },
            { label: 'Review count', value: formatNumber(gym.metrics?.reviewCount ?? gym.analytics?.ratingCount ?? 0) },
            { label: 'Last impression', value: gym.analytics?.lastImpressionAt ? formatDateTime(gym.analytics.lastImpressionAt) : EMPTY_VALUE },
            { label: 'Last review', value: gym.analytics?.lastReviewAt ? formatDateTime(gym.analytics.lastReviewAt) : EMPTY_VALUE },
          ]} />

          <DetailCard title="Discovery profile">
            <div style={{ color: 'var(--text-color)', lineHeight: 1.6, marginBottom: '1.1rem' }}>{gym.description || 'No discovery description is available for this gym.'}</div>
            <div style={{ display: 'grid', gap: '1rem' }}>
              <AttributeGroup label="Features" values={features} />
              <AttributeGroup label="Key features" values={keyFeatures} />
              <AttributeGroup label="Amenities" values={amenities} />
              <AttributeGroup label="Search tags" values={tags} />
            </div>
          </DetailCard>
        </div>
      </DashboardSection>

      <DashboardSection title="Media & assets">
        <div className="details-grid" style={{ marginTop: 0, marginBottom: '1.5rem' }}>
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            {mediaAssets.map((asset, index) => (
              <a key={asset.id} href={asset.url} target="_blank" rel="noreferrer" style={{ display: 'block', borderRadius: '18px', overflow: 'hidden', border: '1px solid rgba(255, 255, 255, 0.08)', background: 'rgba(255, 255, 255, 0.03)', textDecoration: 'none' }}>
                <img src={asset.url} alt={`${gym.name || 'Gym'} asset ${index + 1}`} style={{ display: 'block', width: '100%', height: '180px', objectFit: 'cover', background: 'rgba(255, 255, 255, 0.05)' }} />
                <div style={{ padding: '0.85rem 1rem' }}>
                  <strong style={{ display: 'block', color: 'var(--text-color)', marginBottom: '0.25rem' }}>{asset.source} asset {index + 1}</strong>
                  <small style={{ color: 'var(--muted-text-color)', wordBreak: 'break-all' }}>{asset.url}</small>
                </div>
              </a>
            ))}
          </div>
        ) : <EmptyState message="No media assets are stored for this gym." />}
      </DashboardSection>

      <DashboardSection title="Relationship explorer">
        <p style={{ marginTop: 0, color: 'var(--muted-text-color)' }}>
          Memberships, linked trainers, enrolled trainees, and trainer assignments linked to this gym.
        </p>

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
            <table className="dashboard-table">
              <thead><tr><th>Member</th><th>Assigned trainer</th><th>Plan</th><th>Status</th><th>Membership window</th></tr></thead>
              <tbody>
                {filteredMembers.map((membership) => (
                  <tr key={membership.id}>
                    <td>{membership.trainee ? renderUserLink(membership.trainee) : EMPTY_VALUE}</td>
                    <td>{membership.trainer ? renderUserLink(membership.trainer) : EMPTY_VALUE}</td>
                    <td>{formatStatus(membership.plan || 'monthly')}</td>
                    <td><StatusChip value={membership.status} /></td>
                    <td>{formatPeriodRange(membership.startDate, membership.endDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <EmptyState message={relationshipSearch ? 'No memberships match this search.' : 'No memberships are linked to this gym.'} />
        )}

        {relationshipView === 'trainers' && (
          filteredTrainers.length ? (
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
          ) : <EmptyState message={relationshipSearch ? 'No trainers match this search.' : 'No trainers are linked to this gym.'} />
        )}

        {relationshipView === 'trainees' && (
          filteredTrainees.length ? (
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
          ) : <EmptyState message={relationshipSearch ? 'No trainees match this search.' : 'No trainees are enrolled in this gym.'} />
        )}

        {relationshipView === 'assignments' && (
          filteredAssignments.length ? (
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
          ) : <EmptyState message={relationshipSearch ? 'No assignments match this search.' : 'No trainer assignments exist for this gym.'} />
        )}

      </DashboardSection>
    </div>
  );
};

export default AdminGymDetailsPage;
