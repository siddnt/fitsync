import { useState } from 'react';
import DashboardSection from './DashboardSection.jsx';
import EmptyState from './EmptyState.jsx';
import { formatDate, formatStatus } from '../../../utils/format.js';

/* ── helpers ── */
export const currency = (v) => `₹${Number(v ?? 0).toLocaleString('en-IN')}`;
const stars = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);

/* ── Collapsible section ── */
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

/* ── Stat card ── */
const Stat = ({ label, value }) => (
  <div className="user-detail__stat">
    <span className="user-detail__stat-value">{value}</span>
    <span className="user-detail__stat-label">{label}</span>
  </div>
);

/* ══════════════════════════════════════
   SELLER DEEP VIEW
   ══════════════════════════════════════ */
export const SellerView = ({ seller }) => {
  const { stats, products, orders, reviews, payouts } = seller;
  return (
    <>
      <DashboardSection title="Seller Overview">
        <div className="user-detail__stats">
          <Stat label="Products" value={stats.totalProducts} />
          <Stat label="Published" value={stats.publishedProducts} />
          <Stat label="Items Sold" value={stats.totalItemsSold} />
          <Stat label="Delivered" value={stats.deliveredItems} />
          <Stat label="Revenue" value={currency(stats.totalRevenue)} />
          <Stat label="Payouts" value={currency(stats.totalPayout)} />
          <Stat label="Reviews" value={stats.totalReviews} />
          <Stat label="Avg Rating" value={stats.avgRating || '—'} />
        </div>
      </DashboardSection>

      {/* Products */}
      <DashboardSection title={`Products (${products.length})`}>
        {products.length === 0 ? <EmptyState message="No products listed." /> : (
          products.map((p) => (
            <Collapsible key={p.id} title={p.name} count={`${currency(p.price)} · stock ${p.stock}`}>
              <div className="ud-card">
                <div className="ud-card__row">
                  {p.image && <img className="ud-card__thumb" src={p.image} alt={p.name} />}
                  <div className="ud-card__info">
                    <p><strong>Category:</strong> {formatStatus(p.category)}</p>
                    <p><strong>MRP:</strong> {currency(p.mrp)} · <strong>Price:</strong> {currency(p.price)}</p>
                    <p><strong>Stock:</strong> {p.stock} · <strong>Status:</strong> {formatStatus(p.status)}</p>
                    <p><strong>Published:</strong> {p.isPublished ? 'Yes' : 'No'}</p>
                    <p><strong>Reviews:</strong> {p.reviewCount}</p>
                    {p.description && <p className="text-muted ud-card__desc">{p.description}</p>}
                    <p className="text-muted">Listed {formatDate(p.createdAt)}</p>
                  </div>
                </div>
              </div>
            </Collapsible>
          ))
        )}
      </DashboardSection>

      {/* Sold Items */}
      <DashboardSection title={`Sold Items (${orders.length})`}>
        {orders.length === 0 ? <EmptyState message="No items sold yet." /> : (
          <div className="ud-table-wrap">
            <table className="dashboard-table dashboard-table--compact">
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Product</th>
                  <th>Buyer</th>
                  <th>Qty</th>
                  <th>Price</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o, i) => (
                  <tr key={i}>
                    <td>{o.orderNumber}</td>
                    <td>
                      <div className="ud-inline-img">
                        {o.image && <img src={o.image} alt="" />}
                        <span>{o.productName}</span>
                      </div>
                    </td>
                    <td>{o.buyer?.name ?? '—'}<div><small className="text-muted">{o.buyer?.email}</small></div></td>
                    <td>{o.quantity}</td>
                    <td>{currency(o.price)}</td>
                    <td><span className={`status-pill status-pill--${o.status === 'delivered' ? 'success' : 'default'}`}>{formatStatus(o.status)}</span></td>
                    <td>{formatDate(o.orderDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DashboardSection>

      {/* Product Reviews */}
      <DashboardSection title={`Product Reviews (${reviews.length})`}>
        {reviews.length === 0 ? <EmptyState message="No reviews received." /> : (
          <div className="ud-table-wrap">
            <table className="dashboard-table dashboard-table--compact">
              <thead>
                <tr><th>Product</th><th>Reviewer</th><th>Rating</th><th>Title</th><th>Comment</th><th>Verified</th><th>Date</th></tr>
              </thead>
              <tbody>
                {reviews.map((r) => (
                  <tr key={r.id}>
                    <td>{r.product}</td>
                    <td>{r.reviewer}</td>
                    <td className="ud-stars">{stars(r.rating)}</td>
                    <td>{r.title || '—'}</td>
                    <td className="admin-review-comment">{r.comment}</td>
                    <td>{r.isVerifiedPurchase ? '✓' : '—'}</td>
                    <td>{formatDate(r.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DashboardSection>

      {/* Payouts */}
      {payouts.length > 0 && (
        <DashboardSection title={`Payout Records (${payouts.length})`}>
          <div className="ud-table-wrap">
            <table className="dashboard-table dashboard-table--compact">
              <thead>
                <tr><th>Amount</th><th>Type</th><th>Date</th></tr>
              </thead>
              <tbody>
                {payouts.map((p) => (
                  <tr key={p.id}>
                    <td>{currency(p.amount)}</td>
                    <td>{formatStatus(p.type)}</td>
                    <td>{formatDate(p.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DashboardSection>
      )}
    </>
  );
};

/* ══════════════════════════════════════
   GYM OWNER DEEP VIEW
   ══════════════════════════════════════ */
export const GymOwnerView = ({ gymOwner }) => {
  const { stats, gyms, subscriptions } = gymOwner;
  return (
    <>
      <DashboardSection title="Gym Owner Overview">
        <div className="user-detail__stats">
          <Stat label="Gyms" value={stats.totalGyms} />
          <Stat label="Published" value={stats.publishedGyms} />
          <Stat label="Total Members" value={stats.totalMembers} />
          <Stat label="Active Members" value={stats.activeMembers} />
          <Stat label="Trainers" value={stats.totalTrainers} />
          <Stat label="Active Trainers" value={stats.activeTrainers} />
          <Stat label="Reviews" value={stats.totalReviews} />
          <Stat label="Impressions" value={stats.totalImpressions} />
        </div>
      </DashboardSection>

      {/* Each gym is a collapsible with deep data */}
      {gyms.map((gym) => (
        <DashboardSection key={gym.id} title={gym.name} className="ud-gym-section">
          <div className="ud-gym-header">
            <div className="user-detail__stats">
              <Stat label="Members" value={`${gym.memberStats.active}/${gym.memberStats.total}`} />
              <Stat label="Trainers" value={`${gym.trainerStats.active}/${gym.trainerStats.total}`} />
              <Stat label="Reviews" value={gym.reviews.length} />
              <Stat label="Impressions" value={gym.analytics?.impressions ?? 0} />
              <Stat label="Rating" value={gym.analytics?.rating ? `${gym.analytics.rating} (${gym.analytics.ratingCount})` : '—'} />
              <Stat label="Sponsorship" value={formatStatus(gym.sponsorship?.status ?? 'none')} />
            </div>
            <div className="ud-gym-meta">
              <div className="user-detail__grid">
                <div className="user-detail__item"><span className="user-detail__label">City</span><span>{gym.location?.city ?? '—'}, {gym.location?.state ?? ''}</span></div>
                <div className="user-detail__item"><span className="user-detail__label">Address</span><span>{gym.location?.address ?? '—'}</span></div>
                <div className="user-detail__item"><span className="user-detail__label">Status</span><span>{formatStatus(gym.status)}</span></div>
                <div className="user-detail__item"><span className="user-detail__label">Published</span><span>{gym.isPublished ? 'Yes' : 'No'}</span></div>
                <div className="user-detail__item"><span className="user-detail__label">Pricing</span><span>{gym.pricing ? `${currency(gym.pricing.monthlyPrice)} / mo (MRP ${currency(gym.pricing.monthlyMrp)})` : '—'}</span></div>
                {gym.schedule && <div className="user-detail__item"><span className="user-detail__label">Schedule</span><span>{gym.schedule.openTime}–{gym.schedule.closeTime} · {(gym.schedule.workingDays || []).join(', ')}</span></div>}
                {gym.contact?.phone && <div className="user-detail__item"><span className="user-detail__label">Phone</span><span>{gym.contact.phone}</span></div>}
                {gym.contact?.email && <div className="user-detail__item"><span className="user-detail__label">Email</span><span>{gym.contact.email}</span></div>}
              </div>
              {gym.features?.length > 0 && (
                <div className="ud-tags">
                  <span className="user-detail__label">Features:</span>
                  {gym.features.map((f, i) => <span key={i} className="ud-tag">{f}</span>)}
                </div>
              )}
              {gym.amenities?.length > 0 && (
                <div className="ud-tags">
                  <span className="user-detail__label">Amenities:</span>
                  {gym.amenities.map((a, i) => <span key={i} className="ud-tag">{a}</span>)}
                </div>
              )}
              {gym.description && <p className="text-muted ud-card__desc">{gym.description}</p>}
            </div>
          </div>

          {/* Members */}
          <Collapsible title="Members" count={gym.members.length} defaultOpen={false}>
            {gym.members.length === 0 ? <EmptyState message="No members." /> : (
              <div className="ud-table-wrap">
                <table className="dashboard-table dashboard-table--compact">
                  <thead>
                    <tr><th>Trainee</th><th>Email</th><th>Phone</th><th>Plan</th><th>Status</th><th>Trainer</th><th>Period</th><th>Billing</th></tr>
                  </thead>
                  <tbody>
                    {gym.members.map((m) => (
                      <tr key={m.id}>
                        <td>
                          <div className="ud-inline-img">
                            {m.trainee?.profilePicture && <img src={m.trainee.profilePicture} alt="" />}
                            <span>{m.trainee?.name ?? '—'}</span>
                          </div>
                        </td>
                        <td>{m.trainee?.email ?? '—'}</td>
                        <td>{m.trainee?.contactNumber ?? '—'}</td>
                        <td>{formatStatus(m.plan)}</td>
                        <td><span className={`status-pill status-pill--${m.status === 'active' ? 'success' : 'default'}`}>{formatStatus(m.status)}</span></td>
                        <td>{m.trainer?.name ?? '—'}</td>
                        <td>{formatDate(m.startDate)} – {formatDate(m.endDate)}</td>
                        <td>{m.billing ? `${currency(m.billing.amount)} (${formatStatus(m.billing.status)})` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Collapsible>

          {/* Trainers */}
          <Collapsible title="Trainers" count={gym.trainers.length} defaultOpen={false}>
            {gym.trainers.length === 0 ? <EmptyState message="No trainers assigned." /> : (
              gym.trainers.map((a) => (
                <div key={a.id} className="ud-card">
                  <div className="ud-card__row">
                    {a.trainer?.profilePicture && <img className="ud-card__avatar" src={a.trainer.profilePicture} alt="" />}
                    <div className="ud-card__info">
                      <p><strong>{a.trainer?.name ?? '—'}</strong> · {a.trainer?.email}</p>
                      {a.trainer?.contactNumber && <p className="text-muted">Phone: {a.trainer.contactNumber}</p>}
                      <p>Status: <span className={`status-pill status-pill--${a.status === 'active' ? 'success' : 'default'}`}>{formatStatus(a.status)}</span></p>
                      {a.approvedAt && <p className="text-muted">Approved: {formatDate(a.approvedAt)}</p>}
                    </div>
                  </div>
                  {a.trainees.length > 0 && (
                    <div className="ud-sub-section">
                      <p className="user-detail__label">Assigned Trainees ({a.trainees.length}):</p>
                      <div className="ud-table-wrap">
                        <table className="dashboard-table dashboard-table--compact">
                          <thead>
                            <tr><th>Trainee</th><th>Email</th><th>Status</th><th>Goals</th><th>Assigned</th></tr>
                          </thead>
                          <tbody>
                            {a.trainees.map((t, i) => (
                              <tr key={i}>
                                <td>{t.trainee?.name ?? '—'}</td>
                                <td>{t.trainee?.email ?? '—'}</td>
                                <td>{formatStatus(t.status)}</td>
                                <td>{(t.goals || []).join(', ') || '—'}</td>
                                <td>{formatDate(t.assignedAt)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </Collapsible>

          {/* Reviews */}
          <Collapsible title="Reviews" count={gym.reviews.length} defaultOpen={false}>
            {gym.reviews.length === 0 ? <EmptyState message="No reviews." /> : (
              <div className="ud-table-wrap">
                <table className="dashboard-table dashboard-table--compact">
                  <thead>
                    <tr><th>User</th><th>Rating</th><th>Comment</th><th>Date</th></tr>
                  </thead>
                  <tbody>
                    {gym.reviews.map((r) => (
                      <tr key={r.id}>
                        <td>
                          <div className="ud-inline-img">
                            {r.user?.profilePicture && <img src={r.user.profilePicture} alt="" />}
                            <span>{r.user?.name ?? '—'}</span>
                          </div>
                        </td>
                        <td className="ud-stars">{stars(r.rating)}</td>
                        <td className="admin-review-comment">{r.comment}</td>
                        <td>{formatDate(r.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Collapsible>
        </DashboardSection>
      ))}

      {/* Listing Subscriptions */}
      {subscriptions.length > 0 && (
        <DashboardSection title={`Listing Subscriptions (${subscriptions.length})`}>
          <div className="ud-table-wrap">
            <table className="dashboard-table dashboard-table--compact">
              <thead>
                <tr><th>Gym</th><th>Plan</th><th>Amount</th><th>Status</th><th>Auto-Renew</th><th>Period</th><th>Invoices</th></tr>
              </thead>
              <tbody>
                {subscriptions.map((s) => (
                  <tr key={s.id}>
                    <td>{s.gym ?? '—'}</td>
                    <td>{formatStatus(s.planCode)}</td>
                    <td>{currency(s.amount)}</td>
                    <td><span className={`status-pill status-pill--${s.status === 'active' ? 'success' : 'default'}`}>{formatStatus(s.status)}</span></td>
                    <td>{s.autoRenew ? 'Yes' : 'No'}</td>
                    <td>{formatDate(s.periodStart)} – {formatDate(s.periodEnd)}</td>
                    <td>{s.invoiceCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DashboardSection>
      )}
    </>
  );
};

/* ══════════════════════════════════════
   TRAINER DEEP VIEW
   ══════════════════════════════════════ */
export const TrainerView = ({ trainer }) => {
  const { stats, assignments, recentProgress } = trainer;
  return (
    <>
      <DashboardSection title="Trainer Overview">
        <div className="user-detail__stats">
          <Stat label="Assignments" value={stats.totalAssignments} />
          <Stat label="Active" value={stats.activeAssignments} />
          <Stat label="Total Trainees" value={stats.totalTrainees} />
          <Stat label="Active Trainees" value={stats.activeTrainees} />
        </div>
      </DashboardSection>

      {assignments.map((a) => (
        <DashboardSection key={a.id} title={a.gym?.name ?? 'Unknown Gym'}>
          <div className="ud-gym-meta">
            <div className="user-detail__grid">
              <div className="user-detail__item"><span className="user-detail__label">City</span><span>{a.gym?.city ?? '—'}, {a.gym?.state ?? ''}</span></div>
              <div className="user-detail__item"><span className="user-detail__label">Status</span><span className={`status-pill status-pill--${a.status === 'active' ? 'success' : 'default'}`}>{formatStatus(a.status)}</span></div>
              {a.approvedAt && <div className="user-detail__item"><span className="user-detail__label">Approved</span><span>{formatDate(a.approvedAt)}</span></div>}
              {a.notes && <div className="user-detail__item user-detail__item--full"><span className="user-detail__label">Notes</span><span>{a.notes}</span></div>}
            </div>
          </div>
          <Collapsible title="Assigned Trainees" count={a.trainees.length} defaultOpen>
            {a.trainees.length === 0 ? <EmptyState message="No trainees assigned." /> : (
              <div className="ud-table-wrap">
                <table className="dashboard-table dashboard-table--compact">
                  <thead>
                    <tr><th>Trainee</th><th>Email</th><th>Phone</th><th>Age</th><th>Gender</th><th>Status</th><th>Goals</th><th>Assigned</th></tr>
                  </thead>
                  <tbody>
                    {a.trainees.map((t, i) => (
                      <tr key={i}>
                        <td>
                          <div className="ud-inline-img">
                            {t.trainee?.profilePicture && <img src={t.trainee.profilePicture} alt="" />}
                            <span>{t.trainee?.name ?? '—'}</span>
                          </div>
                        </td>
                        <td>{t.trainee?.email ?? '—'}</td>
                        <td>{t.trainee?.contactNumber ?? '—'}</td>
                        <td>{t.trainee?.age ?? '—'}</td>
                        <td>{t.trainee?.gender ? formatStatus(t.trainee.gender) : '—'}</td>
                        <td><span className={`status-pill status-pill--${t.status === 'active' ? 'success' : 'default'}`}>{formatStatus(t.status)}</span></td>
                        <td>{(t.goals || []).join(', ') || '—'}</td>
                        <td>{formatDate(t.assignedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Collapsible>
        </DashboardSection>
      ))}

      {recentProgress?.length > 0 && (
        <DashboardSection title={`Recent Progress Updates (${recentProgress.length})`}>
          <div className="ud-table-wrap">
            <table className="dashboard-table dashboard-table--compact">
              <thead>
                <tr><th>Trainee</th><th>Update</th><th>Date</th></tr>
              </thead>
              <tbody>
                {recentProgress.map((p) => (
                  <tr key={p.id}>
                    <td>{p.trainee}</td>
                    <td>{p.update}</td>
                    <td>{formatDate(p.date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DashboardSection>
      )}
    </>
  );
};

/* ══════════════════════════════════════
   TRAINEE / USER DEEP VIEW
   ══════════════════════════════════════ */
export const TraineeView = ({ trainee }) => {
  const { stats, memberships, orders, gymReviews, productReviews, progress } = trainee;
  return (
    <>
      <DashboardSection title="Member Overview">
        <div className="user-detail__stats">
          <Stat label="Memberships" value={stats.totalMemberships} />
          <Stat label="Active" value={stats.activeMemberships} />
          <Stat label="Orders" value={stats.totalOrders} />
          <Stat label="Total Spent" value={currency(stats.totalSpent)} />
          <Stat label="Gym Reviews" value={stats.totalGymReviews} />
          <Stat label="Product Reviews" value={stats.totalProductReviews} />
        </div>
      </DashboardSection>

      {/* Memberships */}
      <DashboardSection title={`Memberships (${memberships.length})`}>
        {memberships.length === 0 ? <EmptyState message="No memberships." /> : (
          memberships.map((m) => (
            <Collapsible key={m.id} title={m.gym?.name ?? 'Unknown Gym'} count={formatStatus(m.status)}>
              <div className="ud-card">
                <div className="user-detail__grid">
                  <div className="user-detail__item"><span className="user-detail__label">City</span><span>{m.gym?.city ?? '—'}, {m.gym?.state ?? ''}</span></div>
                  <div className="user-detail__item"><span className="user-detail__label">Plan</span><span>{formatStatus(m.plan)}</span></div>
                  <div className="user-detail__item"><span className="user-detail__label">Status</span><span className={`status-pill status-pill--${m.status === 'active' ? 'success' : 'default'}`}>{formatStatus(m.status)}</span></div>
                  <div className="user-detail__item"><span className="user-detail__label">Trainer</span><span>{m.trainer?.name ?? 'None'}{m.trainer?.email ? ` (${m.trainer.email})` : ''}</span></div>
                  <div className="user-detail__item"><span className="user-detail__label">Period</span><span>{formatDate(m.startDate)} – {formatDate(m.endDate)}</span></div>
                  <div className="user-detail__item"><span className="user-detail__label">Auto-Renew</span><span>{m.autoRenew ? 'Yes' : 'No'}</span></div>
                  {m.billing && <div className="user-detail__item"><span className="user-detail__label">Billing</span><span>{currency(m.billing.amount)} · {formatStatus(m.billing.status)}</span></div>}
                  {m.benefits?.length > 0 && <div className="user-detail__item user-detail__item--full"><span className="user-detail__label">Benefits</span><span>{m.benefits.join(', ')}</span></div>}
                  {m.notes && <div className="user-detail__item user-detail__item--full"><span className="user-detail__label">Notes</span><span>{m.notes}</span></div>}
                </div>
              </div>
            </Collapsible>
          ))
        )}
      </DashboardSection>

      {/* Orders */}
      <DashboardSection title={`Orders (${orders.length})`}>
        {orders.length === 0 ? <EmptyState message="No orders placed." /> : (
          orders.map((o) => (
            <Collapsible key={o.id} title={`#${o.orderNumber}`} count={`${currency(o.total)} · ${formatStatus(o.status)}`}>
              <div className="ud-card">
                <div className="user-detail__grid">
                  <div className="user-detail__item"><span className="user-detail__label">Total</span><span>{currency(o.total)}</span></div>
                  <div className="user-detail__item"><span className="user-detail__label">Status</span><span>{formatStatus(o.status)}</span></div>
                  <div className="user-detail__item"><span className="user-detail__label">Date</span><span>{formatDate(o.createdAt)}</span></div>
                  {o.shippingAddress && (
                    <div className="user-detail__item user-detail__item--full">
                      <span className="user-detail__label">Shipping</span>
                      <span>{o.shippingAddress.firstName} {o.shippingAddress.lastName}, {o.shippingAddress.address}, {o.shippingAddress.city} {o.shippingAddress.postalCode}</span>
                    </div>
                  )}
                </div>
                {o.items?.length > 0 && (
                  <div className="ud-table-wrap" style={{ marginTop: '0.5rem' }}>
                    <table className="dashboard-table dashboard-table--compact">
                      <thead>
                        <tr><th>Product</th><th>Category</th><th>Qty</th><th>Price</th><th>Status</th></tr>
                      </thead>
                      <tbody>
                        {o.items.map((item, i) => (
                          <tr key={i}>
                            <td>
                              <div className="ud-inline-img">
                                {item.image && <img src={item.image} alt="" />}
                                <span>{item.product}</span>
                              </div>
                            </td>
                            <td>{item.category ? formatStatus(item.category) : '—'}</td>
                            <td>{item.quantity}</td>
                            <td>{currency(item.price)}</td>
                            <td><span className={`status-pill status-pill--${item.status === 'delivered' ? 'success' : 'default'}`}>{formatStatus(item.status)}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </Collapsible>
          ))
        )}
      </DashboardSection>

      {/* Gym Reviews */}
      {gymReviews?.length > 0 && (
        <DashboardSection title={`Gym Reviews (${gymReviews.length})`}>
          <div className="ud-table-wrap">
            <table className="dashboard-table dashboard-table--compact">
              <thead>
                <tr><th>Gym</th><th>Rating</th><th>Comment</th><th>Date</th></tr>
              </thead>
              <tbody>
                {gymReviews.map((r) => (
                  <tr key={r.id}>
                    <td>{r.gym}</td>
                    <td className="ud-stars">{stars(r.rating)}</td>
                    <td className="admin-review-comment">{r.comment}</td>
                    <td>{formatDate(r.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DashboardSection>
      )}

      {/* Product Reviews */}
      {productReviews?.length > 0 && (
        <DashboardSection title={`Product Reviews (${productReviews.length})`}>
          <div className="ud-table-wrap">
            <table className="dashboard-table dashboard-table--compact">
              <thead>
                <tr><th>Product</th><th>Rating</th><th>Title</th><th>Comment</th><th>Verified</th><th>Date</th></tr>
              </thead>
              <tbody>
                {productReviews.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div className="ud-inline-img">
                        {r.image && <img src={r.image} alt="" />}
                        <span>{r.product}</span>
                      </div>
                    </td>
                    <td className="ud-stars">{stars(r.rating)}</td>
                    <td>{r.title || '—'}</td>
                    <td className="admin-review-comment">{r.comment}</td>
                    <td>{r.isVerifiedPurchase ? '✓' : '—'}</td>
                    <td>{formatDate(r.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DashboardSection>
      )}

      {/* Progress */}
      {progress?.length > 0 && (
        <DashboardSection title={`Training Progress (${progress.length})`}>
          <div className="ud-table-wrap">
            <table className="dashboard-table dashboard-table--compact">
              <thead>
                <tr><th>Trainer</th><th>Update</th><th>Date</th></tr>
              </thead>
              <tbody>
                {progress.map((p) => (
                  <tr key={p.id}>
                    <td>{p.trainer}</td>
                    <td>{p.update}</td>
                    <td>{formatDate(p.date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DashboardSection>
      )}
    </>
  );
};

/* ══════════════════════════════════════
   USER PROFILE HEADER (shared)
   ══════════════════════════════════════ */
export const UserProfileHeader = ({ user, notice, actionSlot }) => (
  <DashboardSection title="User Profile">
    {notice && (
      <div className="status-pill status-pill--warning" style={{ marginBottom: '0.75rem' }}>{notice}</div>
    )}
    <div className="user-detail__header">
      {user.profilePicture ? (
        <img className="user-detail__avatar user-detail__avatar--lg" src={user.profilePicture} alt={user.name} />
      ) : (
        <div className="user-detail__avatar user-detail__avatar--lg user-detail__avatar--placeholder">
          {user.name?.charAt(0) ?? '?'}
        </div>
      )}
      <div className="user-detail__meta">
        <h2 style={{ margin: 0 }}>{user.name}</h2>
        <p className="text-muted" style={{ margin: '0.15rem 0' }}>{user.email}</p>
        <div className="user-detail__badges">
          <span className={`status-pill status-pill--${user.role}`}>{formatStatus(user.role)}</span>
          <span className={`status-pill status-pill--${user.status === 'active' ? 'success' : user.status === 'suspended' ? 'warning' : 'default'}`}>{formatStatus(user.status)}</span>
        </div>
      </div>
    </div>

    <div className="user-detail__grid">
      {user.contactNumber && <div className="user-detail__item"><span className="user-detail__label">Phone</span><span>{user.contactNumber}</span></div>}
      {user.age && <div className="user-detail__item"><span className="user-detail__label">Age</span><span>{user.age}</span></div>}
      {user.gender && <div className="user-detail__item"><span className="user-detail__label">Gender</span><span>{formatStatus(user.gender)}</span></div>}
      <div className="user-detail__item"><span className="user-detail__label">Joined</span><span>{formatDate(user.createdAt)}</span></div>
      {user.profile?.headline && <div className="user-detail__item user-detail__item--full"><span className="user-detail__label">Headline</span><span>{user.profile.headline}</span></div>}
      {user.profile?.bio && <div className="user-detail__item user-detail__item--full"><span className="user-detail__label">Bio</span><span>{user.profile.bio}</span></div>}
    </div>

    {actionSlot && <div className="ud-actions" style={{ marginTop: '1rem' }}>{actionSlot}</div>}
  </DashboardSection>
);

/* ══════════════════════════════════════
   ROLE-SPECIFIC SECTIONS (shared)
   ══════════════════════════════════════ */
export const RoleSections = ({ detail }) => (
  <>
    {detail.seller && <SellerView seller={detail.seller} />}
    {detail.gymOwner && <GymOwnerView gymOwner={detail.gymOwner} />}
    {detail.trainer && <TrainerView trainer={detail.trainer} />}
    {detail.trainee && <TraineeView trainee={detail.trainee} />}

    {detail.manager && (
      <DashboardSection title="Manager Role">
        <p className="text-muted">This user has the Manager role — they can approve sellers and gym-owners, moderate listings and handle support messages.</p>
      </DashboardSection>
    )}
    {detail.admin && (
      <DashboardSection title="Administrator">
        <p className="text-muted">This is a platform administrator with full system access.</p>
      </DashboardSection>
    )}
  </>
);
