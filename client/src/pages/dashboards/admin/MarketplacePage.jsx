import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import DashboardSection from '../components/DashboardSection.jsx';
import EmptyState from '../components/EmptyState.jsx';
import SkeletonPanel from '../../../ui/SkeletonPanel.jsx';
import { useGetAdminMarketplaceQuery } from '../../../services/dashboardApi.js';
import {
  useCreateMarketplacePromoCodeMutation,
  useGetMarketplacePromoCodesQuery,
  useUpdateMarketplacePromoCodeMutation,
} from '../../../services/marketplaceApi.js';
import { downloadCsvFile } from '../../../utils/csvExport.js';
import { formatCurrency, formatDateTime, formatStatus } from '../../../utils/format.js';
import SearchSuggestInput from '../../../components/dashboard/SearchSuggestInput.jsx';
import { matchesPrefix, matchesAcrossFields } from '../../../utils/search.js';
import '../Dashboard.css';

const getUserId = (user) => String(user?.id ?? user?._id ?? '');

const formatAddress = (address) => ([
  address?.address,
  [address?.city, address?.state].filter(Boolean).join(', '),
  address?.zipCode,
].filter(Boolean).join(' | ') || 'Address unavailable');

const formatPromoDiscount = (promo) => {
  if (!promo) {
    return 'No discount';
  }

  if (promo.discountType === 'fixed') {
    return `${formatCurrency({ amount: promo.discountValue })} off`;
  }

  const capLabel = promo.maxDiscountAmount
    ? ` up to ${formatCurrency({ amount: promo.maxDiscountAmount })}`
    : '';

  return `${promo.discountValue}% off${capLabel}`;
};

const formatPromoWindow = (promo) => {
  if (!promo?.startsAt && !promo?.endsAt) {
    return 'No schedule';
  }

  if (promo?.startsAt && !promo?.endsAt) {
    return `Starts ${formatDateTime(promo.startsAt)}`;
  }

  if (!promo?.startsAt && promo?.endsAt) {
    return `Ends ${formatDateTime(promo.endsAt)}`;
  }

  return `${formatDateTime(promo.startsAt)} - ${formatDateTime(promo.endsAt)}`;
};

