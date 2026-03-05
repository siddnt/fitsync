import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import DashboardSection from '../components/DashboardSection.jsx';
import EmptyState from '../components/EmptyState.jsx';
import SkeletonPanel from '../../../ui/SkeletonPanel.jsx';
import AutosuggestInput from '../../../ui/AutosuggestInput.jsx';
import { useGetAdminUserDetailsQuery } from '../../../services/dashboardApi.js';
import { useDeleteUserMutation } from '../../../services/adminApi.js';
import { formatCurrency, formatDate, formatStatus } from '../../../utils/format.js';
import '../Dashboard.css';

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
const getRoleBadgeClass = (role) => ROLE_BADGE_MAP[role] || 'role-badge--default';

const TRAINEE_EXPLORER_OPTIONS = [
  { value: 'memberships', label: 'Memberships' },
  { value: 'orders', label: 'Order history' },
];

const AdminUserDetailsPage = () => {
  const navigate = useNavigate();
  const { userId } = useParams();
  const { data, isLoading, isFetching, isError, refetch } = useGetAdminUserDetailsQuery(userId, {
    skip: !userId,
    refetchOnMountOrArgChange: true,
    refetchOnFocus: true,
  });
  const [deleteUser, { isLoading: isDeletingUser }] = useDeleteUserMutation();

  const user = data?.data?.user ?? null;
  const traineeMemberships = Array.isArray(user?.relationships?.traineeMemberships) ? user.relationships.traineeMemberships : [];
  const trainerAssignments = Array.isArray(user?.relationships?.trainerAssignments) ? user.relationships.trainerAssignments : [];
  const trainerGyms = Array.isArray(user?.relationships?.trainerGyms) ? user.relationships.trainerGyms : [];
  const trainerTrainees = Array.isArray(user?.relationships?.trainerTrainees) ? user.relationships.trainerTrainees : [];
  const orderHistory = Array.isArray(user?.relationships?.orderHistory) ? user.relationships.orderHistory : [];
  const primaryGym = user?.relationships?.primaryGym ?? null;
  const [traineeExplorerView, setTraineeExplorerView] = useState('memberships');
  const [traineeExplorerSearch, setTraineeExplorerSearch] = useState('');
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

  const normalizedRole = String(user?.role || '').toLowerCase();
  const isTraineeRole = ['trainee', 'user', 'member'].includes(normalizedRole);
  const isTrainerRole = normalizedRole === 'trainer';
  const isOwnerRole = normalizedRole === 'gym-owner';
  const canRemoveUser = normalizedRole !== 'admin';
  const hasOrderCount = Number(user?.orders) > 0;
  const associatedGymCountForTrainee = new Set(
    traineeMemberships.map((membership) => getGymId(membership?.gym)).filter(Boolean),
  ).size;
  const associatedTrainerCountForTrainee = new Set(
    traineeMemberships.map((membership) => getUserId(membership?.trainer)).filter(Boolean),
  ).size;
  const traineeExplorerQuery = traineeExplorerSearch.trim().toLowerCase();

  const traineeExplorerSuggestions = useMemo(() => {
    const suggestions = [];
    const seen = new Set();
    const pushUnique = (value) => {
      const text = String(value || '').trim();
      if (!text) {
        return;
      }
      const key = text.toLowerCase();
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      suggestions.push(text);
    };

    if (traineeExplorerView === 'memberships') {
      traineeMemberships.forEach((membership) => {
        [
          membership?.gym?.name,
          membership?.trainer?.name,
        ].forEach(pushUnique);
      });
      return suggestions;
    }

    orderHistory.forEach((order) => {
      [order?.orderNumber].forEach(pushUnique);
    });
    return suggestions;
  }, [traineeExplorerView, traineeMemberships, orderHistory]);

  const filteredTraineeMemberships = useMemo(() => {
    if (!traineeExplorerQuery) {
      return traineeMemberships;
    }
    return traineeMemberships.filter((membership) => [
      membership?.gym?.name,
      membership?.gym?.city,
      membership?.gym?.state,
      membership?.trainer?.name,
      membership?.trainer?.email,
      membership?.plan,
      membership?.status,
    ]
      .filter((value) => value !== null && value !== undefined)
      .some((value) => String(value).toLowerCase().includes(traineeExplorerQuery)));
  }, [traineeMemberships, traineeExplorerQuery]);

  const filteredOrderHistory = useMemo(() => {
    if (!traineeExplorerQuery) {
      return orderHistory;
    }
    return orderHistory.filter((order) => [
      order?.orderNumber,
      order?.id,
      order?.status,
      order?.itemsCount,
      ...(order?.items || []).flatMap((item) => [item?.name, item?.status, item?.quantity]),
    ]
      .filter((value) => value !== null && value !== undefined)
      .some((value) => String(value).toLowerCase().includes(traineeExplorerQuery)));
  }, [orderHistory, traineeExplorerQuery]);

  const metricCards = [
    {
      label: 'Memberships',
      value: user?.memberships ?? user?.traineeMetrics?.activeMemberships ?? 0,
    },
    {
      label: 'Orders',
      value: user?.orders ?? 0,
    },
    ...(isOwnerRole
      ? [{
        label: 'Gyms Owned',
        value: user?.gymsOwned ?? user?.ownerMetrics?.totalGyms ?? 0,
      }]
      : isTrainerRole
        ? [{
          label: 'Associated Gyms',
          value: trainerGyms.length,
        }]
        : isTraineeRole
          ? [{
            label: 'Associated Gyms',
            value: associatedGymCountForTrainee,
          }]
          : []),
    (isTrainerRole
      ? {
        label: 'Active Trainees',
        value: user?.trainerMetrics?.activeTrainees ?? 0,
      }
      : isTraineeRole
        ? {
          label: 'Assigned Trainers',
          value: associatedTrainerCountForTrainee,
        }
        : isOwnerRole
          ? {
            label: 'Impressions',
            value: user?.ownerMetrics?.totalImpressions ?? 0,
          }
          : {
            label: 'Status',
            value: formatStatus(user?.status ?? 'unknown'),
          }),
  ];

  const roleMetricItems = [
    ...(isTraineeRole
      ? [
        { label: 'Active Memberships', value: toDisplayValue(user?.traineeMetrics?.activeMemberships) },
        { label: 'Primary Gym', value: primaryGym?.name ? `${primaryGym.name} (${getGymId(primaryGym)})` : toDisplayValue(user?.traineeMetrics?.primaryGym) },
      ]
      : []),
    ...(isOwnerRole
      ? [
        { label: 'Total Gyms (Owner)', value: toDisplayValue(user?.ownerMetrics?.totalGyms) },
        { label: 'Total Impressions (Owner)', value: toDisplayValue(user?.ownerMetrics?.totalImpressions) },
        { label: 'Monthly Spend (Owner)', value: toDisplayValue(user?.ownerMetrics?.monthlySpend) },
        { label: 'Monthly Earnings (Owner)', value: toDisplayValue(user?.ownerMetrics?.monthlyEarnings) },
      ]
      : []),
    ...(isTrainerRole
      ? [
        { label: 'Active Trainees (Trainer)', value: toDisplayValue(user?.trainerMetrics?.activeTrainees) },
        { label: 'Trainer Gym IDs', value: toJoinedText(user?.trainerMetrics?.gyms), fullWidth: true },
      ]
      : []),
  ];

  const handleRemoveUser = async () => {
    if (!canRemoveUser || !user) {
      return;
    }

    const targetUserId = getUserId(user);
    if (!targetUserId) {
      return;
    }

    setNotice(null);
    setErrorNotice(null);

    const roleLabel = formatStatus(user?.role ?? 'user').toLowerCase();
    const confirmed = window.confirm(`Remove ${roleLabel} ${user.name ?? ''}? This permanently deletes the account and linked data.`);
    if (!confirmed) {
      return;
    }

    try {
      await deleteUser(targetUserId).unwrap();
      setNotice('User removed successfully.');
      navigate('/dashboard/admin/users');
    } catch (mutationError) {
      setErrorNotice(mutationError?.data?.message ?? 'Unable to remove this user.');
    }
  };

  if (isLoading) {
    return (
      <div className="dashboard-grid dashboard-grid--stacked ud-page">
        <DashboardSection title="User details">
          <SkeletonPanel lines={8} />
        </DashboardSection>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="dashboard-grid dashboard-grid--stacked ud-page">
        <DashboardSection
          title="User details"
          action={(
            <div className="ud-actions">
              <button type="button" className="ud-btn" onClick={() => navigate('/dashboard/admin/users')}>
                Back to users
              </button>
              <button type="button" className="ud-btn" onClick={() => refetch()}>
                Retry
              </button>
            </div>
          )}
        >
          <EmptyState message="Could not load this user right now." />
        </DashboardSection>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="dashboard-grid dashboard-grid--stacked ud-page">
        <DashboardSection
          title="User details"
          action={(
            <button type="button" className="ud-btn" onClick={() => navigate('/dashboard/admin/users')}>
              Back to users
            </button>
          )}
        >
          <EmptyState message="User was not found." />
        </DashboardSection>
      </div>
    );
  }

  return (
    <div className="dashboard-grid dashboard-grid--stacked ud-page">
      <DashboardSection
        title="User details"
        action={(
          <div className="ud-actions">
            <button type="button" className="ud-btn" onClick={() => navigate('/dashboard/admin/users')}>
              Back to users
            </button>
            {canRemoveUser ? (
              <button type="button" className="ud-btn ud-btn--danger" onClick={handleRemoveUser} disabled={isDeletingUser}>
                {isDeletingUser ? 'Removing...' : 'Remove user'}
              </button>
            ) : null}
          </div>
        )}
      >
        {(notice || errorNotice) ? (
          <div className={`status-pill ${errorNotice ? 'status-pill--warning' : 'status-pill--success'}`}>
            {errorNotice || notice}
          </div>
        ) : null}
        <div className="user-detail__header">
          {user.profilePicture ? (
            <img
              className="user-detail__avatar user-detail__avatar--lg"
              src={user.profilePicture}
              alt={user.name ?? 'User'}
            />
          ) : (
            <div className="user-detail__avatar user-detail__avatar--placeholder user-detail__avatar--lg">
              {user.name?.charAt(0) ?? '?'}
            </div>
          )}
          <div className="user-detail__meta">
            <h3>{user.name ?? 'Unnamed user'}</h3>
            <small>{user.email ?? 'No email'}</small>
            <div className="user-detail__badges">
              <span className={`role-badge ${getRoleBadgeClass(user.role)}`}>{formatStatus(user.role ?? 'unknown')}</span>
              <span className={`status-pill status-pill--${user.status === 'active' ? 'success' : 'warning'}`}>
                {formatStatus(user.status ?? 'unknown')}
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

        <h4 className="user-detail__section-title">📋 Account</h4>
        <div className="user-detail__grid">
          <div className="user-detail__item">
            <span className="user-detail__label">Name</span>
            <span>{user.name ?? '-'}</span>
          </div>
          <div className="user-detail__item">
            <span className="user-detail__label">Email</span>
            <span>{user.email ?? '-'}</span>
          </div>
          <div className="user-detail__item">
            <span className="user-detail__label">Role</span>
            <span>{formatStatus(user.role ?? 'unknown')}</span>
          </div>
          <div className="user-detail__item">
            <span className="user-detail__label">Status</span>
            <span>{formatStatus(user.status ?? 'unknown')}</span>
          </div>
          <div className="user-detail__item">
            <span className="user-detail__label">Joined</span>
            <span>{formatDate(user.createdAt)}</span>
          </div>
          <div className="user-detail__item">
            <span className="user-detail__label">User ID</span>
            <span>{getUserId(user)}</span>
          </div>
          <div className="user-detail__item user-detail__item--full">
            <span className="user-detail__label">Headline</span>
            <span>{user.profile?.headline || '-'}</span>
          </div>
          <div className="user-detail__item user-detail__item--full">
            <span className="user-detail__label">Location</span>
            <span>{user.profile?.location || '-'}</span>
          </div>
        </div>

        <h4 className="user-detail__section-title">👤 Personal</h4>
        <div className="user-detail__grid">
          <div className="user-detail__item">
            <span className="user-detail__label">First Name</span>
            <span>{user.firstName ?? '-'}</span>
          </div>
          <div className="user-detail__item">
            <span className="user-detail__label">Last Name</span>
            <span>{user.lastName ?? '-'}</span>
          </div>
          <div className="user-detail__item">
            <span className="user-detail__label">Age</span>
            <span>{toDisplayValue(user.age)}</span>
          </div>
          <div className="user-detail__item">
            <span className="user-detail__label">Gender</span>
            <span>{user.gender ? formatStatus(user.gender) : '-'}</span>
          </div>
          <div className="user-detail__item">
            <span className="user-detail__label">Phone</span>
            <span>{user.contactNumber || '-'}</span>
          </div>
          <div className="user-detail__item user-detail__item--full">
            <span className="user-detail__label">Address</span>
            <span>{user.address || '-'}</span>
          </div>
        </div>

        <h4 className="user-detail__section-title">🔗 Profile</h4>
        <div className="user-detail__grid">
          <div className="user-detail__item user-detail__item--full">
            <span className="user-detail__label">Bio</span>
            <span>{user.bio || user.profile?.about || '-'}</span>
          </div>
          <div className="user-detail__item">
            <span className="user-detail__label">Company</span>
            <span>{user.profile?.company || '-'}</span>
          </div>
          <div className="user-detail__item">
            <span className="user-detail__label">Website</span>
            <span>{user.profile?.socialLinks?.website || '-'}</span>
          </div>
          <div className="user-detail__item">
            <span className="user-detail__label">Instagram</span>
            <span>{user.profile?.socialLinks?.instagram || '-'}</span>
          </div>
          <div className="user-detail__item">
            <span className="user-detail__label">Facebook</span>
            <span>{user.profile?.socialLinks?.facebook || '-'}</span>
          </div>
        </div>

        <h4 className="user-detail__section-title">💪 Fitness & Expertise</h4>
        <div className="user-detail__grid">
          <div className="user-detail__item">
            <span className="user-detail__label">Height</span>
            <span>{toDisplayValue(user.height, ' cm')}</span>
          </div>
          <div className="user-detail__item">
            <span className="user-detail__label">Weight</span>
            <span>{toDisplayValue(user.weight, ' kg')}</span>
          </div>
          <div className="user-detail__item">
            <span className="user-detail__label">Experience</span>
            <span>{toDisplayValue(user.experienceYears, ' years')}</span>
          </div>
          <div className="user-detail__item">
            <span className="user-detail__label">Mentored Count</span>
            <span>{toDisplayValue(user.mentoredCount)}</span>
          </div>
          <div className="user-detail__item user-detail__item--full">
            <span className="user-detail__label">Specialisations</span>
            <span>{toJoinedText(user.specializations)}</span>
          </div>
          <div className="user-detail__item user-detail__item--full">
            <span className="user-detail__label">Certifications</span>
            <span>{toJoinedText(user.certifications)}</span>
          </div>
          <div className="user-detail__item user-detail__item--full">
            <span className="user-detail__label">Fitness Goals</span>
            <span>{toJoinedText(user.fitnessGoals)}</span>
          </div>
        </div>

        <h4 className="user-detail__section-title">📊 Role Metrics</h4>
        <div className="user-detail__grid">
          {roleMetricItems.length ? roleMetricItems.map((item) => (
            <div key={item.label} className={`user-detail__item${item.fullWidth ? ' user-detail__item--full' : ''}`}>
              <span className="user-detail__label">{item.label}</span>
              <span>{item.value}</span>
            </div>
          )) : (
            <div className="user-detail__item user-detail__item--full">
              <span className="user-detail__label">Role Metrics</span>
              <span>No role-specific metrics available.</span>
            </div>
          )}
        </div>

        {isTraineeRole ? (
          <>
            <h4 className="user-detail__section-title">🔍 Trainee Explorer</h4>
            <div className="admin-toolbar">
              <select
                className="inventory-toolbar__input inventory-toolbar__input--select"
                value={traineeExplorerView}
                onChange={(event) => {
                  setTraineeExplorerView(event.target.value);
                  setTraineeExplorerSearch('');
                }}
                aria-label="Select trainee view"
              >
                {TRAINEE_EXPLORER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <AutosuggestInput
                className="inventory-toolbar__input"
                placeholder={`Search ${TRAINEE_EXPLORER_OPTIONS.find((option) => option.value === traineeExplorerView)?.label?.toLowerCase() || 'records'}`}
                value={traineeExplorerSearch}
                onChange={setTraineeExplorerSearch}
                suggestions={traineeExplorerSuggestions}
                ariaLabel="Search trainee memberships or orders"
              />
              {traineeExplorerSearch.trim() ? (
                <button type="button" className="admin-toolbar__reset" onClick={() => setTraineeExplorerSearch('')}>
                  Reset
                </button>
              ) : null}
            </div>
            {traineeExplorerView === 'memberships' ? (
              filteredTraineeMemberships.length ? (
                <div className="admin-table-wrapper">
                  <table className="dashboard-table">
                    <thead>
                      <tr>
                        <th>Gym</th>
                        <th>Trainer</th>
                        <th>Plan</th>
                        <th>Status</th>
                        <th>Period</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTraineeMemberships.map((membership) => (
                        <tr key={membership.id}>
                          <td>
                            {getGymId(membership.gym) ? (
                              <Link to={`/dashboard/admin/gyms/${getGymId(membership.gym)}`} className="dashboard-table__user--link">
                                {membership.gym?.name ?? '-'}
                              </Link>
                            ) : (
                              membership.gym?.name ?? '-'
                            )}
                            <div><small>{[membership.gym?.city, membership.gym?.state].filter(Boolean).join(', ') || '-'}</small></div>
                          </td>
                          <td>
                            {getUserId(membership.trainer) ? (
                              <Link to={`/dashboard/admin/users/${getUserId(membership.trainer)}`} className="dashboard-table__user--link">
                                {membership.trainer?.name ?? '-'}
                              </Link>
                            ) : (
                              membership.trainer?.name ?? '-'
                            )}
                            <div><small>{membership.trainer?.email ?? '-'}</small></div>
                          </td>
                          <td>{formatStatus(membership.plan)}</td>
                          <td>{formatStatus(membership.status)}</td>
                          <td>{membership.startDate && membership.endDate ? `${formatDate(membership.startDate)} - ${formatDate(membership.endDate)}` : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState message={traineeExplorerQuery ? 'No memberships match this search.' : 'No active gym memberships found for this trainee.'} />
              )
            ) : filteredOrderHistory.length ? (
              <div className="admin-table-wrapper">
                <table className="dashboard-table">
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Date</th>
                      <th>Status</th>
                      <th>Items</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrderHistory.map((order) => (
                      <tr key={String(order?.id ?? order?.orderNumber ?? order?.createdAt)}>
                        <td>
                          <div>{order?.orderNumber ?? '-'}</div>
                          <div><small>{order?.id ? String(order.id) : '-'}</small></div>
                        </td>
                        <td>{formatDate(order?.createdAt)}</td>
                        <td>{formatStatus(order?.status)}</td>
                        <td>
                          <div>{order?.itemsCount ?? 0}</div>
                          {Number(order?.itemsCount) > 1 && Array.isArray(order?.items) && order.items.length ? (
                            <details className="user-detail__order-items">
                              <summary>View items</summary>
                              <div className="user-detail__order-items-list">
                                {order.items.map((item, index) => (
                                  <div
                                    key={String(item?.id ?? `${order?.id ?? 'order'}-${index}`)}
                                    className="user-detail__order-item-line"
                                  >
                                    <strong>{item?.name || `Item ${index + 1}`}</strong>
                                    <small>
                                      Qty:
                                      {' '}
                                      {item?.quantity ?? 0}
                                      {' - '}
                                      {formatStatus(item?.status)}
                                    </small>
                                  </div>
                                ))}
                              </div>
                            </details>
                          ) : null}
                        </td>
                        <td>{formatCurrency(order?.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : isFetching && hasOrderCount && !traineeExplorerQuery ? (
              <EmptyState message="Loading order history..." />
            ) : hasOrderCount && !traineeExplorerQuery ? (
              <EmptyState message="Orders exist, but order history details are not available from the API yet. Refresh once, or restart backend API." />
            ) : (
              <EmptyState message={traineeExplorerQuery ? 'No orders match this search.' : 'No order history found for this trainee.'} />
            )}
          </>
        ) : null}

        {isTrainerRole ? <h4 className="user-detail__section-title">🏋️ Associations</h4> : null}

        {isTrainerRole ? (
          <>
            {trainerGyms.length ? (
              <div className="admin-table-wrapper">
                <table className="dashboard-table">
                  <thead>
                    <tr>
                      <th>Associated Gyms</th>
                      <th>Location</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trainerGyms.map((gym) => (
                      <tr key={getGymId(gym)}>
                        <td>
                          {getGymId(gym) ? (
                            <Link to={`/dashboard/admin/gyms/${getGymId(gym)}`} className="dashboard-table__user--link">
                              {gym?.name ?? '-'}
                            </Link>
                          ) : (
                            gym?.name ?? '-'
                          )}
                        </td>
                        <td>{[gym?.city, gym?.state].filter(Boolean).join(', ') || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState message="No associated gyms found for this trainer." />
            )}

            {trainerTrainees.length ? (
              <div className="admin-table-wrapper">
                <table className="dashboard-table">
                  <thead>
                    <tr>
                      <th>Associated Trainees</th>
                      <th>Email</th>
                      <th>Status</th>
                      <th>Assignments</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trainerTrainees.map((trainee) => (
                      <tr key={getUserId(trainee)}>
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
                        <td>{formatStatus(trainee?.status)}</td>
                        <td>{trainee?.assignmentCount ?? 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState message="No associated trainees found for this trainer." />
            )}
          </>
        ) : null}

      </DashboardSection>
    </div>
  );
};

export default AdminUserDetailsPage;
