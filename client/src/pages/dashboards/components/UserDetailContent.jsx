import DashboardSection from './DashboardSection.jsx';
import EmptyState from './EmptyState.jsx';
import { formatDate, formatStatus } from '../../../utils/format.js';

const formatInr = (value) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(
    Number(value ?? 0),
  );

const renderStars = (count = 0) => `${'*'.repeat(Math.max(0, Math.round(count)))}${'-'.repeat(Math.max(0, 5 - Math.round(count)))}`;

const Stat = ({ label, value }) => (
  <div className="user-detail__stat">
    <span className="user-detail__stat-value">{value}</span>
    <span className="user-detail__stat-label">{label}</span>
  </div>
);

export const UserProfileHeader = ({ user, notice, actionSlot }) => (
  <DashboardSection title="User Profile">
    {notice ? (
      <div className="status-pill status-pill--warning" style={{ marginBottom: '0.75rem' }}>
        {notice}
      </div>
    ) : null}
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
          <span className="status-pill status-pill--info">{formatStatus(user.role)}</span>
          <span className={`status-pill status-pill--${user.status === 'active' ? 'success' : 'warning'}`}>
            {formatStatus(user.status)}
          </span>
        </div>
      </div>
    </div>

    <div className="user-detail__grid">
      {user.contactNumber ? (
        <div className="user-detail__item">
          <span className="user-detail__label">Phone</span>
          <span>{user.contactNumber}</span>
        </div>
      ) : null}
      {user.age ? (
        <div className="user-detail__item">
          <span className="user-detail__label">Age</span>
          <span>{user.age}</span>
        </div>
      ) : null}
      {user.gender ? (
        <div className="user-detail__item">
          <span className="user-detail__label">Gender</span>
          <span>{formatStatus(user.gender)}</span>
        </div>
      ) : null}
      <div className="user-detail__item">
        <span className="user-detail__label">Joined</span>
        <span>{formatDate(user.createdAt)}</span>
      </div>
      {user.profile?.headline ? (
        <div className="user-detail__item user-detail__item--full">
          <span className="user-detail__label">Headline</span>
          <span>{user.profile.headline}</span>
        </div>
      ) : null}
      {user.profile?.bio ? (
        <div className="user-detail__item user-detail__item--full">
          <span className="user-detail__label">Bio</span>
          <span>{user.profile.bio}</span>
        </div>
      ) : null}
    </div>

    {actionSlot ? <div className="ud-actions" style={{ marginTop: '1rem' }}>{actionSlot}</div> : null}
  </DashboardSection>
);

