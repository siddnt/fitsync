import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DashboardSection from '../components/DashboardSection.jsx';
import EmptyState from '../components/EmptyState.jsx';
import SkeletonPanel from '../../../ui/SkeletonPanel.jsx';
import { useGetManagerGymDetailQuery, useDeleteGymByManagerMutation } from '../../../services/managerApi.js';
import { formatDate, formatStatus } from '../../../utils/format.js';
import '../Dashboard.css';

const currency = (v) => `₹${Number(v ?? 0).toLocaleString('en-IN')}`;
const stars = (n) => '★'.repeat(Math.round(n)) + '☆'.repeat(5 - Math.round(n));

const Collapsible = ({ title, count, defaultOpen = false, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`ud-collapse ${open ? 'ud-collapse--open' : ''}`}>
      <button type="button" className="ud-collapse__trigger" onClick={() => setOpen(!open)}>
        <span className="ud-collapse__arrow">{open ? '▾' : '▸'}</span>
        <span className="ud-collapse__title">{title}</span>
        {count != null && <span className="ud-collapse__count">{count}</span>}
      </button>
      {open && <div className="ud-collapse__body">{children}</div>}
    </div>
  );
};

const ManagerGymDetailPage = () => {
  const { gymId } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useGetManagerGymDetailQuery(gymId);
  const [deleteGym, { isLoading: isDeleting }] = useDeleteGymByManagerMutation();
  const [notice, setNotice] = useState(null);

  const gym = data?.data;

  const handleBack = () => navigate('/dashboard/manager/gyms');

  const handleDelete = async () => {
    setNotice(null);
    if (!window.confirm(`Remove "${gym?.name}"? This will cancel memberships and listings. This cannot be undone.`)) return;
    try {
      await deleteGym(gymId).unwrap();
      navigate('/dashboard/manager/gyms');
    } catch (err) {
      setNotice(err?.data?.message ?? 'Unable to delete gym.');
    }
  };

  if (isLoading) {
    return (
      <div className="dashboard-grid dashboard-grid--stacked ud-page">
        <DashboardSection title="Gym Detail"><SkeletonPanel lines={14} /></DashboardSection>
      </div>
    );
  }

  if (isError || !gym) {
    return (
      <div className="dashboard-grid dashboard-grid--stacked ud-page">
        <DashboardSection title="Gym Detail" action={<button type="button" onClick={handleBack}>← Back</button>}>
          <EmptyState message="Could not load gym details." />
        </DashboardSection>
      </div>
    );
  }

  const activeMembers = gym.members?.filter((m) => m.status === 'active') ?? [];
  const allMembers = gym.members ?? [];
  const activeAssignments = gym.assignments?.filter((a) => a.status === 'active') ?? [];

  return (
    <div className="dashboard-grid dashboard-grid--stacked ud-page">
      <div className="ud-actions">
        <button type="button" className="ud-btn ud-btn--back" onClick={handleBack}>← Back to Gyms</button>
        <button type="button" className="ud-btn ud-btn--outline" onClick={() => refetch()}>Refresh</button>
        <button type="button" className="ud-btn ud-btn--danger" onClick={handleDelete} disabled={isDeleting}>
          {isDeleting ? 'Removing…' : 'Delete Gym'}
        </button>
      </div>

      {notice && <div className="status-pill status-pill--warning">{notice}</div>}

      {/* Header */}
      <DashboardSection title={gym.name}>
        <div className="stat-grid">
          <div className="stat-card">
            <small>Status</small>
            <strong>
              <span className={`status-pill ${gym.status === 'active' ? 'status-pill--success' : 'status-pill--warning'}`}>
                {formatStatus(gym.status)}
              </span>
            </strong>
          </div>
          <div className="stat-card"><small>Published</small><strong>{gym.isPublished ? 'Yes' : 'No'}</strong></div>
          <div className="stat-card"><small>Active Members</small><strong>{activeMembers.length}</strong></div>
          <div className="stat-card"><small>Active Trainers</small><strong>{activeAssignments.length}</strong></div>
          <div className="stat-card"><small>Rating</small><strong>{gym.analytics?.rating ? `${gym.analytics.rating} ★` : '—'}</strong></div>
          <div className="stat-card"><small>Impressions</small><strong>{gym.analytics?.impressions ?? 0}</strong></div>
          <div className="stat-card"><small>Reviews</small><strong>{gym.reviews?.length ?? 0}</strong></div>
          <div className="stat-card"><small>Created</small><strong>{formatDate(gym.createdAt)}</strong></div>
        </div>
      </DashboardSection>

      {/* Info */}
      <DashboardSection title="Gym Information">
        <div className="ud-card">
          {gym.description && <p className="ud-card__desc" style={{ marginBottom: '0.75rem' }}>{gym.description}</p>}
          <p><strong>Location:</strong> {[gym.location?.address, gym.location?.city, gym.location?.state, gym.location?.postalCode].filter(Boolean).join(', ')}</p>
          {gym.pricing && <p><strong>Pricing:</strong> {currency(gym.pricing.monthlyPrice)}/mo (MRP: {currency(gym.pricing.monthlyMrp)})</p>}
          {gym.schedule && <p><strong>Schedule:</strong> {gym.schedule.openTime} – {gym.schedule.closeTime} · {(gym.schedule.workingDays ?? []).join(', ')}</p>}
          {gym.contact && (
            <div style={{ marginTop: '0.5rem' }}>
              <strong>Contact:</strong>
              {gym.contact.phone && <span style={{ marginLeft: '0.5rem' }}>📞 {gym.contact.phone}</span>}
              {gym.contact.email && <span style={{ marginLeft: '0.75rem' }}>✉ {gym.contact.email}</span>}
              {gym.contact.website && <span style={{ marginLeft: '0.75rem' }}>🌐 {gym.contact.website}</span>}
              {gym.contact.whatsapp && <span style={{ marginLeft: '0.75rem' }}>💬 {gym.contact.whatsapp}</span>}
            </div>
          )}
          {gym.amenities?.length > 0 && (
            <div style={{ marginTop: '0.6rem' }}>
              <strong>Amenities:</strong>
              <div className="ud-tags">{gym.amenities.map((a) => <span key={a} className="ud-tag">{a}</span>)}</div>
            </div>
          )}
          {gym.features?.length > 0 && (
            <div style={{ marginTop: '0.4rem' }}>
              <strong>Features:</strong>
              <div className="ud-tags">{gym.features.map((f) => <span key={f} className="ud-tag">{f}</span>)}</div>
            </div>
          )}
          {gym.keyFeatures?.length > 0 && (
            <div style={{ marginTop: '0.4rem' }}>
              <strong>Key Features:</strong>
              <div className="ud-tags">{gym.keyFeatures.map((f) => <span key={f} className="ud-tag">{f}</span>)}</div>
            </div>
          )}
          {gym.tags?.length > 0 && (
            <div style={{ marginTop: '0.4rem' }}>
              <strong>Tags:</strong>
              <div className="ud-tags">{gym.tags.map((t) => <span key={t} className="ud-tag">{t}</span>)}</div>
            </div>
          )}
        </div>
      </DashboardSection>

      {/* Owner */}
      <DashboardSection title="Owner">
        {gym.owner ? (
          <div className="ud-card">
            <div className="ud-card__row">
              {gym.owner.profilePicture
                ? <img className="ud-card__avatar" src={gym.owner.profilePicture} alt={gym.owner.name} />
                : <div className="user-detail__avatar user-detail__avatar--sm">{gym.owner.name?.charAt(0)?.toUpperCase()}</div>}
              <div className="ud-card__info">
                <p><strong>{gym.owner.name}</strong></p>
                <p>{gym.owner.email}</p>
                {gym.owner.contactNumber && <p>📞 {gym.owner.contactNumber}</p>}
              </div>
            </div>
          </div>
        ) : <EmptyState message="No owner information." />}
      </DashboardSection>

      {/* Sponsorship */}
      {gym.sponsorship && gym.sponsorship.status !== 'none' && (
        <DashboardSection title="Sponsorship">
          <div className="ud-card">
            <p><strong>Status:</strong>{' '}
              <span className={`status-pill ${gym.sponsorship.status === 'active' ? 'status-pill--success' : 'status-pill--warning'}`}>
                {formatStatus(gym.sponsorship.status)}
              </span>
            </p>
            {gym.sponsorship.package && <p><strong>Package:</strong> {gym.sponsorship.package}</p>}
            {gym.sponsorship.expiresAt && <p><strong>Expires:</strong> {formatDate(gym.sponsorship.expiresAt)}</p>}
          </div>
        </DashboardSection>
      )}

      {/* Members */}
      <DashboardSection title={`Members (${allMembers.length})`}>
        {allMembers.length === 0 ? <EmptyState message="No memberships found." /> : (
          <div className="ud-table-wrap">
            <table className="dashboard-table dashboard-table--compact">
              <thead>
                <tr><th>Member</th><th>Trainer</th><th>Plan</th><th>Status</th><th>Start</th><th>End</th><th>Billing</th></tr>
              </thead>
              <tbody>
                {allMembers.map((m) => (
                  <tr key={m.id}>
                    <td>{m.trainee?.name ?? '—'}<div><small>{m.trainee?.email}</small></div></td>
                    <td>{m.trainer?.name ?? '—'}</td>
                    <td>{m.plan}</td>
                    <td><span className={`status-pill ${m.status === 'active' ? 'status-pill--success' : 'status-pill--warning'}`}>{formatStatus(m.status)}</span></td>
                    <td>{formatDate(m.startDate)}</td>
                    <td>{formatDate(m.endDate)}</td>
                    <td>{m.billing ? `${currency(m.billing.amount)} (${formatStatus(m.billing.status)})` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DashboardSection>

      {/* Trainer Assignments */}
      <DashboardSection title={`Trainer Assignments (${gym.assignments?.length ?? 0})`}>
        {(gym.assignments?.length ?? 0) === 0 ? <EmptyState message="No trainer assignments." /> : (
          <div className="ud-table-wrap">
            <table className="dashboard-table dashboard-table--compact">
              <thead>
                <tr><th>Trainer</th><th>Status</th><th>Trainees</th><th>Approved</th><th>Created</th></tr>
              </thead>
              <tbody>
                {gym.assignments.map((a) => (
                  <tr key={a.id}>
                    <td>{a.trainer?.name ?? '—'}<div><small>{a.trainer?.email}</small></div></td>
                    <td><span className={`status-pill ${a.status === 'active' ? 'status-pill--success' : 'status-pill--warning'}`}>{formatStatus(a.status)}</span></td>
                    <td>{a.traineesCount}</td>
                    <td>{a.approvedAt ? formatDate(a.approvedAt) : '—'}</td>
                    <td>{formatDate(a.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DashboardSection>

      {/* Subscriptions */}
      <DashboardSection title={`Listing Subscriptions (${gym.subscriptions?.length ?? 0})`}>
        {(gym.subscriptions?.length ?? 0) === 0 ? <EmptyState message="No subscriptions." /> : (
          <div className="ud-table-wrap">
            <table className="dashboard-table dashboard-table--compact">
              <thead>
                <tr><th>Plan</th><th>Amount</th><th>Status</th><th>Period Start</th><th>Period End</th><th>Auto-Renew</th></tr>
              </thead>
              <tbody>
                {gym.subscriptions.map((s) => (
                  <tr key={s.id}>
                    <td>{s.planCode}</td>
                    <td>{currency(s.amount)}</td>
                    <td><span className={`status-pill ${s.status === 'active' ? 'status-pill--success' : 'status-pill--warning'}`}>{formatStatus(s.status)}</span></td>
                    <td>{formatDate(s.periodStart)}</td>
                    <td>{formatDate(s.periodEnd)}</td>
                    <td>{s.autoRenew ? 'Yes' : 'No'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DashboardSection>

      {/* Reviews */}
      <DashboardSection title={`Reviews (${gym.reviews?.length ?? 0})`}>
        {(gym.reviews?.length ?? 0) === 0 ? <EmptyState message="No reviews yet." /> : (
          gym.reviews.map((r) => (
            <Collapsible key={r.id} title={r.user?.name ?? 'Anonymous'} count={stars(r.rating)}>
              <div className="ud-card">
                <div className="ud-card__row">
                  {r.user?.profilePicture
                    ? <img className="ud-card__avatar" src={r.user.profilePicture} alt="" />
                    : <div className="user-detail__avatar user-detail__avatar--sm">{r.user?.name?.charAt(0)?.toUpperCase() ?? '?'}</div>}
                  <div className="ud-card__info">
                    <p><strong>{r.user?.name}</strong> · <span className="ud-stars">{stars(r.rating)}</span></p>
                    <p>{r.user?.email}</p>
                    {r.comment && <p className="ud-card__desc">{r.comment}</p>}
                    <p className="text-muted">{formatDate(r.createdAt)}</p>
                  </div>
                </div>
              </div>
            </Collapsible>
          ))
        )}
      </DashboardSection>

      {/* Gallery */}
      {(gym.gallery?.length > 0 || gym.images?.length > 0 || gym.galleryImages?.length > 0) && (
        <DashboardSection title="Gallery">
          <div className="gym-detail__gallery-grid">
            {[...(gym.images ?? []), ...(gym.galleryImages ?? [])].map((url, i) => (
              <img key={`img-${i}`} src={url} alt={`${gym.name} ${i + 1}`} className="gym-detail__gallery-img" />
            ))}
            {(gym.gallery ?? []).map((g) => (
              <div key={g.id} className="gym-detail__gallery-item">
                <img src={g.imageUrl} alt={g.title} className="gym-detail__gallery-img" />
                {g.title && <small>{g.title}</small>}
              </div>
            ))}
          </div>
        </DashboardSection>
      )}
    </div>
  );
};

export default ManagerGymDetailPage;