const buildOrderHealth = (order) => {
  const items = Array.isArray(order?.items) ? order.items : [];
  const trackingCount = items.filter((item) => item?.tracking?.trackingNumber || item?.tracking?.carrier).length;
  const returnCount = items.filter((item) => String(item?.returnRequest?.status ?? 'none').toLowerCase() !== 'none').length;
  const refundAmount = items.reduce((total, item) => total + (Number(item?.returnRequest?.refundAmount) || 0), 0);
  const itemStatusSummary = items.reduce((acc, item) => {
    const key = item?.status ?? 'processing';
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  return {
    trackingCount,
    returnCount,
    refundAmount,
    itemStatusSummary,
  };
};

const AdminMarketplacePage = () => {
  const [searchParams] = useSearchParams();
  const { data, isLoading, isError, refetch } = useGetAdminMarketplaceQuery();
  const {
    data: promoResponse,
    isLoading: isPromosLoading,
    isError: isPromosError,
    refetch: refetchPromos,
  } = useGetMarketplacePromoCodesQuery();
  const rawOrders = data?.data?.orders;
  const rawPromos = promoResponse?.data?.promos;
  const [createPromoCode, { isLoading: isCreatingPromo }] = useCreateMarketplacePromoCodeMutation();
  const [updatePromoCode, { isLoading: isUpdatingPromo }] = useUpdateMarketplacePromoCodeMutation();

  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') ?? '');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [activeOrderId, setActiveOrderId] = useState('');
  const [promoForm, setPromoForm] = useState({
    code: '',
    label: '',
    description: '',
    discountType: 'percentage',
    discountValue: '10',
    minOrderAmount: '0',
    maxDiscountAmount: '',
    usageLimit: '',
    isPublic: true,
    startsAt: '',
    endsAt: '',
  });
  const [promoMessage, setPromoMessage] = useState('');
  const [promoError, setPromoError] = useState('');

  const orders = useMemo(
    () => (Array.isArray(rawOrders) ? rawOrders : []),
    [rawOrders],
  );
  const promos = useMemo(
    () => (Array.isArray(rawPromos) ? rawPromos : []),
    [rawPromos],
  );

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

  const promoSummary = useMemo(() => ({
    total: promos.length,
    active: promos.filter((promo) => promo?.active).length,
    public: promos.filter((promo) => promo?.isPublic).length,
    totalRedemptions: promos.reduce((sum, promo) => sum + (Number(promo?.usedCount) || 0), 0),
  }), [promos]);

  const resetPromoForm = () => {
    setPromoForm({
      code: '',
      label: '',
      description: '',
      discountType: 'percentage',
      discountValue: '10',
      minOrderAmount: '0',
      maxDiscountAmount: '',
      usageLimit: '',
      isPublic: true,
      startsAt: '',
      endsAt: '',
    });
  };

  const handlePromoFieldChange = (field, value) => {
    setPromoForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreatePromo = async (event) => {
    event.preventDefault();
    setPromoError('');
    setPromoMessage('');

    try {
      const response = await createPromoCode({
        code: promoForm.code.trim() || undefined,
        label: promoForm.label.trim(),
        description: promoForm.description.trim(),
        discountType: promoForm.discountType,
        discountValue: Number(promoForm.discountValue),
        minOrderAmount: Number(promoForm.minOrderAmount || 0),
        maxDiscountAmount: promoForm.maxDiscountAmount === '' ? null : Number(promoForm.maxDiscountAmount),
        usageLimit: promoForm.usageLimit === '' ? null : Number(promoForm.usageLimit),
        isPublic: promoForm.isPublic,
        startsAt: promoForm.startsAt || null,
        endsAt: promoForm.endsAt || null,
      }).unwrap();

      const createdCode = response?.data?.promo?.code ?? 'Promo';
      setPromoMessage(`${createdCode} created successfully.`);
      resetPromoForm();
    } catch (error) {
      setPromoError(error?.data?.message || 'Could not create the promo code.');
    }
  };

  const handlePromoToggle = async (promo, field) => {
    if (!promo?.id) {
      return;
    }

    setPromoError('');
    setPromoMessage('');

    try {
      await updatePromoCode({
        promoId: promo.id,
        [field]: !promo[field],
      }).unwrap();
      setPromoMessage(`${promo.code} updated successfully.`);
    } catch (error) {
      setPromoError(error?.data?.message || `Could not update ${promo.code}.`);
    }
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

      return matchesAcrossFields(searchableFields, query);
    });
  }, [orders, searchTerm, statusFilter, categoryFilter]);

  const activeOrder = useMemo(
    () => filteredOrders.find((order) => String(order.id) === String(activeOrderId)) ?? null,
    [activeOrderId, filteredOrders],
  );

  const searchSuggestions = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) {
      return [];
    }

    const suggestions = [];
    const seen = new Set();

    orders.forEach((order) => {
      [
        {
          value: order.orderNumber ?? order.id,
          meta: `Order • ${order.user?.name ?? 'Unknown buyer'}`,
        },
        {
          value: order.user?.name,
          meta: `Buyer • ${order.user?.email ?? 'No email'}`,
        },
        {
          value: order.seller?.name,
          meta: `Seller • ${order.seller?.email ?? 'No email'}`,
        },
        ...((order.items || []).map((item) => ({
          value: item?.name,
          meta: `Item • ${item?.category ? formatStatus(item.category) : 'Uncategorised'}`,
        }))),
      ].forEach((entry, index) => {
        const normalized = entry.value?.toString().trim();
        if (!normalized) {
          return;
        }
        const lower = normalized.toLowerCase();
        if (!matchesPrefix(lower, query)) {
          return;
        }
        const key = `${index}:${lower}`;
        if (seen.has(key)) {
          return;
        }
        seen.add(key);
        suggestions.push({
          id: key,
          label: normalized,
          meta: entry.meta,
        });
      });
    });

    return suggestions;
  }, [orders, searchTerm]);

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
        counters.set(item.name, {
          quantity: prev.quantity + (item.quantity || 0),
          revenue: prev.revenue + (Number(item.price) || 0) * (item.quantity || 0),
        });
      });
    });
    return [...counters.entries()]
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, 5)
      .map(([name, data]) => ({ name, quantity: data.quantity, revenue: data.revenue }));
  }, [orders]);

  const topSellers = useMemo(() => {
    const map = new Map();
    orders.forEach((order) => {
      const id = getUserId(order.seller);
      if (!id) return;
      const prev = map.get(id) || { id, name: order.seller?.name, email: order.seller?.email, revenue: 0 };
      prev.revenue += Number(order.total?.amount ?? order.total ?? 0);
      map.set(id, prev);
    });
    return [...map.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [orders]);

  const topBuyers = useMemo(() => {
    const map = new Map();
    orders.forEach((order) => {
      const id = getUserId(order.user);
      if (!id) return;
      const prev = map.get(id) || { id, name: order.user?.name, email: order.user?.email, spent: 0 };
      prev.spent += Number(order.total?.amount ?? order.total ?? 0);
      map.set(id, prev);
    });
    return [...map.values()].sort((a, b) => b.spent - a.spent).slice(0, 5);
  }, [orders]);

  const topCategories = useMemo(() => {
    const map = new Map();
    orders.forEach((order) => {
      (order.items || []).forEach((item) => {
        const cat = item?.category;
        if (!cat) return;
        const prev = map.get(cat) || { name: cat, items: 0, revenue: 0 };
        prev.items += (item.quantity || 0);
        prev.revenue += (Number(item.price) || 0) * (item.quantity || 0);
        map.set(cat, prev);
      });
    });
    return [...map.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [orders]);

  const returnSummary = useMemo(() => {
    return orders.reduce((acc, order) => {
      (order.items || []).forEach((item) => {
        const status = String(item.returnRequest?.status ?? 'none').toLowerCase();
        if (status !== 'none') {
          acc.requests += 1;
        }
        acc.refundValue += Number(item.returnRequest?.refundAmount) || 0;
      });
      return acc;
    }, { requests: 0, refundValue: 0 });
  }, [orders]);

  const activeOrderHealth = useMemo(
    () => (activeOrder ? buildOrderHealth(activeOrder) : null),
    [activeOrder],
  );

  const handleExportOrders = () => {
    const rows = filteredOrders.flatMap((order) => (
      (order.items || []).map((item) => ({
        orderNumber: order.orderNumber ?? order.id,
        buyer: order.user?.name ?? '',
        seller: item.seller?.name ?? order.seller?.name ?? '',
        item: item.name ?? '',
        category: item.category ?? '',
        quantity: item.quantity ?? 0,
        itemStatus: item.status ?? '',
        tracking: item.tracking?.trackingNumber ?? '',
        returnStatus: item.returnRequest?.status ?? 'none',
        refundAmount: item.returnRequest?.refundAmount ?? 0,
        orderStatus: order.status ?? '',
        total: order.total?.amount ?? order.total ?? 0,
        createdAt: formatDateTime(order.createdAt),
      }))
    ));

    downloadCsvFile({
      filename: 'admin-marketplace-orders.csv',
      columns: [
        { key: 'orderNumber', label: 'Order' },
        { key: 'buyer', label: 'Buyer' },
        { key: 'seller', label: 'Seller' },
        { key: 'item', label: 'Item' },
        { key: 'category', label: 'Category' },
        { key: 'quantity', label: 'Qty' },
        { key: 'itemStatus', label: 'Item Status' },
        { key: 'tracking', label: 'Tracking #' },
        { key: 'returnStatus', label: 'Return Status' },
        { key: 'refundAmount', label: 'Refund Amount' },
        { key: 'orderStatus', label: 'Order Status' },
        { key: 'total', label: 'Order Total' },
        { key: 'createdAt', label: 'Placed' },
      ],
      rows,
    });
  };

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
            <div className="stat-card">
              <small>Total orders</small>
              <strong>{summary.total}</strong>
              <small>{summary.processing} in processing</small>
            </div>
            <div className="stat-card">
              <small>Fulfilled</small>
              <strong>{summary.fulfilled}</strong>
              <small>{orders.length ? `${Math.round((summary.fulfilled / orders.length) * 100)}% success` : '—'}</small>
            </div>
            <div className="stat-card">
              <small>Gross revenue</small>
              <strong>{formatCurrency({ amount: summary.revenue })}</strong>
              <small>Including shipping & taxes</small>
            </div>
            <div className="stat-card">
              <small>Returns and refunds</small>
              <strong>{returnSummary.requests}</strong>
              <small>{formatCurrency({ amount: returnSummary.refundValue })} in tracked refunds</small>
            </div>
          </div>
        ) : (
          <EmptyState message="Orders will populate once customers start buying." />
        )}
      </DashboardSection>

      <DashboardSection
        title="Promo Codes"
        className="dashboard-section--span-12"
        action={(
          <button type="button" onClick={() => refetchPromos()}>
            Refresh promos
          </button>
        )}
      >
        <div className="stat-grid">
          <div className="stat-card">
            <small>Total promos</small>
            <strong>{promoSummary.total}</strong>
            <small>{promoSummary.active} active right now</small>
          </div>
          <div className="stat-card">
            <small>Public promos</small>
            <strong>{promoSummary.public}</strong>
            <small>Visible to customers in the cart</small>
          </div>
          <div className="stat-card">
            <small>Total redemptions</small>
            <strong>{promoSummary.totalRedemptions}</strong>
            <small>Reserved and completed usages combined</small>
          </div>
        </div>

        <form className="users-toolbar" onSubmit={handleCreatePromo} style={{ marginTop: '1rem' }}>
          <input
            value={promoForm.code}
            onChange={(event) => handlePromoFieldChange('code', event.target.value.toUpperCase())}
            placeholder="Code (leave blank to auto-generate)"
            aria-label="Promo code"
          />
          <input
            value={promoForm.label}
            onChange={(event) => handlePromoFieldChange('label', event.target.value)}
            placeholder="Label"
            aria-label="Promo label"
            required
          />
          <input
            value={promoForm.description}
            onChange={(event) => handlePromoFieldChange('description', event.target.value)}
            placeholder="Description"
            aria-label="Promo description"
          />
          <select
            value={promoForm.discountType}
            onChange={(event) => handlePromoFieldChange('discountType', event.target.value)}
            aria-label="Discount type"
          >
            <option value="percentage">Percentage</option>
            <option value="fixed">Fixed amount</option>
          </select>
          <input
            type="number"
            min="1"
            step="0.01"
            value={promoForm.discountValue}
            onChange={(event) => handlePromoFieldChange('discountValue', event.target.value)}
            placeholder="Discount value"
            aria-label="Discount value"
            required
          />
          <input
            type="number"
            min="0"
            step="0.01"
            value={promoForm.minOrderAmount}
            onChange={(event) => handlePromoFieldChange('minOrderAmount', event.target.value)}
            placeholder="Min order"
            aria-label="Minimum order amount"
          />
          <input
            type="number"
            min="0"
            step="0.01"
            value={promoForm.maxDiscountAmount}
            onChange={(event) => handlePromoFieldChange('maxDiscountAmount', event.target.value)}
            placeholder="Max discount"
            aria-label="Maximum discount amount"
          />
          <input
            type="number"
            min="1"
            step="1"
            value={promoForm.usageLimit}
            onChange={(event) => handlePromoFieldChange('usageLimit', event.target.value)}
            placeholder="Usage limit"
            aria-label="Usage limit"
          />
          <input
            type="datetime-local"
            value={promoForm.startsAt}
            onChange={(event) => handlePromoFieldChange('startsAt', event.target.value)}
            aria-label="Promo start date"
          />
          <input
            type="datetime-local"
            value={promoForm.endsAt}
            onChange={(event) => handlePromoFieldChange('endsAt', event.target.value)}
            aria-label="Promo end date"
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="checkbox"
              checked={promoForm.isPublic}
              onChange={(event) => handlePromoFieldChange('isPublic', event.target.checked)}
            />
            <span>Public</span>
          </label>
          <button type="submit" className="users-toolbar__refresh" disabled={isCreatingPromo}>
            {isCreatingPromo ? 'Creating...' : 'Create promo'}
          </button>
        </form>

        {promoError ? <p className="dashboard-message dashboard-message--error">{promoError}</p> : null}
        {promoMessage ? <p className="dashboard-message dashboard-message--success">{promoMessage}</p> : null}

        {isPromosLoading ? (
          <SkeletonPanel lines={6} />
        ) : isPromosError ? (
          <EmptyState message="We could not load marketplace promo codes." />
        ) : promos.length ? (
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Discount</th>
                <th>Limits</th>
                <th>Schedule</th>
                <th>Visibility</th>
                <th>Usage</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {promos.map((promo) => (
                <tr key={promo.id}>
                  <td>
                    <strong>{promo.code}</strong>
                    <div><small>{promo.label}</small></div>
                    {promo.description ? <div><small>{promo.description}</small></div> : null}
                  </td>
                  <td>{formatPromoDiscount(promo)}</td>
                  <td>
                    <div><small>Min {formatCurrency({ amount: promo.minOrderAmount })}</small></div>
                    <div><small>{promo.usageLimit ? `${promo.usedCount}/${promo.usageLimit} used` : `${promo.usedCount} used`}</small></div>
                  </td>
                  <td><small>{formatPromoWindow(promo)}</small></td>
                  <td>
                    <div><small>{promo.active ? 'Active' : 'Inactive'}</small></div>
                    <div><small>{promo.isPublic ? 'Public' : 'Private'}</small></div>
                  </td>
                  <td>{promo.usedCount}</td>
                  <td>
                    <button
                      type="button"
                      className="order-item-card__action"
                      onClick={() => handlePromoToggle(promo, 'active')}
                      disabled={isUpdatingPromo}
                    >
                      {promo.active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      type="button"
                      className="order-item-card__action"
                      onClick={() => handlePromoToggle(promo, 'isPublic')}
                      disabled={isUpdatingPromo}
                    >
                      {promo.isPublic ? 'Hide' : 'Show'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState message="No promo codes yet. Create the first marketplace promo above." />
        )}
      </DashboardSection>

      <DashboardSection
        title="Orders"
        className="dashboard-section--span-12"
        action={(
          <div className="users-toolbar">
            <SearchSuggestInput
              id="admin-marketplace-search"
              value={searchTerm}
              onChange={setSearchTerm}
              onSelect={(suggestion) => setSearchTerm(suggestion.label)}
              suggestions={searchSuggestions}
              placeholder="Search by order ID, buyer, seller, or item name"
              ariaLabel="Search orders"
              noResultsText="No orders match those search attributes."
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
            <button type="button" className="users-toolbar__reset" onClick={handleExportOrders} disabled={!filteredOrders.length}>
              Export
            </button>
            <button type="button" className="users-toolbar__refresh" onClick={() => refetch()}>
              Refresh
            </button>
          </div>
        )}
      >
        {filteredOrders.length ? (
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Buyer</th>
                <th>Seller</th>
                <th>Items</th>
                <th>Category</th>
                <th>Status</th>
                <th>Total</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order) => {
                const itemList = order.items ?? [];
                const categories = [...new Set(itemList.map((i) => i.category).filter(Boolean))];
                const categoryDisplay = categories.length > 1 ? 'Mixed' : (categories[0] || '—');
                
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
                        <Link to={`/dashboard/admin/users/${getUserId(order.user)}`}>{order.user?.name ?? '—'}</Link>
                      ) : (order.user?.name ?? '—')}
                      <div><small>{order.user?.email}</small></div>
                    </td>
                    <td>
                      {getUserId(order.seller) ? (
                        <Link to={`/dashboard/admin/users/${getUserId(order.seller)}`}>{order.seller?.name ?? '—'}</Link>
                      ) : (order.seller?.name ?? '—')}
                      <div><small>{order.seller?.email}</small></div>
                    </td>
                    <td>
                      {itemList.length} items
                      <div><small>{itemList.map((i) => i.name).slice(0, 2).join(', ')}{itemList.length > 2 ? '...' : ''}</small></div>
                    </td>
                    <td>{formatStatus(categoryDisplay)}</td>
                    <td>{formatStatus(order.status)}</td>
                    <td>{formatCurrency(order.total)}</td>
                    <td>
                      <button type="button" className="order-item-card__action" onClick={() => setActiveOrderId(order.id)}>
                        View
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <EmptyState message={filtersActive ? 'No orders match the current filters.' : 'No orders yet.'} />
        )}
      </DashboardSection>

      <DashboardSection title="Top Selling Products" className="dashboard-section--span-12">
        {topProducts.length ? (
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Product Name</th>
                <th>Units Sold</th>
                <th>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {topProducts.map((product, index) => (
                <tr key={product.name}>
                  <td><strong>{index + 1}. {product.name}</strong></td>
                  <td>{product.quantity}</td>
                  <td>{formatCurrency({ amount: product.revenue })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState message="Sales data will appear when customers purchase items." />
        )}
      </DashboardSection>

      <DashboardSection title="Top Sellers" className="dashboard-section--span-12">
        {topSellers.length ? (
          <table className="dashboard-table">
            <thead><tr><th>Seller</th><th>Email</th><th>Revenue</th></tr></thead>
            <tbody>
              {topSellers.map((s) => (
                <tr key={s.id}>
                  <td>{s.id ? <Link to={`/dashboard/admin/users/${s.id}`}>{s.name ?? '—'}</Link> : (s.name ?? '—')}</td>
                  <td>{s.email ?? '—'}</td>
                  <td>{formatCurrency({ amount: s.revenue })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <EmptyState message="No seller data available." />}
      </DashboardSection>

      <DashboardSection title="Top Buyers" className="dashboard-section--span-12">
        {topBuyers.length ? (
          <table className="dashboard-table">
            <thead><tr><th>Buyer</th><th>Email</th><th>Total Spent</th></tr></thead>
            <tbody>
              {topBuyers.map((b) => (
                <tr key={b.id}>
                  <td>{b.id ? <Link to={`/dashboard/admin/users/${b.id}`}>{b.name ?? '—'}</Link> : (b.name ?? '—')}</td>
                  <td>{b.email ?? '—'}</td>
                  <td>{formatCurrency({ amount: b.spent })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <EmptyState message="No buyer data available." />}
      </DashboardSection>

      <DashboardSection title="Top Categories" className="dashboard-section--span-12">
        {topCategories.length ? (
          <table className="dashboard-table">
            <thead><tr><th>Category</th><th>Items Sold</th><th>Revenue</th></tr></thead>
            <tbody>
              {topCategories.map((c) => (
                <tr key={c.name}>
                  <td>{formatStatus(c.name)}</td>
                  <td>{c.items}</td>
                  <td>{formatCurrency({ amount: c.revenue })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <EmptyState message="No category data available." />}
      </DashboardSection>

      {activeOrder ? (
        <div className="dashboard-overlay" role="dialog" aria-modal="true" onClick={(event) => {
          if (event.target === event.currentTarget) {
            setActiveOrderId('');
          }
        }}>
          <div className="dashboard-overlay__panel">
            <DashboardSection
              title={`Order ${activeOrder.orderNumber ?? activeOrder.id}`}
              className="dashboard-section--overlay"
              action={<button type="button" className="ghost-button" onClick={() => setActiveOrderId('')}>Close</button>}
            >
              <div className="order-info-grid">
                <div className="order-info-card">
                  <small>Buyer</small>
                  <strong>{activeOrder.user?.name ?? 'Unknown buyer'}</strong>
                  <p>{activeOrder.user?.email ?? 'No buyer email'}</p>
                </div>
                <div className="order-info-card">
                  <small>Seller</small>
                  <strong>{activeOrder.seller?.name ?? 'Unknown seller'}</strong>
                  <p>{activeOrder.seller?.email ?? 'No seller email'}</p>
                </div>
                <div className="order-info-card">
                  <small>Shipping</small>
                  <strong>{activeOrder.paymentMethod ?? 'Cash on Delivery'}</strong>
                  <p>{formatAddress(activeOrder.shippingAddress)}</p>
                </div>
              </div>

              <div className="order-info-grid">
                <div className="order-info-card">
                  <small>Financials</small>
                  <strong>{formatCurrency(activeOrder.total)}</strong>
                  <p>
                    Subtotal {formatCurrency(activeOrder.subtotal)}
                    {activeOrder.discountAmount ? ` | Discount ${formatCurrency(activeOrder.discountAmount)}` : ''}
                    {' | '}
                    Tax {formatCurrency(activeOrder.tax)}
                    {' | '}
                    Shipping {formatCurrency(activeOrder.shippingCost)}
                  </p>
                  {activeOrder.promo ? (
                    <small>Promo {activeOrder.promo.code}: {activeOrder.promo.description || activeOrder.promo.label}</small>
                  ) : null}
                </div>
                <div className="order-info-card">
                  <small>Status</small>
                  <strong>{formatStatus(activeOrder.status)}</strong>
                  <p>Placed {formatDateTime(activeOrder.createdAt)}</p>
                  <small>{activeOrder.paymentMethod === 'Cash on Delivery' ? 'Payment due on delivery' : 'Payment captured'}</small>
                </div>
              </div>

              {activeOrderHealth ? (
                <div className="order-info-grid">
                  <div className="order-info-card">
                    <small>Tracking coverage</small>
                    <strong>{activeOrderHealth.trackingCount} / {(activeOrder.items || []).length}</strong>
                    <p>Items with carrier or tracking number</p>
                  </div>
                  <div className="order-info-card">
                    <small>Returns</small>
                    <strong>{activeOrderHealth.returnCount}</strong>
                    <p>{formatCurrency({ amount: activeOrderHealth.refundAmount })} marked for refund</p>
                  </div>
                  <div className="order-info-card">
                    <small>Item statuses</small>
                    <strong>
                      {Object.entries(activeOrderHealth.itemStatusSummary)
                        .map(([status, count]) => `${count} ${formatStatus(status)}`)
                        .join(' | ') || 'No items'}
                    </strong>
                    <p>Compact order view for review and escalation.</p>
                  </div>
                </div>
              ) : null}

              <div className="order-items-list">
                {(activeOrder.items || []).map((item) => (
                  <div key={item.id} className="order-item-card order-item-card--detailed">
                    <div className="order-item-card__primary">
                      <div>
                        <strong>{item.name}</strong>
                        <small>
                          Qty {item.quantity ?? 0}
                          {' | '}
                          Seller {item.seller?.name ?? activeOrder.seller?.name ?? 'Unknown'}
                        </small>
                      </div>
                    </div>

                    <span className={`order-item-card__status order-item-card__status--${item.status}`}>
                      {formatStatus(item.status)}
                    </span>

                    <div className="order-item-card__details">
                      <div className="order-item-card__detail-block">
                        <small>Tracking</small>
                        <strong>{item.tracking?.carrier || 'Awaiting seller update'}</strong>
                        <p className="order-item-card__detail-text">
                          {item.tracking?.trackingNumber
                            ? `Tracking #: ${item.tracking.trackingNumber}`
                            : 'No tracking number provided yet.'}
                        </p>
                        {item.tracking?.trackingUrl ? (
                          <a href={item.tracking.trackingUrl} target="_blank" rel="noreferrer" className="order-item-card__action">
                            Open courier link
                          </a>
                        ) : null}
                      </div>

                      <div className="order-item-card__detail-block">
                        <small>Returns and refunds</small>
                        <strong>{formatStatus(item.returnRequest?.status ?? 'none')}</strong>
                        <p className="order-item-card__detail-text">
                          {item.returnRequest?.reason || 'No return request has been filed for this item.'}
                        </p>
                        <small>
                          {item.returnRequest?.refundAmount
                            ? `Refund amount ${formatCurrency({ amount: item.returnRequest.refundAmount })}`
                            : 'No refund amount recorded'}
                        </small>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </DashboardSection>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default AdminMarketplacePage;
