import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardSection from '../components/DashboardSection.jsx';
import EmptyState from '../components/EmptyState.jsx';
import SkeletonPanel from '../../../ui/SkeletonPanel.jsx';
import {
  useGetManagerSellersQuery,
  useUpdateSellerStatusMutation,
  useDeleteSellerByManagerMutation,
} from '../../../services/managerApi.js';
import { formatDate, formatStatus, formatNumber } from '../../../utils/format.js';
import PaginationBar from '../../../ui/PaginationBar.jsx';
import '../Dashboard.css';

const SellersPage = () => {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, refetch } = useGetManagerSellersQuery({ page });
  const [updateStatus, { isLoading: isUpdating }] = useUpdateSellerStatusMutation();
  const [deleteSeller, { isLoading: isDeleting }] = useDeleteSellerByManagerMutation();

  const sellers = data?.data?.sellers ?? [];
  const pagination = data?.data?.pagination ?? {};
  const [notice, setNotice] = useState(null);
  const [errorNotice, setErrorNotice] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => { setPage(1); }, [searchTerm, statusFilter]);

  const filteredSellers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return sellers.filter((seller) => {
      if (statusFilter !== 'all' && seller.status !== statusFilter) return false;
      if (!query) return true;
      return [seller.name, seller.email].filter(Boolean).some((v) => v.toLowerCase().includes(query));
    });
  }, [sellers, searchTerm, statusFilter]);

  const totalPages = pagination.totalPages ?? 1;
  const totalItems = pagination.total ?? filteredSellers.length;
  const startIndex = (page - 1) * (pagination.limit ?? 10) + 1;
  const endIndex = Math.min(page * (pagination.limit ?? 10), totalItems);

  const handleToggleStatus = async (seller) => {
    setNotice(null);
    setErrorNotice(null);
    const newStatus = seller.status === 'active' ? 'inactive' : 'active';
    try {
      await updateStatus({ userId: seller._id, status: newStatus }).unwrap();
      setNotice(`${seller.name ?? 'Seller'} ${newStatus === 'active' ? 'activated' : 'deactivated'}.`);
      refetch();
    } catch (err) {
      setErrorNotice(err?.data?.message ?? 'Unable to update seller status.');
    }
  };

  const handleDelete = async (seller) => {
    setNotice(null);
    setErrorNotice(null);
    const confirmed = window.confirm(
      `Permanently delete seller ${seller.name ?? ''}? Their products will be unpublished and orders settled.`,
    );
    if (!confirmed) return;
    try {
      await deleteSeller(seller._id).unwrap();
      setNotice(`${seller.name ?? 'Seller'} deleted.`);
      refetch();
    } catch (err) {
      setErrorNotice(err?.data?.message ?? 'Unable to delete seller.');
    }
  };

  if (isLoading) {
    return (
      <div className="dashboard-grid dashboard-grid--stacked">
        <DashboardSection title="Sellers"><SkeletonPanel lines={10} /></DashboardSection>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="dashboard-grid dashboard-grid--stacked">
        <DashboardSection title="Sellers" action={<button type="button" onClick={() => refetch()}>Retry</button>}>
          <EmptyState message="Could not load sellers." />
        </DashboardSection>
      </div>
    );
  }

  return (
    <div className="dashboard-grid dashboard-grid--stacked">
      <DashboardSection
        title="Sellers"
        action={
          <div className="users-toolbar">
            <input
              type="search"
              className="inventory-toolbar__input"
              placeholder="Search name or email"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Search sellers"
            />
            <select
              className="inventory-toolbar__input inventory-toolbar__input--select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by status"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="pending">Pending</option>
            </select>
            <button type="button" className="users-toolbar__refresh" onClick={() => refetch()}>
              Refresh
            </button>
          </div>
        }
      >
        {(notice || errorNotice) && (
          <div className={`status-pill ${errorNotice ? 'status-pill--warning' : 'status-pill--success'}`}>
            {errorNotice || notice}
          </div>
        )}

        {filteredSellers.length ? (
          <div className="admin-table-wrapper">
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th style={{ width: '22%' }}>Name</th>
                  <th style={{ width: '25%' }}>Email</th>
                  <th style={{ width: '120px' }}>Status</th>
                  <th>Products</th>
                  <th style={{ width: '120px' }}>Joined</th>
                  <th style={{ width: '250px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSellers.map((seller) => (
                  <tr key={seller._id}>
                    <td>
                      <div
                        className="dashboard-table__user dashboard-table__user--link"
                        onClick={() => navigate(`/dashboard/manager/users/${seller._id}`)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => e.key === 'Enter' && navigate(`/dashboard/manager/users/${seller._id}`)}
                      >
                        {seller.profilePicture ? (
                          <img src={seller.profilePicture} alt={seller.name} />
                        ) : (
                          <div className="dashboard-table__user-placeholder">
                            {seller.name?.charAt(0) ?? '?'}
                          </div>
                        )}
                        <div>
                          <strong>{seller.name}</strong>
                          {seller.profile?.headline && (
                            <div><small>{seller.profile.headline}</small></div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>{seller.email}</td>
                    <td>
                      <span className={`status-pill ${seller.status === 'active' ? 'status-pill--success' : seller.status === 'pending' ? 'status-pill--warning' : 'status-pill--danger'}`}>
                        {formatStatus(seller.status)}
                      </span>
                    </td>
                    <td>
                      {formatNumber(seller.products?.total ?? 0)} total
                      <div><small>{formatNumber(seller.products?.published ?? 0)} published</small></div>
                    </td>
                    <td>{formatDate(seller.createdAt)}</td>
                    <td>
                      <div className="button-row" style={{ flexWrap: 'nowrap' }}>
                        {seller.status !== 'pending' && (
                          <button
                            type="button"
                            className={`manager-btn ${seller.status === 'active' ? 'manager-btn--deactivate' : 'manager-btn--approve'}`}
                            onClick={() => handleToggleStatus(seller)}
                            disabled={isUpdating}
                          >
                            {seller.status === 'active' ? 'Deactivate' : 'Activate'}
                          </button>
                        )}
                        <button
                          type="button"
                          className="manager-btn manager-btn--reject"
                          onClick={() => handleDelete(seller)}
                          disabled={isDeleting}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <PaginationBar page={page} totalPages={totalPages} totalItems={totalItems} startIndex={startIndex} endIndex={endIndex} onPage={setPage} />
          </div>
        ) : (
          <EmptyState message="No sellers match your filters." />
        )}
      </DashboardSection>
    </div>
  );
};

export default SellersPage;