const SellerView = ({ seller }) => (
  <>
    <DashboardSection title="Seller Overview">
      <div className="user-detail__stats">
        <Stat label="Products" value={seller.stats.totalProducts} />
        <Stat label="Published" value={seller.stats.publishedProducts} />
        <Stat label="Items Sold" value={seller.stats.totalItemsSold} />
        <Stat label="Delivered" value={seller.stats.deliveredItems} />
        <Stat label="Revenue" value={formatInr(seller.stats.totalRevenue)} />
        <Stat label="Payouts" value={formatInr(seller.stats.totalPayout)} />
      </div>
    </DashboardSection>

    <DashboardSection title={`Products (${seller.products.length})`}>
      {seller.products.length ? (
        <div className="ud-table-wrap">
          <table className="dashboard-table dashboard-table--compact">
            <thead>
              <tr>
                <th>Product</th>
                <th>Price</th>
                <th>Stock</th>
                <th>Status</th>
                <th>Reviews</th>
              </tr>
            </thead>
            <tbody>
              {seller.products.map((product) => (
                <tr key={product.id}>
                  <td>{product.name}</td>
                  <td>{formatInr(product.price)}</td>
                  <td>{product.stock}</td>
                  <td>{formatStatus(product.status)}</td>
                  <td>{product.reviewCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <EmptyState message="No products listed." />}
    </DashboardSection>

    <DashboardSection title={`Sold Items (${seller.orders.length})`}>
      {seller.orders.length ? (
        <div className="ud-table-wrap">
          <table className="dashboard-table dashboard-table--compact">
            <thead>
              <tr>
                <th>Order</th>
                <th>Product</th>
                <th>Buyer</th>
                <th>Qty</th>
                <th>Price</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {seller.orders.map((order, index) => (
                <tr key={`${order.orderId}-${index}`}>
                  <td>{order.orderNumber}</td>
                  <td>{order.productName}</td>
                  <td>{order.buyer?.name ?? '-'}</td>
                  <td>{order.quantity}</td>
                  <td>{formatInr(order.price)}</td>
                  <td>{formatStatus(order.status)}</td>
                  <td>{formatDate(order.orderDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <EmptyState message="No sold items yet." />}
    </DashboardSection>

    {seller.reviews.length ? (
      <DashboardSection title={`Product Reviews (${seller.reviews.length})`}>
        <div className="ud-table-wrap">
          <table className="dashboard-table dashboard-table--compact">
            <thead>
              <tr>
                <th>Product</th>
                <th>Reviewer</th>
                <th>Rating</th>
                <th>Comment</th>
              </tr>
            </thead>
            <tbody>
              {seller.reviews.map((review) => (
                <tr key={review.id}>
                  <td>{review.product}</td>
                  <td>{review.reviewer}</td>
                  <td>{renderStars(review.rating)}</td>
                  <td>{review.comment || review.title || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DashboardSection>
    ) : null}

    {seller.payouts.length ? (
      <DashboardSection title={`Payout Records (${seller.payouts.length})`}>
        <div className="ud-table-wrap">
          <table className="dashboard-table dashboard-table--compact">
            <thead>
              <tr>
                <th>Amount</th>
                <th>Type</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {seller.payouts.map((entry) => (
                <tr key={entry.id}>
                  <td>{formatInr(entry.amount)}</td>
                  <td>{formatStatus(entry.type)}</td>
                  <td>{formatDate(entry.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DashboardSection>
    ) : null}
  </>
);

const GymOwnerView = ({ gymOwner }) => (
  <>
    <DashboardSection title="Gym Owner Overview">
      <div className="user-detail__stats">
        <Stat label="Gyms" value={gymOwner.stats.totalGyms} />
        <Stat label="Published" value={gymOwner.stats.publishedGyms} />
        <Stat label="Members" value={gymOwner.stats.totalMembers} />
        <Stat label="Active Members" value={gymOwner.stats.activeMembers} />
        <Stat label="Trainers" value={gymOwner.stats.totalTrainers} />
        <Stat label="Reviews" value={gymOwner.stats.totalReviews} />
      </div>
    </DashboardSection>

    <DashboardSection title={`Gyms (${gymOwner.gyms.length})`}>
      {gymOwner.gyms.length ? (
        gymOwner.gyms.map((gym) => (
          <div key={gym.id} className="detail-card" style={{ marginBottom: '1rem' }}>
            <h4>{gym.name}</h4>
            <div className="detail-row">
              <span className="detail-label">Location</span>
              <div className="detail-value">
                {[gym.location?.address, gym.location?.city, gym.location?.state].filter(Boolean).join(', ') || '-'}
              </div>
            </div>
            <div className="detail-row">
              <span className="detail-label">Status</span>
              <div className="detail-value">{formatStatus(gym.status)}</div>
            </div>
            <div className="detail-row">
              <span className="detail-label">Members</span>
              <div className="detail-value">{gym.memberStats.active}/{gym.memberStats.total}</div>
            </div>
            <div className="detail-row">
              <span className="detail-label">Trainers</span>
              <div className="detail-value">{gym.trainerStats.active}/{gym.trainerStats.total}</div>
            </div>
          </div>
        ))
      ) : <EmptyState message="No gyms owned by this account." />}
    </DashboardSection>

    {gymOwner.subscriptions.length ? (
      <DashboardSection title={`Listing Subscriptions (${gymOwner.subscriptions.length})`}>
        <div className="ud-table-wrap">
          <table className="dashboard-table dashboard-table--compact">
            <thead>
              <tr>
                <th>Gym</th>
                <th>Plan</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Period</th>
              </tr>
            </thead>
            <tbody>
              {gymOwner.subscriptions.map((subscription) => (
                <tr key={subscription.id}>
                  <td>{subscription.gym ?? '-'}</td>
                  <td>{formatStatus(subscription.planCode)}</td>
                  <td>{formatInr(subscription.amount)}</td>
                  <td>{formatStatus(subscription.status)}</td>
                  <td>{`${formatDate(subscription.periodStart)} - ${formatDate(subscription.periodEnd)}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DashboardSection>
    ) : null}
  </>
);

const TrainerView = ({ trainer }) => (
  <>
    <DashboardSection title="Trainer Overview">
      <div className="user-detail__stats">
        <Stat label="Assignments" value={trainer.stats.totalAssignments} />
        <Stat label="Active" value={trainer.stats.activeAssignments} />
        <Stat label="Trainees" value={trainer.stats.totalTrainees} />
      </div>
    </DashboardSection>
    <DashboardSection title={`Assignments (${trainer.assignments.length})`}>
      {trainer.assignments.length ? (
        <div className="ud-table-wrap">
          <table className="dashboard-table dashboard-table--compact">
            <thead>
              <tr>
                <th>Gym</th>
                <th>Status</th>
                <th>Trainees</th>
                <th>Approved</th>
              </tr>
            </thead>
            <tbody>
              {trainer.assignments.map((assignment) => (
                <tr key={assignment.id}>
                  <td>{assignment.gym?.name ?? '-'}</td>
                  <td>{formatStatus(assignment.status)}</td>
                  <td>{assignment.trainees.length}</td>
                  <td>{assignment.approvedAt ? formatDate(assignment.approvedAt) : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <EmptyState message="No trainer assignments." />}
    </DashboardSection>
  </>
);

const TraineeView = ({ trainee }) => (
  <>
    <DashboardSection title="Member Overview">
      <div className="user-detail__stats">
        <Stat label="Memberships" value={trainee.stats.totalMemberships} />
        <Stat label="Active" value={trainee.stats.activeMemberships} />
        <Stat label="Orders" value={trainee.stats.totalOrders} />
        <Stat label="Total Spent" value={formatInr(trainee.stats.totalSpent)} />
      </div>
    </DashboardSection>
    <DashboardSection title={`Memberships (${trainee.memberships.length})`}>
      {trainee.memberships.length ? (
        <div className="ud-table-wrap">
          <table className="dashboard-table dashboard-table--compact">
            <thead>
              <tr>
                <th>Gym</th>
                <th>Trainer</th>
                <th>Plan</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {trainee.memberships.map((membership) => (
                <tr key={membership.id}>
                  <td>{membership.gym?.name ?? '-'}</td>
                  <td>{membership.trainer?.name ?? '-'}</td>
                  <td>{formatStatus(membership.plan)}</td>
                  <td>{formatStatus(membership.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <EmptyState message="No memberships." />}
    </DashboardSection>
  </>
);

export const RoleSections = ({ detail }) => (
  <>
    {detail.seller ? <SellerView seller={detail.seller} /> : null}
    {detail.gymOwner ? <GymOwnerView gymOwner={detail.gymOwner} /> : null}
    {detail.trainer ? <TrainerView trainer={detail.trainer} /> : null}
    {detail.trainee ? <TraineeView trainee={detail.trainee} /> : null}

    {detail.manager ? (
      <DashboardSection title="Manager Role">
        <p className="text-muted">
          This account has the manager role and can moderate sellers, gym owners, gyms, products, and support queues.
        </p>
      </DashboardSection>
    ) : null}

    {detail.admin ? (
      <DashboardSection title="Administrator">
        <p className="text-muted">This account is a platform administrator.</p>
      </DashboardSection>
    ) : null}
  </>
);
