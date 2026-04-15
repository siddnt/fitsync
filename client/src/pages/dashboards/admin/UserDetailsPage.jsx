import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import DashboardSection from '../components/DashboardSection.jsx';
import EmptyState from '../components/EmptyState.jsx';
import SkeletonPanel from '../../../ui/SkeletonPanel.jsx';
import SearchSuggestInput from '../../../components/dashboard/SearchSuggestInput.jsx';
import { useGetAdminUserDetailsQuery } from '../../../services/dashboardApi.js';
import { useDeleteUserMutation } from '../../../services/adminApi.js';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatNumber,
  formatStatus,
} from '../../../utils/format.js';
import '../Dashboard.css';

const EMPTY_VALUE = '-';

const getUserId = (user) => String(user?._id ?? user?.id ?? '');
const getGymId = (gym) => String(gym?.id ?? gym?._id ?? '');

const ROLE_BADGE_MAP = {
  admin: 'role-badge--admin',
  trainer: 'role-badge--trainer',
  trainee: 'role-badge--trainee',
  'gym-owner': 'role-badge--gym-owner',
  seller: 'role-badge--seller',
  manager: 'role-badge--manager',
};

const TRAINEE_EXPLORER_OPTIONS = [
  { value: 'memberships', label: 'Memberships' },
  { value: 'orders', label: 'Orders' },
  { value: 'gymReviews', label: 'Gym reviews' },
  { value: 'productReviews', label: 'Product reviews' },
  { value: 'progress', label: 'Progress logs' },
];

const TRAINER_EXPLORER_OPTIONS = [
  { value: 'gyms', label: 'Associated gyms' },
  { value: 'trainees', label: 'Trainees' },
  { value: 'memberships', label: 'Trainer memberships' },
  { value: 'progress', label: 'Progress records' },
  { value: 'assignments', label: 'Assignments' },
];

const OWNER_EXPLORER_OPTIONS = [
  { value: 'gyms', label: 'Owned gyms' },
  { value: 'members', label: 'Gym members' },
  { value: 'subscriptions', label: 'Listing subscriptions' },
  { value: 'revenue', label: 'Revenue history' },
];

const SELLER_EXPLORER_OPTIONS = [
  { value: 'products', label: 'Products' },
  { value: 'orders', label: 'Seller orders' },
  { value: 'revenue', label: 'Revenue history' },
];

const getRoleBadgeClass = (role) => ROLE_BADGE_MAP[String(role || '').toLowerCase()] || 'role-badge--default';

const getStatusTone = (value) => {
  const normalized = String(value || '').toLowerCase();

  if (['active', 'approved', 'available', 'paid', 'delivered', 'published'].includes(normalized)) {
    return 'success';
  }

  if (['pending', 'processing', 'grace', 'in-transit', 'out-for-delivery'].includes(normalized)) {
    return 'info';
  }

  return 'warning';
};

const displayValue = (value) => {
  if (value === null || value === undefined || value === '') {
    return EMPTY_VALUE;
  }

  if (Array.isArray(value)) {
    return value.length ? value.join(', ') : EMPTY_VALUE;
  }

  return String(value);
};

const joinValues = (values = []) => {
  if (!Array.isArray(values)) {
    return EMPTY_VALUE;
  }

  const filtered = values
    .map((value) => String(value || '').trim())
    .filter(Boolean);

  return filtered.length ? filtered.join(', ') : EMPTY_VALUE;
};

const matchesQuery = (query, values = []) => {
  const normalizedQuery = String(query || '').trim().toLowerCase();
  if (!normalizedQuery) {
    return true;
  }

  return values
    .filter((value) => value !== null && value !== undefined && value !== '')
    .some((value) => String(value).toLowerCase().includes(normalizedQuery));
};

const buildSuggestions = (entries = []) => {
  const seen = new Set();
  const suggestions = [];

  entries.forEach((entry) => {
    if (!entry) {
      return;
    }

    const label = String(entry.label ?? entry).trim();
    if (!label) {
      return;
    }

    const key = label.toLowerCase();
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    suggestions.push({ id: key, label, meta: entry.meta ? String(entry.meta) : undefined });
  });

  return suggestions;
};

const formatLocation = (...parts) => {
  const filtered = parts.filter(Boolean).map((part) => String(part).trim()).filter(Boolean);
  return filtered.length ? filtered.join(', ') : EMPTY_VALUE;
};

const formatOrderItems = (items = []) => {
  if (!Array.isArray(items) || !items.length) {
    return EMPTY_VALUE;
  }

  const summary = items
    .slice(0, 2)
    .map((item) => `${item?.name || 'Item'} x${item?.quantity || 0}`)
    .join(', ');

  return items.length > 2 ? `${summary} +${items.length - 2} more` : summary;
};

const formatRatingValue = (value) => {
  const rating = Number(value);
  if (!Number.isFinite(rating) || rating <= 0) {
    return EMPTY_VALUE;
  }
  return `${rating.toFixed(1)}/5`;
};

const toExternalHref = (value) => {
  const raw = String(value || '').trim();
  if (!raw) {
    return '';
  }
  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }
  return `https://${raw}`;
};

const renderExternalLinkValue = (value) => {
  const href = toExternalHref(value);
  const label = String(value || '').trim();

  if (!href || !label) {
    return EMPTY_VALUE;
  }

  return (
    <a href={href} target="_blank" rel="noreferrer">
      {label}
    </a>
  );
};

const renderUserLink = (user) => {
  const id = getUserId(user);
  const label = user?.name || user?.email || EMPTY_VALUE;
  return id ? <Link to={`/dashboard/admin/users/${id}`}>{label}</Link> : label;
};

const renderGymLink = (gym) => {
  const id = getGymId(gym);
  const label = gym?.name || EMPTY_VALUE;
  return id ? <Link to={`/dashboard/admin/gyms/${id}`}>{label}</Link> : label;
};

const StatusChip = ({ value }) => (
  <span className={`status-pill status-pill--${getStatusTone(value)}`}>
    {formatStatus(value || 'unknown')}
  </span>
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

const ExplorerToolbar = ({
  options,
  activeValue,
  onChange,
  searchValue,
  onSearchChange,
  suggestions,
  searchPlaceholder,
  searchLabel,
}) => (
  <div
    style={{
      display: 'flex',
      gap: '0.9rem',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexWrap: 'wrap',
      marginBottom: '1rem',
    }}
  >
    <div className="filter-group" style={{ flexWrap: 'wrap' }}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`filter-btn ${activeValue === option.value ? 'active' : ''}`}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>

    <div style={{ minWidth: '260px', flex: '1 1 320px', maxWidth: '420px' }}>
      <SearchSuggestInput
        id={`${searchLabel}-${activeValue}`}
        value={searchValue}
        onChange={onSearchChange}
        onSelect={(suggestion) => onSearchChange(suggestion.label)}
        suggestions={suggestions}
        placeholder={searchPlaceholder}
        ariaLabel={searchLabel}
      />
    </div>
  </div>
);

