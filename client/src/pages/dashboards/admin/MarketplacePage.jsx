import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardSection from '../components/DashboardSection.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Pagination from '../components/Pagination.jsx';
import useTableSort from '../components/useTableSort.js';
import SkeletonPanel from '../../../ui/SkeletonPanel.jsx';
import AutosuggestInput from '../../../ui/AutosuggestInput.jsx';
import { useGetAdminMarketplaceQuery } from '../../../services/dashboardApi.js';
import { formatCurrency, formatDateTime, formatStatus } from '../../../utils/format.js';
import '../Dashboard.css';

const getUserId = (user) => user?._id ?? user?.id ?? null;

const AdminMarketplacePage = () => {
  const { data, isLoading, isError, refetch } = useGetAdminMarketplaceQuery();
  const rawOrders = data?.data?.orders;

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);

  const orders = useMemo(
    () => (Array.isArray(rawOrders) ? rawOrders : []),
    [rawOrders],
  );

  const orderSuggestions = useMemo(() => orders.map((o) => o.orderNumber).filter(Boolean), [orders]);

  const statusOptions = useMemo(() => {
    const unique = new Set();
    orders.forEach((order) => {
      if (order?.status) {
        unique.add(order.status.toString().toLowerCase());
      }
    });
    return ['all', ...unique];
  }, [orders]);

  const categoryOptions = useMemo(() => {
    const unique = new Set();
    orders.forEach((order) => {
      (order.items || []).forEach((item) => {
        if (item?.category) {
          unique.add(item.category.toString().toLowerCase());
        }
      });
    });
    return ['all', ...unique];
  }, [orders]);

  const filtersActive = useMemo(
    () => Boolean(searchTerm.trim() || statusFilter !== 'all' || categoryFilter !== 'all'),
    [searchTerm, statusFilter, categoryFilter],
  );

  const resetFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setCategoryFilter('all');
  };

  const filteredOrders = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return orders.filter((order) => {
      const normalisedStatus = order?.status?.toString().toLowerCase() || 'processing';
      if (statusFilter !== 'all' && normalisedStatus !== statusFilter) {
        return false;
      }

      if (categoryFilter !== 'all') {
        const categories = (order.items || [])
          .map((item) => item?.category?.toString().toLowerCase())
          .filter(Boolean);
        if (!categories.some((category) => category === categoryFilter)) {
          return false;
        }
      }

      if (!query) {
        return true;
      }

      const searchableFields = [
        order.orderNumber,
        order.id,
        order.user?.name,
        order.user?.email,
        order.seller?.name,
        order.seller?.email,
        ...(order.items || []).map((item) => item?.name),
      ]
        .filter(Boolean)
        .map((value) => value.toString().toLowerCase());

      return searchableFields.some((value) => value.includes(query));
    });
  }, [orders, searchTerm, statusFilter, categoryFilter]);

  const { sorted, sortKey, sortDir, onSort } = useTableSort(filteredOrders, 'createdAt', 'desc');
  const PAGE_SIZE = 10;
  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paginatedOrders = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const thCls = (key) => `sortable${sortKey === key ? ` sort-${sortDir}` : ''}`;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, categoryFilter]);

  useEffect(() => {
    const safeTotalPages = Math.max(totalPages, 1);
    if (currentPage > safeTotalPages) {
      setCurrentPage(safeTotalPages);
    }
  }, [currentPage, totalPages]);

  const summary = useMemo(() => {
    if (!orders.length) {
      return {
        total: 0,
        processing: 0,
        fulfilled: 0,
        revenue: 0,
      };
    }
    return orders.reduce(
      (acc, order) => {
        acc.total += 1;
        acc.revenue += Number(order.total?.amount ?? order.total ?? 0);
        const status = (order.status || '').toString().toLowerCase();
        if (status === 'delivered') {
          acc.fulfilled += 1;
        }
        if (status === 'processing') {
          acc.processing += 1;
        }
        return acc;
      },
      { total: 0, processing: 0, fulfilled: 0, revenue: 0 },
    );
  }, [orders]);

  const topProducts = useMemo(() => {
    const counters = new Map();
    orders.forEach((order) => {
      (order.items || []).forEach((item) => {
        if (!item?.name) return;
        const prev = counters.get(item.name) || { quantity: 0, revenue: 0 };
        prev.quantity += item.quantity || 0;
        prev.revenue += (item.price || 0) * (item.quantity || 0);
        counters.set(item.name, prev);
      });
    });
    return [...counters.entries()]
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, 5)
      .map(([name, stats]) => ({ name, ...stats }));
  }, [orders]);

  const topSellers = useMemo(() => {
    const map = {};
    orders.forEach((order) => {
      const s = order.seller;
      if (!s?.name) return;
      const key = getUserId(s) || s.name;
      if (!map[key]) {
        map[key] = {
          id: getUserId(s),
          name: s.name,
          email: s.email,
          orders: 0,
          revenue: 0,
        };
      }
      map[key].orders += 1;
      const amount = typeof order.total === 'object' ? (order.total?.amount ?? 0) : (Number(String(order.total).replace(/[^\d.]/g, '')) || 0);
      map[key].revenue += amount;
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [orders]);

  const topBuyers = useMemo(() => {
    const map = {};
    orders.forEach((order) => {
      const u = order.user;
      if (!u?.name) return;
      const key = getUserId(u) || u.name;
      if (!map[key]) {
        map[key] = {
          id: getUserId(u),
          name: u.name,
          email: u.email,
          orders: 0,
          spent: 0,
        };
      }
      map[key].orders += 1;
      const amount = typeof order.total === 'object' ? (order.total?.amount ?? 0) : (Number(String(order.total).replace(/[^\d.]/g, '')) || 0);
      map[key].spent += amount;
    });
    return Object.values(map).sort((a, b) => b.spent - a.spent).slice(0, 5);
  }, [orders]);

  const topCategories = useMemo(() => {
    const map = {};
    orders.forEach((order) => {
      (order.items || []).forEach((item) => {
        const cat = item?.category;
        if (!cat) return;
        if (!map[cat]) map[cat] = { name: cat, items: 0, revenue: 0 };
        map[cat].items += item.quantity || 0;
        map[cat].revenue += (item.price || 0) * (item.quantity || 0);
      });
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [orders]);

  if (isLoading) {
    return (
      <div className="dashboard-grid dashboard-grid--admin">
        <DashboardSection title="Marketplace overview" className="dashboard-section--span-12">
          <SkeletonPanel lines={8} />
        </DashboardSection>
        <DashboardSection title="Order feed" className="dashboard-section--span-12">
          <SkeletonPanel lines={8} />
        </DashboardSection>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="dashboard-grid dashboard-grid--admin">
        <DashboardSection
          title="Marketplace overview"
          className="dashboard-section--span-12"
          action={(
            <button type="button" onClick={() => refetch()}>
              Retry
            </button>
          )}
        >
          <EmptyState message="We could not fetch the marketplace orders." />
        </DashboardSection>
      </div>
    );
  }

  return (
    <div className="dashboard-grid dashboard-grid--admin">
      <div className="admin-page-header">
        <h1>Marketplace</h1>
        <p>Track all orders, filter by status or category, and view top-selling products.</p>
      </div>

      <DashboardSection
        title="Marketplace overview"
        className="dashboard-section--span-12"
        action={(
          <button type="button" onClick={() => refetch()}>
            Refresh
          </button>
        )}
      >
        {orders.length ? (
          <div className="stat-grid">
            <div className="stat-card stat-card--blue">
              <small>Total orders</small>
              <strong>{summary.total}</strong>
              <small>{summary.processing} in processing</small>
            </div>
            <div className="stat-card stat-card--green">
              <small>Fulfilled</small>
              <strong>{summary.fulfilled}</strong>
              <small>{orders.length ? `${Math.round((summary.fulfilled / orders.length) * 100)}% success` : '-'}</small>
            </div>
            <div className="stat-card stat-card--orange">
              <small>Gross revenue</small>
              <strong>{formatCurrency({ amount: summary.revenue })}</strong>
              <small>Including shipping & taxes</small>
            </div>
          </div>
        ) : (
          <EmptyState message="Orders will populate once customers start buying." />
        )}
      </DashboardSection>

      <DashboardSection
        title="Orders"
        className="dashboard-section--span-12"
        action={(
          <div className="users-toolbar">
            <AutosuggestInput
              className="inventory-toolbar__input"
              placeholder="Search order"
              value={searchTerm}
              onChange={setSearchTerm}
              suggestions={orderSuggestions}
              ariaLabel="Search orders"
            />
            <select
              className="inventory-toolbar__input inventory-toolbar__input--select"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              aria-label="Filter by status"
            >
              {statusOptions.map((option) => (
                <option key={option} value={option}>
                  {option === 'all' ? 'All statuses' : formatStatus(option)}
                </option>
              ))}
            </select>
            <select
              className="inventory-toolbar__input inventory-toolbar__input--select"
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              aria-label="Filter by category"
            >
              {categoryOptions.map((option) => (
                <option key={option} value={option}>
                  {option === 'all' ? 'All categories' : formatStatus(option)}
                </option>
              ))}
            </select>
            {filtersActive ? (
              <button type="button" className="users-toolbar__reset" onClick={resetFilters}>
                Reset
              </button>
            ) : null}
            <button type="button" className="users-toolbar__refresh" onClick={() => refetch()}>
              Refresh
            </button>
          </div>
        )}
      >
        {filteredOrders.length ? (
          <>
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th className={thCls('orderNumber')} onClick={() => onSort('orderNumber')}>Order ID</th>
                  <th className={thCls('user.name')} onClick={() => onSort('user.name')}>Buyer</th>
                  <th className={thCls('seller.name')} onClick={() => onSort('seller.name')}>Seller</th>
                  <th>Items</th>
                  <th>Category</th>
                  <th className={thCls('status')} onClick={() => onSort('status')}>Status</th>
                  <th className={thCls('total')} onClick={() => onSort('total')}>Total</th>
                </tr>
              </thead>
              <tbody>
                {paginatedOrders.map((order) => {
                  const itemList = order.items ?? [];
                  const categories = [...new Set(itemList.map((i) => i.category).filter(Boolean))];
                  const categoryDisplay = categories.length > 1 ? 'Mixed' : (categories[0] || '-');

                  return (
                    <tr key={order.id}>
                      <td>
                        <strong>{order.orderNumber ?? order.id}</strong>
                        <div>
                          <small>{formatDateTime(order.createdAt)}</small>
                        </div>
                      </td>
                      <td>
                        {getUserId(order.user) ? (
                          <Link to={`/dashboard/admin/users/${getUserId(order.user)}`} className="dashboard-table__user--link">
                            {order.user?.name}
                          </Link>
                        ) : (
                          order.user?.name ?? '-'
                        )}
                        <div><small>{order.user?.email}</small></div>
                      </td>
                      <td>
                        {getUserId(order.seller) ? (
                          <Link to={`/dashboard/admin/users/${getUserId(order.seller)}`} className="dashboard-table__user--link">
                            {order.seller?.name}
                          </Link>
                        ) : (
                          order.seller?.name ?? '-'
                        )}
                        <div><small>{order.seller?.email}</small></div>
                      </td>
                      <td>
                        {itemList.length} items
                        <div><small>{itemList.map((i) => i.name).slice(0, 2).join(', ')}{itemList.length > 2 ? '...' : ''}</small></div>
                      </td>
                      <td>{formatStatus(categoryDisplay)}</td>
                      <td>{formatStatus(order.status)}</td>
                      <td>{formatCurrency(order.total)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <Pagination page={currentPage} totalPages={totalPages} from={(currentPage - 1) * PAGE_SIZE + 1} to={Math.min(currentPage * PAGE_SIZE, sorted.length)} total={sorted.length} onPageChange={setCurrentPage} />
          </>
        ) : (
          <EmptyState message={filtersActive ? 'No orders match the current filters.' : 'No orders yet.'} />
        )}
      </DashboardSection>

      <DashboardSection title="Top Selling Products" className="dashboard-section--span-12" collapsible>
        {topProducts.length ? (
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Product</th>
                <th>Units Sold</th>
                <th>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {topProducts.map((product, index) => (
                <tr key={product.name}>
                  <td><strong>{index + 1}</strong></td>
                  <td><strong>{product.name}</strong></td>
                  <td>{product.quantity}</td>
                  <td>{formatCurrency(product.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState message="Sales data will appear when customers purchase items." />
        )}
      </DashboardSection>

      <DashboardSection title="Top Sellers" className="dashboard-section--span-6" collapsible>
        {topSellers.length ? (
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Seller</th>
                <th>Orders</th>
                <th>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {topSellers.map((s, i) => (
                <tr key={s.id ?? s.name}>
                  <td><strong>{i + 1}</strong></td>
                  <td>
                    <strong>
                      {s.id ? (
                        <Link to={`/dashboard/admin/users/${s.id}`} className="dashboard-table__user--link">
                          {s.name}
                        </Link>
                      ) : (
                        s.name
                      )}
                    </strong>
                    <div><small>{s.email}</small></div>
                  </td>
                  <td>{s.orders}</td>
                  <td>{formatCurrency(s.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState message="No seller data available." />
        )}
      </DashboardSection>

      <DashboardSection title="Top Buyers" className="dashboard-section--span-6" collapsible>
        {topBuyers.length ? (
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Buyer</th>
                <th>Orders</th>
                <th>Spent</th>
              </tr>
            </thead>
            <tbody>
              {topBuyers.map((b, i) => (
                <tr key={b.id ?? b.name}>
                  <td><strong>{i + 1}</strong></td>
                  <td>
                    <strong>
                      {b.id ? (
                        <Link to={`/dashboard/admin/users/${b.id}`} className="dashboard-table__user--link">
                          {b.name}
                        </Link>
                      ) : (
                        b.name
                      )}
                    </strong>
                    <div><small>{b.email}</small></div>
                  </td>
                  <td>{b.orders}</td>
                  <td>{formatCurrency(b.spent)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState message="No buyer data available." />
        )}
      </DashboardSection>

      <DashboardSection title="Top Categories" className="dashboard-section--span-12" collapsible>
        {topCategories.length ? (
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Category</th>
                <th>Items Sold</th>
                <th>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {topCategories.map((c, i) => (
                <tr key={c.name}>
                  <td><strong>{i + 1}</strong></td>
                  <td><strong>{formatStatus(c.name)}</strong></td>
                  <td>{c.items}</td>
                  <td>{formatCurrency(c.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState message="No category data available." />
        )}
      </DashboardSection>
    </div>
  );
};

export default AdminMarketplacePage;