const SectionHeading = ({ title, subtitle }) => (
  <div style={{ marginTop: '2rem', marginBottom: '0.9rem' }}>
    <h4 style={{ marginBottom: subtitle ? '0.35rem' : 0 }}>{title}</h4>
    {subtitle ? (
      <p style={{ margin: 0, color: 'var(--muted-text-color, #9ca3af)' }}>{subtitle}</p>
    ) : null}
  </div>
);

const AdminUserDetailsPage = () => {
  const navigate = useNavigate();
  const { userId } = useParams();
  const { data, isLoading, isError, refetch } = useGetAdminUserDetailsQuery(userId, {
    skip: !userId,
    refetchOnMountOrArgChange: true,
    refetchOnFocus: true,
  });
  const [deleteUser, { isLoading: isDeletingUser }] = useDeleteUserMutation();

  const [traineeExplorerView, setTraineeExplorerView] = useState('memberships');
  const [trainerExplorerView, setTrainerExplorerView] = useState('gyms');
  const [ownerExplorerView, setOwnerExplorerView] = useState('gyms');
  const [sellerExplorerView, setSellerExplorerView] = useState('products');
  const [traineeExplorerSearch, setTraineeExplorerSearch] = useState('');
  const [trainerExplorerSearch, setTrainerExplorerSearch] = useState('');
  const [ownerExplorerSearch, setOwnerExplorerSearch] = useState('');
  const [sellerExplorerSearch, setSellerExplorerSearch] = useState('');
  const [notice, setNotice] = useState(null);
  const [errorNotice, setErrorNotice] = useState(null);

  const user = data?.data?.user ?? null;
  const relationships = user?.relationships ?? {};
  const ownerMetrics = user?.ownerMetrics ?? {};
  const sellerMetrics = user?.sellerMetrics ?? {};
  const trainerMetrics = user?.trainerMetrics ?? {};

  const traineeMemberships = Array.isArray(relationships.traineeMemberships) ? relationships.traineeMemberships : [];
  const trainerAssignments = Array.isArray(relationships.trainerAssignments) ? relationships.trainerAssignments : [];
  const trainerMemberships = Array.isArray(relationships.trainerMemberships) ? relationships.trainerMemberships : [];
  const trainerGyms = Array.isArray(relationships.trainerGyms) ? relationships.trainerGyms : [];
  const trainerTrainees = Array.isArray(relationships.trainerTrainees) ? relationships.trainerTrainees : [];
  const trainerProgressAsTrainer = Array.isArray(relationships.trainerProgressAsTrainer) ? relationships.trainerProgressAsTrainer : [];
  const trainerProgressAsTrainee = Array.isArray(relationships.trainerProgressAsTrainee) ? relationships.trainerProgressAsTrainee : [];
  const orderHistory = Array.isArray(relationships.orderHistory) ? relationships.orderHistory : [];
  const traineeGymReviews = Array.isArray(relationships.traineeGymReviews) ? relationships.traineeGymReviews : [];
  const traineeProductReviews = Array.isArray(relationships.traineeProductReviews) ? relationships.traineeProductReviews : [];
  const sellerProducts = Array.isArray(relationships.sellerProducts) ? relationships.sellerProducts : [];
  const sellerOrders = Array.isArray(relationships.sellerOrders) ? relationships.sellerOrders : [];
  const sellerRevenueEvents = Array.isArray(relationships.sellerRevenueEvents) ? relationships.sellerRevenueEvents : [];
  const ownerGyms = Array.isArray(relationships.ownerGyms) ? relationships.ownerGyms : [];
  const ownerMemberships = Array.isArray(relationships.ownerMemberships) ? relationships.ownerMemberships : [];
  const ownerSubscriptions = Array.isArray(relationships.ownerSubscriptions) ? relationships.ownerSubscriptions : [];
  const ownerRevenueEvents = Array.isArray(relationships.ownerRevenueEvents) ? relationships.ownerRevenueEvents : [];
  const managedGyms = Array.isArray(relationships.managedGyms) ? relationships.managedGyms : [];
  const primaryGym = relationships.primaryGym ?? null;

  const normalizedRole = String(user?.role || '').toLowerCase();
  const isTraineeRole = ['trainee', 'user', 'member'].includes(normalizedRole);
  const isTrainerRole = normalizedRole === 'trainer';
  const isOwnerRole = normalizedRole === 'gym-owner';
  const isSellerRole = normalizedRole === 'seller';
  const isManagerRole = normalizedRole === 'manager';
  const canRemoveUser = normalizedRole !== 'admin';

  const associatedGymCountForTrainee = new Set(traineeMemberships.map((membership) => getGymId(membership?.gym)).filter(Boolean)).size;
  const associatedTrainerCountForTrainee = new Set(traineeMemberships.map((membership) => getUserId(membership?.trainer)).filter(Boolean)).size;
  const activeTraineeMemberships = traineeMemberships.filter((membership) => membership?.status === 'active').length;
  const totalReviewsCount = traineeGymReviews.length + traineeProductReviews.length;
  const activeTrainerMemberships = trainerMemberships.filter((membership) => membership?.status === 'active').length;
  const ownerPublishedGymCount = Number(ownerMetrics?.publishedGyms ?? ownerGyms.filter((gym) => gym?.isPublished).length);
  const ownerActiveMembers = Number(ownerMetrics?.totalActiveMembers ?? ownerMemberships.filter((membership) => membership?.status === 'active').length);
  const ownerActiveListings = Number(
    ownerMetrics?.activeListingSubscriptions
    ?? ownerSubscriptions.filter((subscription) => ['active', 'grace'].includes(subscription?.status)).length,
  );
  const ownerExpiringListings = Number(
    ownerMetrics?.expiringSubscriptions
    ?? ownerSubscriptions.filter(
      (subscription) => subscription?.daysRemaining !== null
        && subscription?.daysRemaining !== undefined
        && subscription.daysRemaining <= 14,
    ).length,
  );
  const sellerActiveProducts = Number(
    sellerMetrics?.activeProducts ?? 0,
  );
  const sellerFulfilledOrders = Number(
    sellerMetrics?.ordersFulfilled ?? 0,
  );
  const sellerUnitsSold = Number(
    sellerMetrics?.unitsSold ?? 0,
  );
  const sellerReviewedProductsCount = Number(sellerMetrics?.reviewedProductsCount ?? 0);
  const sellerCatalogStock = Number(sellerMetrics?.catalogStock ?? 0);
  const sellerRevenueEventsCount = Number(sellerMetrics?.revenueEventsCount ?? 0);
  const sellerAverageRating = sellerMetrics?.averageRating !== null && sellerMetrics?.averageRating !== undefined
    ? Number(sellerMetrics.averageRating).toFixed(1)
    : EMPTY_VALUE;
  const managedPublishedGymsCount = managedGyms.filter((gym) => gym?.isPublished).length;
  const managedMembersCount = managedGyms.reduce((sum, gym) => sum + (Number(gym?.memberships) || 0), 0);
  const managedImpressionsCount = managedGyms.reduce((sum, gym) => sum + (Number(gym?.impressions) || 0), 0);

  const metricCards = useMemo(() => {
    if (isOwnerRole) {
      return [
        { label: 'Gyms Owned', value: formatNumber(ownerMetrics?.totalGyms ?? ownerGyms.length) },
        { label: 'Published Gyms', value: formatNumber(ownerPublishedGymCount) },
        { label: 'Active Members', value: formatNumber(ownerActiveMembers) },
        { label: 'Listing Plans', value: formatNumber(ownerActiveListings) },
        { label: 'Monthly Revenue', value: formatCurrency(ownerMetrics?.monthlyEarnings ?? 0) },
        { label: 'Monthly Profit', value: formatCurrency(ownerMetrics?.monthlyProfit ?? 0) },
      ];
    }

    if (isSellerRole) {
      return [
        { label: 'Products', value: formatNumber(sellerMetrics?.productsCount ?? sellerProducts.length) },
        { label: 'Active Products', value: formatNumber(sellerActiveProducts) },
        { label: 'Seller Orders', value: formatNumber(sellerMetrics?.ordersCount ?? sellerOrders.length) },
        { label: 'Fulfilled Orders', value: formatNumber(sellerFulfilledOrders) },
        { label: 'Units Sold', value: formatNumber(sellerUnitsSold) },
        { label: 'Seller Revenue', value: formatCurrency(sellerMetrics?.totalRevenue ?? 0) },
      ];
    }

    if (isTrainerRole) {
      return [
        { label: 'Active Trainees', value: formatNumber(trainerMetrics?.activeTrainees ?? trainerTrainees.length) },
        { label: 'Associated Gyms', value: formatNumber(trainerMetrics?.associatedGyms ?? trainerGyms.length) },
        { label: 'Assignments', value: formatNumber(trainerMetrics?.assignmentsCount ?? trainerAssignments.length) },
        { label: 'Active Memberships', value: formatNumber(activeTrainerMemberships) },
        { label: 'Progress Records', value: formatNumber(trainerMetrics?.progressRecordsCount ?? trainerProgressAsTrainer.length) },
        { label: 'Experience', value: displayValue(user?.experienceYears ? `${user.experienceYears} yrs` : '') },
      ];
    }

    if (isManagerRole) {
      return [
        { label: 'Managed Gyms', value: formatNumber(managedGyms.length) },
        { label: 'Published Gyms', value: formatNumber(managedPublishedGymsCount) },
        { label: 'Managed Members', value: formatNumber(managedMembersCount) },
        { label: 'Impressions', value: formatNumber(managedImpressionsCount) },
      ];
    }

    return [
      { label: 'Memberships', value: formatNumber(user?.memberships ?? activeTraineeMemberships) },
      { label: 'Purchases', value: formatNumber(user?.orders ?? orderHistory.length) },
      { label: 'Associated Gyms', value: formatNumber(associatedGymCountForTrainee) },
      { label: 'Assigned Trainers', value: formatNumber(associatedTrainerCountForTrainee) },
      { label: 'Reviews', value: formatNumber(totalReviewsCount) },
      { label: 'Progress Logs', value: formatNumber(trainerProgressAsTrainee.length) },
    ];
  }, [
    activeTraineeMemberships,
    activeTrainerMemberships,
    associatedGymCountForTrainee,
    associatedTrainerCountForTrainee,
    managedGyms.length,
    managedImpressionsCount,
    managedMembersCount,
    managedPublishedGymsCount,
    isManagerRole,
    isOwnerRole,
    isSellerRole,
    isTrainerRole,
    ownerGyms.length,
    ownerActiveListings,
    ownerActiveMembers,
    ownerExpiringListings,
    ownerMetrics?.monthlyEarnings,
    ownerMetrics?.monthlyProfit,
    ownerMetrics?.totalGyms,
    orderHistory.length,
    sellerActiveProducts,
    sellerFulfilledOrders,
    sellerMetrics?.ordersCount,
    sellerMetrics?.productsCount,
    sellerMetrics?.totalRevenue,
    sellerOrders.length,
    sellerProducts.length,
    sellerUnitsSold,
    totalReviewsCount,
    trainerAssignments.length,
    trainerGyms.length,
    trainerMetrics?.assignmentsCount,
    trainerMetrics?.activeTrainees,
    trainerMetrics?.associatedGyms,
    trainerMetrics?.progressRecordsCount,
    trainerProgressAsTrainee.length,
    trainerProgressAsTrainer.length,
    trainerTrainees.length,
    user?.orders,
    user?.memberships,
    user?.experienceYears,
  ]);

  const profileNarrative = [user?.profile?.about, user?.bio].filter(Boolean).join('\n\n');
  const sharedAccountRows = [
    { label: 'Name', value: displayValue(user?.name) },
    { label: 'Email', value: displayValue(user?.email) },
    { label: 'Role', value: formatStatus(user?.role || 'unknown') },
    { label: 'Status', value: <StatusChip value={user?.status || 'unknown'} /> },
    { label: 'Joined', value: formatDate(user?.createdAt) },
    { label: 'User ID', value: displayValue(user?.id || user?._id) },
  ];
  const contactPresenceRows = [
    { label: 'Phone', value: displayValue(user?.contactNumber) },
    { label: isOwnerRole || isSellerRole || isManagerRole ? 'Business address' : 'Address', value: displayValue(user?.address) },
    { label: 'Profile location', value: displayValue(user?.profile?.location) },
    { label: 'Website', value: renderExternalLinkValue(user?.profile?.socialLinks?.website) },
    { label: 'Instagram', value: renderExternalLinkValue(user?.profile?.socialLinks?.instagram) },
    { label: 'Facebook', value: renderExternalLinkValue(user?.profile?.socialLinks?.facebook) },
  ];
  const detailCards = (() => {
    if (isOwnerRole) {
      return [
        { title: 'Account Info', rows: sharedAccountRows },
        {
          title: 'Gym Portfolio',
          rows: [
            { label: 'Total gyms', value: formatNumber(ownerMetrics?.totalGyms ?? ownerGyms.length) },
            { label: 'Published gyms', value: formatNumber(ownerPublishedGymCount) },
            { label: 'Active members', value: formatNumber(ownerActiveMembers) },
            { label: 'Sponsored gyms', value: formatNumber(ownerMetrics?.sponsoredGyms ?? ownerGyms.filter((gym) => gym?.sponsorship?.status === 'active').length) },
            { label: 'Expiring listings', value: formatNumber(ownerExpiringListings) },
            { label: 'Total impressions', value: formatNumber(ownerMetrics?.totalImpressions ?? 0) },
          ],
        },
        {
          title: 'Revenue & Listings',
          rows: [
            { label: 'Lifetime revenue', value: formatCurrency(ownerMetrics?.totalRevenue ?? 0) },
            { label: 'Monthly revenue', value: formatCurrency(ownerMetrics?.monthlyEarnings ?? 0) },
            { label: 'Monthly spend', value: formatCurrency(ownerMetrics?.monthlySpend ?? 0) },
            { label: 'Monthly profit', value: formatCurrency(ownerMetrics?.monthlyProfit ?? 0) },
            { label: 'Active listings', value: formatNumber(ownerActiveListings) },
            { label: 'Listing subscriptions', value: formatNumber(ownerSubscriptions.length) },
          ],
        },
        {
          title: 'Business Profile',
          rows: [
            { label: 'Company', value: displayValue(user?.profile?.company) },
            { label: 'Headline', value: displayValue(user?.profile?.headline) },
            ...contactPresenceRows,
          ],
        },
      ];
    }

    if (isSellerRole) {
      return [
        { title: 'Account Info', rows: sharedAccountRows },
        {
          title: 'Storefront Snapshot',
          rows: [
            { label: 'Products listed', value: formatNumber(sellerMetrics?.productsCount ?? sellerProducts.length) },
            { label: 'Active products', value: formatNumber(sellerActiveProducts) },
            { label: 'Seller orders', value: formatNumber(sellerMetrics?.ordersCount ?? sellerOrders.length) },
            { label: 'Fulfilled orders', value: formatNumber(sellerFulfilledOrders) },
            { label: 'Units sold', value: formatNumber(sellerUnitsSold) },
            { label: 'Average rating', value: sellerAverageRating === EMPTY_VALUE ? EMPTY_VALUE : `${sellerAverageRating}/5` },
          ],
        },
        {
          title: 'Sales Performance',
          rows: [
            { label: 'Seller revenue', value: formatCurrency(sellerMetrics?.totalRevenue ?? 0) },
            { label: 'Reviewed products', value: formatNumber(sellerReviewedProductsCount) },
            { label: 'Catalog stock', value: formatNumber(sellerCatalogStock) },
            { label: 'Revenue events', value: formatNumber(sellerRevenueEventsCount) },
          ],
        },
        {
          title: 'Store Profile',
          rows: [
            { label: 'Company', value: displayValue(user?.profile?.company) },
            { label: 'Headline', value: displayValue(user?.profile?.headline) },
            ...contactPresenceRows,
          ],
        },
      ];
    }

    if (isTrainerRole) {
      return [
        { title: 'Account Info', rows: sharedAccountRows },
        {
          title: 'Trainer Snapshot',
          rows: [
            { label: 'Experience', value: displayValue(user?.experienceYears ? `${user.experienceYears} years` : '') },
            { label: 'Mentored members', value: formatNumber(user?.mentoredCount ?? 0) },
            { label: 'Active trainees', value: formatNumber(trainerMetrics?.activeTrainees ?? trainerTrainees.length) },
            { label: 'Associated gyms', value: formatNumber(trainerMetrics?.associatedGyms ?? trainerGyms.length) },
            { label: 'Assignments', value: formatNumber(trainerMetrics?.assignmentsCount ?? trainerAssignments.length) },
            { label: 'Active memberships', value: formatNumber(activeTrainerMemberships) },
          ],
        },
        {
          title: 'Expertise & Credentials',
          rows: [
            { label: 'Specializations', value: joinValues(user?.specializations) },
            { label: 'Certifications', value: joinValues(user?.certifications) },
            { label: 'Headline', value: displayValue(user?.profile?.headline) },
            { label: 'Progress records', value: formatNumber(trainerMetrics?.progressRecordsCount ?? trainerProgressAsTrainer.length) },
            { label: 'Gender', value: displayValue(user?.gender) },
            { label: 'Age', value: displayValue(user?.age) },
          ],
        },
        {
          title: 'Contact & Reach',
          rows: [
            ...contactPresenceRows,
            { label: 'Address', value: displayValue(user?.address) },
          ],
        },
      ];
    }

    if (isManagerRole) {
      return [
        { title: 'Account Info', rows: sharedAccountRows },
        {
          title: 'Management Scope',
          rows: [
            { label: 'Managed gyms', value: formatNumber(managedGyms.length) },
            { label: 'Published gyms', value: formatNumber(managedPublishedGymsCount) },
            { label: 'Managed members', value: formatNumber(managedMembersCount) },
            { label: 'Managed impressions', value: formatNumber(managedImpressionsCount) },
            { label: 'Gym coverage', value: managedGyms.length ? formatLocation(...managedGyms.slice(0, 3).map((gym) => gym?.city).filter(Boolean)) : EMPTY_VALUE },
          ],
        },
        {
          title: 'Operations Profile',
          rows: [
            { label: 'Company', value: displayValue(user?.profile?.company) },
            { label: 'Headline', value: displayValue(user?.profile?.headline) },
            ...contactPresenceRows,
          ],
        },
      ];
    }

    return [
      { title: 'Account Info', rows: sharedAccountRows },
      {
        title: 'Trainee Snapshot',
        rows: [
          { label: 'Primary gym', value: primaryGym ? renderGymLink(primaryGym) : EMPTY_VALUE },
          { label: 'Active memberships', value: formatNumber(activeTraineeMemberships) },
          { label: 'Associated gyms', value: formatNumber(associatedGymCountForTrainee) },
          { label: 'Assigned trainers', value: formatNumber(associatedTrainerCountForTrainee) },
          { label: 'Purchases tracked', value: formatNumber(orderHistory.length) },
          { label: 'Progress logs', value: formatNumber(trainerProgressAsTrainee.length) },
        ],
      },
      {
        title: 'Fitness Profile',
        rows: [
          { label: 'Age', value: displayValue(user?.age) },
          { label: 'Gender', value: displayValue(user?.gender) },
          { label: 'Height', value: user?.height ? `${user.height} cm` : EMPTY_VALUE },
          { label: 'Weight', value: user?.weight ? `${user.weight} kg` : EMPTY_VALUE },
          { label: 'Fitness goals', value: joinValues(user?.fitnessGoals) },
          { label: 'Reviews posted', value: formatNumber(totalReviewsCount) },
        ],
      },
      {
        title: 'Contact & Profile',
        rows: [
          ...contactPresenceRows,
          { label: 'Address', value: displayValue(user?.address) },
        ],
      },
    ];
  })();

  const traineeSuggestions = useMemo(() => {
    if (traineeExplorerView === 'memberships') {
      return buildSuggestions(
        traineeMemberships.flatMap((membership) => [
          membership?.gym?.name,
          membership?.trainer?.name,
          membership?.plan,
          membership?.status,
        ]),
      );
    }

    if (traineeExplorerView === 'orders') {
      return buildSuggestions(
        orderHistory.flatMap((order) => [
          order?.orderNumber,
          order?.status,
          ...(order?.items || []).map((item) => item?.name),
        ]),
      );
    }

    if (traineeExplorerView === 'gymReviews') {
      return buildSuggestions(
        traineeGymReviews.flatMap((review) => [review?.gym?.name, review?.comment]),
      );
    }

    if (traineeExplorerView === 'productReviews') {
      return buildSuggestions(
        traineeProductReviews.flatMap((review) => [review?.product?.name, review?.title, review?.comment]),
      );
    }

    return buildSuggestions(
      trainerProgressAsTrainee.flatMap((record) => [record?.gym?.name, record?.trainer?.name]),
    );
  }, [
    orderHistory,
    traineeExplorerView,
    traineeGymReviews,
    traineeMemberships,
    traineeProductReviews,
    trainerProgressAsTrainee,
  ]);

  const trainerSuggestions = useMemo(() => {
    if (trainerExplorerView === 'gyms') {
      return buildSuggestions(trainerGyms.flatMap((gym) => [gym?.name, gym?.city, gym?.state]));
    }

    if (trainerExplorerView === 'trainees') {
      return buildSuggestions(trainerTrainees.flatMap((trainee) => [trainee?.name, trainee?.email]));
    }

    if (trainerExplorerView === 'memberships') {
      return buildSuggestions(
        trainerMemberships.flatMap((membership) => [
          membership?.trainee?.name,
          membership?.gym?.name,
          membership?.plan,
          membership?.status,
        ]),
      );
    }

    if (trainerExplorerView === 'progress') {
      return buildSuggestions(
        trainerProgressAsTrainer.flatMap((record) => [record?.trainee?.name, record?.gym?.name]),
      );
    }

    return buildSuggestions(
      trainerAssignments.flatMap((assignment) => [
        assignment?.gym?.name,
        assignment?.status,
        ...(assignment?.trainees || []).map((entry) => entry?.trainee?.name),
      ]),
    );
  }, [
    trainerAssignments,
    trainerExplorerView,
    trainerGyms,
    trainerMemberships,
    trainerProgressAsTrainer,
    trainerTrainees,
  ]);

  const ownerSuggestions = useMemo(() => {
    if (ownerExplorerView === 'gyms') {
      return buildSuggestions(
        ownerGyms.flatMap((gym) => [gym?.name, gym?.city, gym?.state, gym?.listing?.planCode, gym?.status]),
      );
    }

    if (ownerExplorerView === 'members') {
      return buildSuggestions(
        ownerMemberships.flatMap((membership) => [
          membership?.trainee?.name,
          membership?.trainee?.email,
          membership?.gym?.name,
          membership?.plan,
          membership?.status,
        ]),
      );
    }

    if (ownerExplorerView === 'subscriptions') {
      return buildSuggestions(
        ownerSubscriptions.flatMap((subscription) => [subscription?.gym?.name, subscription?.planCode, subscription?.status]),
      );
    }

    return buildSuggestions(ownerRevenueEvents.flatMap((entry) => [entry?.type, entry?.description]));
  }, [ownerExplorerView, ownerGyms, ownerMemberships, ownerRevenueEvents, ownerSubscriptions]);

  const sellerSuggestions = useMemo(() => {
    if (sellerExplorerView === 'products') {
      return buildSuggestions(sellerProducts.flatMap((product) => [product?.name, product?.status]));
    }

    if (sellerExplorerView === 'orders') {
      return buildSuggestions(
        sellerOrders.flatMap((order) => [
          order?.orderNumber,
          order?.buyer?.name,
          order?.buyer?.email,
          ...(order?.items || []).map((item) => item?.name),
        ]),
      );
    }

    return buildSuggestions(sellerRevenueEvents.flatMap((entry) => [entry?.type, entry?.description]));
  }, [sellerExplorerView, sellerOrders, sellerProducts, sellerRevenueEvents]);

  const filteredTraineeMemberships = traineeMemberships.filter((membership) => matchesQuery(
    traineeExplorerSearch,
    [membership?.gym?.name, membership?.trainer?.name, membership?.plan, membership?.status],
  ));
  const filteredOrderHistory = orderHistory.filter((order) => matchesQuery(
    traineeExplorerSearch,
    [order?.orderNumber, order?.status, ...(order?.items || []).map((item) => item?.name)],
  ));
  const filteredGymReviews = traineeGymReviews.filter((review) => matchesQuery(
    traineeExplorerSearch,
    [review?.gym?.name, review?.comment, review?.rating],
  ));
  const filteredProductReviews = traineeProductReviews.filter((review) => matchesQuery(
    traineeExplorerSearch,
    [review?.product?.name, review?.title, review?.comment, review?.rating],
  ));
  const filteredTraineeProgress = trainerProgressAsTrainee.filter((record) => matchesQuery(
    traineeExplorerSearch,
    [record?.gym?.name, record?.trainer?.name, record?.attendanceCount, record?.progressMetricCount],
  ));

  const filteredTrainerGyms = trainerGyms.filter((gym) => matchesQuery(
    trainerExplorerSearch,
    [gym?.name, gym?.city, gym?.state],
  ));
  const filteredTrainerTrainees = trainerTrainees.filter((trainee) => matchesQuery(
    trainerExplorerSearch,
    [trainee?.name, trainee?.email, trainee?.assignmentCount],
  ));
  const filteredTrainerMemberships = trainerMemberships.filter((membership) => matchesQuery(
    trainerExplorerSearch,
    [membership?.trainee?.name, membership?.gym?.name, membership?.plan, membership?.status],
  ));
  const filteredTrainerProgress = trainerProgressAsTrainer.filter((record) => matchesQuery(
    trainerExplorerSearch,
    [record?.trainee?.name, record?.gym?.name, record?.attendanceCount, record?.progressMetricCount],
  ));
  const filteredTrainerAssignments = trainerAssignments.filter((assignment) => matchesQuery(
    trainerExplorerSearch,
    [assignment?.gym?.name, assignment?.status, ...(assignment?.trainees || []).map((entry) => entry?.trainee?.name)],
  ));

  const filteredOwnerGyms = ownerGyms.filter((gym) => matchesQuery(
    ownerExplorerSearch,
    [gym?.name, gym?.city, gym?.state, gym?.listing?.planCode, gym?.status],
  ));
  const filteredOwnerMemberships = ownerMemberships.filter((membership) => matchesQuery(
    ownerExplorerSearch,
    [membership?.trainee?.name, membership?.trainee?.email, membership?.gym?.name, membership?.plan, membership?.status],
  ));
  const filteredOwnerSubscriptions = ownerSubscriptions.filter((subscription) => matchesQuery(
    ownerExplorerSearch,
    [subscription?.gym?.name, subscription?.planCode, subscription?.status, subscription?.daysRemaining],
  ));
  const filteredOwnerRevenue = ownerRevenueEvents.filter((entry) => matchesQuery(
    ownerExplorerSearch,
    [entry?.type, entry?.description, entry?.amount],
  ));

  const filteredSellerProducts = sellerProducts.filter((product) => matchesQuery(
    sellerExplorerSearch,
    [product?.name, product?.status, product?.price, product?.stock],
  ));
  const filteredSellerOrders = sellerOrders.filter((order) => matchesQuery(
    sellerExplorerSearch,
    [order?.orderNumber, order?.buyer?.name, order?.buyer?.email, order?.status, ...(order?.items || []).map((item) => item?.name)],
  ));
  const filteredSellerRevenue = sellerRevenueEvents.filter((entry) => matchesQuery(
    sellerExplorerSearch,
    [entry?.type, entry?.description, entry?.amount],
  ));

  const handleRemoveUser = async () => {
    if (!canRemoveUser || !user) return;
    const targetUserId = getUserId(user);
    if (!targetUserId) return;
    setNotice(null);
    setErrorNotice(null);
    const confirmed = window.confirm(`Remove ${formatStatus(user?.role ?? 'user').toLowerCase()} ${user.name ?? ''}? This permanently deletes the account.`);
    if (!confirmed) return;
    try {
      await deleteUser(targetUserId).unwrap();
      setNotice('User removed successfully.');
      navigate('/dashboard/admin/users');
    } catch (error) {
      setErrorNotice(error?.data?.message ?? 'Unable to remove this user.');
    }
  };

  if (isLoading) {
    return (
      <div className="dashboard-grid dashboard-grid--stacked">
        <DashboardSection title="User details">
          <SkeletonPanel lines={8} />
        </DashboardSection>
      </div>
    );
  }

  if (isError || !user) {
    return (
      <div className="dashboard-grid dashboard-grid--stacked">
        <DashboardSection
          title="User details"
          action={(
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="button" onClick={() => navigate('/dashboard/admin/users')}>Back to users</button>
              <button type="button" onClick={() => refetch()}>Retry</button>
            </div>
          )}
        >
          <EmptyState message={isError ? 'Could not load this user right now.' : 'User was not found.'} />
        </DashboardSection>
      </div>
    );
  }

  return (
    <div className="dashboard-grid dashboard-grid--stacked">
      <DashboardSection
        title="User details"
        action={(
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="button" onClick={() => navigate('/dashboard/admin/users')}>Back to users</button>
            {canRemoveUser ? (
              <button type="button" onClick={handleRemoveUser} disabled={isDeletingUser}>
                {isDeletingUser ? 'Removing...' : 'Remove user'}
              </button>
            ) : null}
          </div>
        )}
      >
        {(notice || errorNotice) ? (
          <div className={`status-pill ${errorNotice ? 'status-pill--warning' : 'status-pill--success'}`} style={{ marginBottom: '1rem' }}>
            {errorNotice || notice}
          </div>
        ) : null}

        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          {user.profilePicture ? (
            <img src={user.profilePicture} alt={user.name ?? 'User'} style={{ width: 84, height: 84, borderRadius: '50%', objectFit: 'cover' }} />
          ) : (
            <div className="dashboard-table__user-placeholder" style={{ width: 84, height: 84, fontSize: '2rem' }}>
              {user.name?.charAt(0) ?? '?'}
            </div>
          )}

          <div style={{ flex: '1 1 320px' }}>
            <h3 style={{ margin: 0 }}>{user.name ?? 'Unnamed user'}</h3>
            <small>{user.email ?? 'No email address'}</small>

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.45rem', flexWrap: 'wrap' }}>
              <span className={`role-badge ${getRoleBadgeClass(user.role)}`}>{formatStatus(user.role ?? 'unknown')}</span>
              <StatusChip value={user?.status || 'unknown'} />
            </div>

            <p style={{ marginTop: '0.75rem', marginBottom: 0, color: 'var(--muted-text-color, #9ca3af)' }}>
              {profileNarrative || 'No biography or profile summary added yet.'}
            </p>
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
          {detailCards.map((card) => (
            <DetailCard key={card.title} title={card.title} rows={card.rows} />
          ))}
        </div>

        {isTraineeRole ? (
          <>
            <SectionHeading
              title="Membership & Purchase Activity"
              subtitle="Everything this account is linked to as a member, buyer, reviewer, or trainee."
            />

            <ExplorerToolbar
              options={TRAINEE_EXPLORER_OPTIONS}
              activeValue={traineeExplorerView}
              onChange={(nextView) => {
                setTraineeExplorerView(nextView);
                setTraineeExplorerSearch('');
              }}
              searchValue={traineeExplorerSearch}
              onSearchChange={setTraineeExplorerSearch}
              suggestions={traineeSuggestions}
              searchPlaceholder="Search memberships, orders, reviews, or progress"
              searchLabel="Search trainee-linked records"
            />

            {traineeExplorerView === 'memberships' ? (
              filteredTraineeMemberships.length ? (
                <table className="dashboard-table">
                  <thead><tr><th>Gym</th><th>Trainer</th><th>Plan</th><th>Status</th><th>Period</th></tr></thead>
                  <tbody>
                    {filteredTraineeMemberships.map((membership) => (
                      <tr key={membership.id}>
                        <td>{renderGymLink(membership?.gym)}</td>
                        <td>{membership?.trainer ? renderUserLink(membership.trainer) : EMPTY_VALUE}</td>
                        <td>{formatStatus(membership?.plan)}</td>
                        <td><StatusChip value={membership?.status} /></td>
                        <td>{`${formatDate(membership?.startDate)} - ${formatDate(membership?.endDate)}`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <EmptyState message="No memberships found for this user." />
            ) : null}

            {traineeExplorerView === 'orders' ? (
              filteredOrderHistory.length ? (
                <table className="dashboard-table">
                  <thead><tr><th>Order</th><th>Items</th><th>Status</th><th>Total</th><th>Placed</th></tr></thead>
                  <tbody>
                    {filteredOrderHistory.map((order) => (
                      <tr key={String(order?.id ?? order?.orderNumber)}>
                        <td>{displayValue(order?.orderNumber)}</td>
                        <td>{formatOrderItems(order?.items)}</td>
                        <td><StatusChip value={order?.status} /></td>
                        <td>{formatCurrency({ amount: order?.total ?? 0, currency: order?.currency ?? 'INR' })}</td>
                        <td>{formatDateTime(order?.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <EmptyState message="No order history found for this user." />
            ) : null}

            {traineeExplorerView === 'gymReviews' ? (
              filteredGymReviews.length ? (
                <table className="dashboard-table">
                  <thead><tr><th>Gym</th><th>Rating</th><th>Comment</th><th>Updated</th></tr></thead>
                  <tbody>
                    {filteredGymReviews.map((review) => (
                      <tr key={review.id}>
                        <td>{renderGymLink(review?.gym)}</td>
                        <td>{review?.rating ?? EMPTY_VALUE}</td>
                        <td>{displayValue(review?.comment)}</td>
                        <td>{formatDateTime(review?.updatedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <EmptyState message="No gym reviews found for this user." />
            ) : null}

            {traineeExplorerView === 'productReviews' ? (
              filteredProductReviews.length ? (
                <table className="dashboard-table">
                  <thead><tr><th>Product</th><th>Rating</th><th>Review</th><th>Verified</th><th>Updated</th></tr></thead>
                  <tbody>
                    {filteredProductReviews.map((review) => (
                      <tr key={review.id}>
                        <td>{displayValue(review?.product?.name)}</td>
                        <td>{review?.rating ?? EMPTY_VALUE}</td>
                        <td>{displayValue(review?.title || review?.comment)}</td>
                        <td>{review?.isVerifiedPurchase ? 'Yes' : 'No'}</td>
                        <td>{formatDateTime(review?.updatedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <EmptyState message="No product reviews found for this user." />
            ) : null}

            {traineeExplorerView === 'progress' ? (
              filteredTraineeProgress.length ? (
                <table className="dashboard-table">
                  <thead><tr><th>Gym</th><th>Trainer</th><th>Attendance</th><th>Metrics</th><th>Feedback</th><th>Updated</th></tr></thead>
                  <tbody>
                    {filteredTraineeProgress.map((record) => (
                      <tr key={record.id}>
                        <td>{renderGymLink(record?.gym)}</td>
                        <td>{record?.trainer ? renderUserLink(record.trainer) : EMPTY_VALUE}</td>
                        <td>{formatNumber(record?.attendanceCount ?? 0)}</td>
                        <td>{formatNumber(record?.progressMetricCount ?? 0)}</td>
                        <td>{formatNumber(record?.feedbackCount ?? 0)}</td>
                        <td>{formatDateTime(record?.updatedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <EmptyState message="No trainee progress records found." />
            ) : null}
          </>
        ) : null}

        {isTrainerRole ? (
          <>
            <SectionHeading
              title="Trainer Responsibilities"
              subtitle="Gyms, assignments, memberships, and trainees linked to this account as a trainer."
            />

            <ExplorerToolbar
              options={TRAINER_EXPLORER_OPTIONS}
              activeValue={trainerExplorerView}
              onChange={(nextView) => {
                setTrainerExplorerView(nextView);
                setTrainerExplorerSearch('');
              }}
              searchValue={trainerExplorerSearch}
              onSearchChange={setTrainerExplorerSearch}
              suggestions={trainerSuggestions}
              searchPlaceholder="Search trainer associations"
              searchLabel="Search trainer-linked records"
            />

            {trainerExplorerView === 'gyms' ? (
              filteredTrainerGyms.length ? (
                <table className="dashboard-table">
                  <thead><tr><th>Gym</th><th>Location</th></tr></thead>
                  <tbody>
                    {filteredTrainerGyms.map((gym) => (
                      <tr key={getGymId(gym)}>
                        <td>{renderGymLink(gym)}</td>
                        <td>{formatLocation(gym?.city, gym?.state)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <EmptyState message="No associated gyms found for this trainer." />
            ) : null}

            {trainerExplorerView === 'trainees' ? (
              filteredTrainerTrainees.length ? (
                <table className="dashboard-table">
                  <thead><tr><th>Trainee</th><th>Email</th><th>Assignments</th></tr></thead>
                  <tbody>
                    {filteredTrainerTrainees.map((trainee) => (
                      <tr key={getUserId(trainee)}>
                        <td>{renderUserLink(trainee)}</td>
                        <td>{displayValue(trainee?.email)}</td>
                        <td>{formatNumber(trainee?.assignmentCount ?? 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <EmptyState message="No trainees are linked to this trainer." />
            ) : null}

            {trainerExplorerView === 'memberships' ? (
              filteredTrainerMemberships.length ? (
                <table className="dashboard-table">
                  <thead><tr><th>Trainee</th><th>Gym</th><th>Plan</th><th>Status</th><th>Period</th></tr></thead>
                  <tbody>
                    {filteredTrainerMemberships.map((membership) => (
                      <tr key={membership.id}>
                        <td>{membership?.trainee ? renderUserLink(membership.trainee) : EMPTY_VALUE}</td>
                        <td>{renderGymLink(membership?.gym)}</td>
                        <td>{formatStatus(membership?.plan)}</td>
                        <td><StatusChip value={membership?.status} /></td>
                        <td>{`${formatDate(membership?.startDate)} - ${formatDate(membership?.endDate)}`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <EmptyState message="No trainer memberships found." />
            ) : null}

            {trainerExplorerView === 'progress' ? (
              filteredTrainerProgress.length ? (
                <table className="dashboard-table">
                  <thead><tr><th>Trainee</th><th>Gym</th><th>Attendance</th><th>Metrics</th><th>Feedback</th><th>Updated</th></tr></thead>
                  <tbody>
                    {filteredTrainerProgress.map((record) => (
                      <tr key={record.id}>
                        <td>{record?.trainee ? renderUserLink(record.trainee) : EMPTY_VALUE}</td>
                        <td>{renderGymLink(record?.gym)}</td>
                        <td>{formatNumber(record?.attendanceCount ?? 0)}</td>
                        <td>{formatNumber(record?.progressMetricCount ?? 0)}</td>
                        <td>{formatNumber(record?.feedbackCount ?? 0)}</td>
                        <td>{formatDateTime(record?.updatedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <EmptyState message="No trainer progress records found." />
            ) : null}

            {trainerExplorerView === 'assignments' ? (
              filteredTrainerAssignments.length ? (
                <table className="dashboard-table">
                  <thead><tr><th>Gym</th><th>Status</th><th>Trainees</th><th>Requested</th></tr></thead>
                  <tbody>
                    {filteredTrainerAssignments.map((assignment) => (
                      <tr key={assignment.id}>
                        <td>{renderGymLink(assignment?.gym)}</td>
                        <td><StatusChip value={assignment?.status} /></td>
                        <td>{displayValue((assignment?.trainees || []).map((entry) => entry?.trainee?.name).filter(Boolean).join(', '))}</td>
                        <td>{formatDateTime(assignment?.requestedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <EmptyState message="No trainer assignments found." />
            ) : null}
          </>
        ) : null}

        {isOwnerRole ? (
          <>
            <SectionHeading
              title="Owner Operations"
              subtitle="Gyms, paid listings, memberships, and owner revenue connected to this account."
            />

            <ExplorerToolbar
              options={OWNER_EXPLORER_OPTIONS}
              activeValue={ownerExplorerView}
              onChange={(nextView) => {
                setOwnerExplorerView(nextView);
                setOwnerExplorerSearch('');
              }}
              searchValue={ownerExplorerSearch}
              onSearchChange={setOwnerExplorerSearch}
              suggestions={ownerSuggestions}
              searchPlaceholder="Search gyms, members, subscriptions, or revenue"
              searchLabel="Search owner-linked records"
            />

            {ownerExplorerView === 'gyms' ? (
              filteredOwnerGyms.length ? (
                <table className="dashboard-table">
                  <thead><tr><th>Gym</th><th>Location</th><th>Members</th><th>Listing</th><th>Price/mo</th><th>Impressions</th><th>Status</th></tr></thead>
                  <tbody>
                    {filteredOwnerGyms.map((gym) => (
                      <tr key={gym.id}>
                        <td>{renderGymLink(gym)}</td>
                        <td>{formatLocation(gym?.city, gym?.state)}</td>
                        <td>{formatNumber(gym?.memberships ?? 0)}</td>
                        <td>{gym?.listing ? `${formatStatus(gym.listing.planCode)} (${formatStatus(gym.listing.status)})` : 'No active listing'}</td>
                        <td>{formatCurrency({ amount: gym?.monthlyPrice ?? 0, currency: gym?.currency ?? 'INR' })}</td>
                        <td>{formatNumber(gym?.impressions ?? 0)}</td>
                        <td><StatusChip value={gym?.isPublished ? gym?.status : 'unpublished'} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <EmptyState message="No owned gyms found for this account." />
            ) : null}

            {ownerExplorerView === 'members' ? (
              filteredOwnerMemberships.length ? (
                <table className="dashboard-table">
                  <thead><tr><th>Member</th><th>Gym</th><th>Plan</th><th>Status</th><th>Billing</th><th>Joined</th></tr></thead>
                  <tbody>
                    {filteredOwnerMemberships.map((membership) => (
                      <tr key={membership.id}>
                        <td>{membership?.trainee ? renderUserLink(membership.trainee) : EMPTY_VALUE}</td>
                        <td>{renderGymLink(membership?.gym)}</td>
                        <td>{formatStatus(membership?.plan)}</td>
                        <td><StatusChip value={membership?.status} /></td>
                        <td>{membership?.billingAmount ? formatCurrency({ amount: membership.billingAmount, currency: membership.billingCurrency || 'INR' }) : EMPTY_VALUE}</td>
                        <td>{formatDateTime(membership?.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <EmptyState message="No member records found for this owner." />
            ) : null}

            {ownerExplorerView === 'subscriptions' ? (
              filteredOwnerSubscriptions.length ? (
                <table className="dashboard-table">
                  <thead><tr><th>Gym</th><th>Plan</th><th>Period</th><th>Days left</th><th>Auto renew</th><th>Amount</th><th>Status</th></tr></thead>
                  <tbody>
                    {filteredOwnerSubscriptions.map((subscription) => (
                      <tr key={subscription.id}>
                        <td>{renderGymLink(subscription?.gym)}</td>
                        <td>{formatStatus(subscription?.planCode)}</td>
                        <td>{`${formatDate(subscription?.periodStart)} - ${formatDate(subscription?.periodEnd)}`}</td>
                        <td>{subscription?.daysRemaining === null || subscription?.daysRemaining === undefined ? EMPTY_VALUE : subscription.daysRemaining}</td>
                        <td>{subscription?.autoRenew ? 'Yes' : 'No'}</td>
                        <td>{formatCurrency({ amount: subscription?.amount ?? 0, currency: subscription?.currency ?? 'INR' })}</td>
                        <td><StatusChip value={subscription?.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <EmptyState message="No listing subscriptions found for this owner." />
            ) : null}

            {ownerExplorerView === 'revenue' ? (
              filteredOwnerRevenue.length ? (
                <table className="dashboard-table">
                  <thead><tr><th>Date</th><th>Type</th><th>Description</th><th>Amount</th></tr></thead>
                  <tbody>
                    {filteredOwnerRevenue.map((entry) => (
                      <tr key={entry.id}>
                        <td>{formatDateTime(entry?.createdAt)}</td>
                        <td>{formatStatus(entry?.type)}</td>
                        <td>{displayValue(entry?.description)}</td>
                        <td>{formatCurrency({ amount: entry?.amount ?? 0, currency: entry?.currency ?? 'INR' })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <EmptyState message="No owner revenue history found." />
            ) : null}
          </>
        ) : null}

        {isSellerRole ? (
          <>
            <SectionHeading
              title="Seller Operations"
              subtitle="Products, seller-specific order slices, and revenue payouts linked to this account."
            />

            <ExplorerToolbar
              options={SELLER_EXPLORER_OPTIONS}
              activeValue={sellerExplorerView}
              onChange={(nextView) => {
                setSellerExplorerView(nextView);
                setSellerExplorerSearch('');
              }}
              searchValue={sellerExplorerSearch}
              onSearchChange={setSellerExplorerSearch}
              suggestions={sellerSuggestions}
              searchPlaceholder="Search products, seller orders, or revenue"
              searchLabel="Search seller-linked records"
            />

            {sellerExplorerView === 'products' ? (
              filteredSellerProducts.length ? (
                <table className="dashboard-table">
                  <thead><tr><th>Product</th><th>Price</th><th>Stock</th><th>Sold</th><th>Reviews</th><th>Status</th></tr></thead>
                  <tbody>
                    {filteredSellerProducts.map((product) => (
                      <tr key={product.id}>
                        <td>{displayValue(product?.name)}</td>
                        <td>{formatCurrency(product?.price ?? 0)}</td>
                        <td>{formatNumber(product?.stock ?? 0)}</td>
                        <td>{formatNumber(product?.totalSold ?? 0)}</td>
                        <td>{product?.reviewCount ? `${formatNumber(product.reviewCount)} (${formatRatingValue(product.averageRating)})` : EMPTY_VALUE}</td>
                        <td><StatusChip value={product?.isPublished ? product?.status : 'unpublished'} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <EmptyState message="No products uploaded by this seller yet." />
            ) : null}

            {sellerExplorerView === 'orders' ? (
              filteredSellerOrders.length ? (
                <table className="dashboard-table">
                  <thead><tr><th>Order</th><th>Buyer</th><th>Items</th><th>Seller total</th><th>Status</th><th>Placed</th></tr></thead>
                  <tbody>
                    {filteredSellerOrders.map((order) => (
                      <tr key={order.id}>
                        <td>{displayValue(order?.orderNumber)}</td>
                        <td>{order?.buyer ? renderUserLink(order.buyer) : EMPTY_VALUE}</td>
                        <td>{formatOrderItems(order?.items)}</td>
                        <td>{formatCurrency({ amount: order?.total ?? 0, currency: order?.currency ?? 'INR' })}</td>
                        <td><StatusChip value={order?.status} /></td>
                        <td>{formatDateTime(order?.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <EmptyState message="No seller orders found for this account." />
            ) : null}

            {sellerExplorerView === 'revenue' ? (
              filteredSellerRevenue.length ? (
                <table className="dashboard-table">
                  <thead><tr><th>Date</th><th>Type</th><th>Description</th><th>Amount</th></tr></thead>
                  <tbody>
                    {filteredSellerRevenue.map((entry) => (
                      <tr key={entry.id}>
                        <td>{formatDateTime(entry?.createdAt)}</td>
                        <td>{formatStatus(entry?.type)}</td>
                        <td>{displayValue(entry?.description)}</td>
                        <td>{formatCurrency({ amount: entry?.amount ?? 0, currency: entry?.currency ?? 'INR' })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <EmptyState message="No seller revenue history found." />
            ) : null}
          </>
        ) : null}

        {isManagerRole ? (
          <>
            <SectionHeading
              title="Managed Gyms"
              subtitle="Gyms this account can manage, including their current membership and impression totals."
            />

            <table className="dashboard-table">
              <thead><tr><th>Gym</th><th>Location</th><th>Members</th><th>Impressions</th><th>Status</th><th>Created</th></tr></thead>
              <tbody>
                {managedGyms.map((gym) => (
                  <tr key={gym.id}>
                    <td>{renderGymLink(gym)}</td>
                    <td>{formatLocation(gym?.city, gym?.state)}</td>
                    <td>{formatNumber(gym?.memberships ?? 0)}</td>
                    <td>{formatNumber(gym?.impressions ?? 0)}</td>
                    <td><StatusChip value={gym?.isPublished ? gym?.status : 'unpublished'} /></td>
                    <td>{formatDateTime(gym?.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : null}
      </DashboardSection>
    </div>
  );
};

export default AdminUserDetailsPage;
