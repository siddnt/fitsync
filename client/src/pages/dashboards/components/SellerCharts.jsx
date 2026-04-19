import React, { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

import './seller-charts.css';

const COLORS = ['#824EF7', '#E54D14', '#4DD7F7', '#8CE99A', '#FFB020', '#FF6AD5', '#35C89A', '#7B5BFF'];

const STATUS_COLOR_MAP = {
  processing: '#FFB020',
  'in-transit': '#4DD7F7',
  'out-for-delivery': '#824EF7',
  delivered: '#8CE99A',
};

const TIMEFRAME_OPTIONS = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

const TIMEFRAME_COPY = {
  weekly: 'Delivered revenue across the last 7 days.',
  monthly: 'Delivered revenue across the last 12 months.',
};

const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

const compactCurrencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  notation: 'compact',
  maximumFractionDigits: 1,
});

const numberFormatter = new Intl.NumberFormat('en-IN');

const formatCurrency = (value) => currencyFormatter.format(value || 0);
const formatCurrencyCompact = (value) => compactCurrencyFormatter.format(value || 0);
const formatNumber = (value) => numberFormatter.format(value || 0);

const formatLabel = (value) => String(value ?? 'Uncategorised')
  .replace(/[-_]/g, ' ')
  .replace(/\b\w/g, (char) => char.toUpperCase());

function buildRevenueSeriesByDay(orders = [], days = 7) {
  const today = new Date();
  const windowMap = new Map();

  for (let index = days - 1; index >= 0; index -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - index);
    const key = date.toISOString().slice(0, 10);
    windowMap.set(key, {
      id: key,
      label: date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      fullLabel: date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }),
      value: 0,
    });
  }

  (orders || []).forEach((order) => {
    if (!order?.createdAt) {
      return;
    }

    const date = new Date(order.createdAt);
    if (Number.isNaN(date.getTime())) {
      return;
    }

    const key = date.toISOString().slice(0, 10);
    if (!windowMap.has(key)) {
      return;
    }

    const item = windowMap.get(key);
    item.value += Number(order.total) || 0;
  });

  return Array.from(windowMap.values());
}

function buildRevenueSeriesByMonth(orders = [], months = 12) {
  const today = new Date();
  const windowMap = new Map();

  for (let index = months - 1; index >= 0; index -= 1) {
    const date = new Date(today.getFullYear(), today.getMonth() - index, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    windowMap.set(key, {
      id: key,
      label: date.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
      fullLabel: date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
      value: 0,
    });
  }

  (orders || []).forEach((order) => {
    if (!order?.createdAt) {
      return;
    }

    const date = new Date(order.createdAt);
    if (Number.isNaN(date.getTime())) {
      return;
    }

    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    if (!windowMap.has(key)) {
      return;
    }

    const item = windowMap.get(key);
    item.value += Number(order.total) || 0;
  });

  return Array.from(windowMap.values());
}

function buildCategoryBreakdown(products = []) {
  const categoryMap = new Map();

  (products || []).forEach((product) => {
    const rawCategory = product?.category || product?.type || 'Uncategorised';
    const label = formatLabel(rawCategory);
    const id = label.toLowerCase();
    const unitsSold = Number(product?.stats?.soldLast30Days ?? 0);

    if (!categoryMap.has(id)) {
      categoryMap.set(id, {
        id,
        name: label,
        value: 0,
      });
    }

    categoryMap.get(id).value += unitsSold;
  });

  return Array.from(categoryMap.values()).filter((entry) => entry.value > 0);
}

const ORDER_STATUS_KEYS = ['processing', 'in-transit', 'out-for-delivery', 'delivered'];

const normaliseStatus = (status) => {
  if (!status) {
    return 'processing';
  }

  const value = status.toString().toLowerCase();
  return ORDER_STATUS_KEYS.includes(value) ? value : 'processing';
};

const isDeliveredOrder = (order) => {
  const items = order?.items || [];
  if (!items.length) {
    return false;
  }

  return items.every((item) => normaliseStatus(item?.status) === 'delivered');
};

function buildOrderStatusBreakdown(orders = []) {
  const counts = new Map(ORDER_STATUS_KEYS.map((key) => [key, 0]));

  (orders || []).forEach((order) => {
    const items = order?.items || [];
    items.forEach((item) => {
      const status = normaliseStatus(item?.status);
      counts.set(status, (counts.get(status) ?? 0) + 1);
    });
  });

  return Array.from(counts.entries()).map(([key, value]) => ({
    id: key,
    name: formatLabel(key),
    value,
  }));
}

function buildTopProducts(products = []) {
  return [...(products || [])]
    .sort((left, right) => {
      const recentGap = Number(right?.stats?.soldLast30Days ?? 0) - Number(left?.stats?.soldLast30Days ?? 0);
      if (recentGap !== 0) {
        return recentGap;
      }

      return Number(right?.stats?.totalSold ?? 0) - Number(left?.stats?.totalSold ?? 0);
    })
    .slice(0, 5);
}

function buildSlowProducts(products = []) {
  return [...(products || [])]
    .filter((product) => product?.isPublished && Number(product?.stats?.soldLast30Days ?? 0) === 0)
    .sort((left, right) => {
      const lifetimeGap = Number(left?.stats?.totalSold ?? 0) - Number(right?.stats?.totalSold ?? 0);
      if (lifetimeGap !== 0) {
        return lifetimeGap;
      }

      return Number(right?.stock ?? 0) - Number(left?.stock ?? 0);
    })
    .slice(0, 5);
}

function applyColors(entries, overrides = {}) {
  return entries.map((entry, index) => ({
    ...entry,
    color: overrides[entry.id] || COLORS[index % COLORS.length],
  }));
}

const ChartLegend = ({ entries, hiddenKeys, onToggle, valueFormatter }) => {
  const total = entries.reduce((sum, item) => sum + item.value, 0);

  return (
    <ul className="chart-legend">
      {entries.map((entry) => {
        const isHidden = hiddenKeys.includes(entry.id);
        const percentage = total ? ((entry.value / total) * 100).toFixed(1) : 0;

        return (
          <li key={entry.id} className="chart-legend__item">
            <button
              type="button"
              className={`chart-legend__button${isHidden ? ' chart-legend__button--muted' : ''}`}
              onClick={() => onToggle(entry.id)}
            >
              <span
                className="chart-legend__marker"
                style={{ backgroundColor: entry.color, opacity: isHidden ? 0.35 : 1 }}
              />
              <span className="chart-legend__label">
                {entry.name}
                <small>
                  {valueFormatter(entry.value)}
                  {total ? ` | ${percentage}%` : ''}
                </small>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
};

const SmallPie = ({ data, title, hiddenKeys, onToggle, valueFormatter }) => {
  const activeData = data.filter((entry) => !hiddenKeys.includes(entry.id));
  const hasLegend = data.length > 0;
  const emptyMessage = hasLegend
    ? 'No data selected. Use the filters below to include categories.'
    : 'No data available yet.';

  return (
    <div className="chart-card">
      <div className="chart-card__header">
        <h4>{title}</h4>
      </div>
      {activeData.length ? (
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie
              dataKey="value"
              data={activeData}
              nameKey="name"
              innerRadius={55}
              outerRadius={90}
              paddingAngle={3}
            >
              {activeData.map((entry) => (
                <Cell key={entry.id} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip formatter={(value, name) => [valueFormatter(value), name]} />
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <p className="empty-chart">{emptyMessage}</p>
      )}
      {hasLegend ? (
        <ChartLegend
          entries={data}
          hiddenKeys={hiddenKeys}
          onToggle={onToggle}
          valueFormatter={valueFormatter}
        />
      ) : null}
    </div>
  );
};

const RevenueLine = ({ data, timeframe, onChange }) => {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="chart-card chart-card--large">
      <div className="chart-card__header">
        <h4>Revenue trend</h4>
        <div className="chart-card__actions">
          {TIMEFRAME_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`chart-toggle${timeframe === option.value ? ' chart-toggle--active' : ''}`}
              onClick={() => onChange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      <p className="chart-card__meta">
        Total: <strong>{formatCurrency(total)}</strong>
      </p>
      <p className="chart-card__hint">{TIMEFRAME_COPY[timeframe]}</p>
      {data.length ? (
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.08} />
            <XAxis dataKey="label" tick={{ fill: 'var(--muted-text-color)' }} />
            <YAxis tick={{ fill: 'var(--muted-text-color)' }} tickFormatter={formatCurrencyCompact} />
            <Tooltip
              formatter={(value) => formatCurrency(value)}
              labelFormatter={(label, payload) => payload?.[0]?.payload?.fullLabel || label}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#824EF7"
              strokeWidth={3}
              dot={{ r: 3 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <p className="empty-chart">No delivered revenue yet.</p>
      )}
    </div>
  );
};

const ProductLeaderboard = ({ title, products, emptyMessage, valueLabel }) => (
  <div className="chart-card">
    <div className="chart-card__header">
      <h4>{title}</h4>
    </div>
    {products.length ? (
      <div className="seller-chart-list">
        {products.map((product) => (
          <div key={product.id} className="seller-chart-list__item">
            <div>
              <strong>{product.name}</strong>
              <small>{formatLabel(product.category)}</small>
            </div>
            <div className="seller-chart-list__metric">
              <strong>{formatNumber(valueLabel(product))}</strong>
              <small>
                {formatNumber(product?.stats?.totalSold ?? 0)} lifetime sold
              </small>
            </div>
          </div>
        ))}
      </div>
    ) : (
      <p className="empty-chart">{emptyMessage}</p>
    )}
  </div>
);

const SellerCharts = ({ orders = [], deliveredOrders: deliveredOrdersProp = null, products = [] }) => {
  const [timeframe, setTimeframe] = useState('weekly');
  const [hiddenCategoryKeys, setHiddenCategoryKeys] = useState([]);
  const [hiddenStatusKeys, setHiddenStatusKeys] = useState([]);

  const deliveredOrders = useMemo(() => {
    if (Array.isArray(deliveredOrdersProp)) {
      return deliveredOrdersProp;
    }

    return (orders || []).filter((order) => isDeliveredOrder(order));
  }, [orders, deliveredOrdersProp]);

  const revenueWeekly = useMemo(() => buildRevenueSeriesByDay(deliveredOrders, 7), [deliveredOrders]);
  const revenueMonthly = useMemo(() => buildRevenueSeriesByMonth(deliveredOrders, 12), [deliveredOrders]);
  const revenueSeries = timeframe === 'weekly' ? revenueWeekly : revenueMonthly;

  const categories = useMemo(() => applyColors(buildCategoryBreakdown(products)), [products]);
  const orderStatus = useMemo(
    () => applyColors(buildOrderStatusBreakdown(orders), STATUS_COLOR_MAP),
    [orders],
  );
  const topProducts = useMemo(() => buildTopProducts(products), [products]);
  const slowProducts = useMemo(() => buildSlowProducts(products), [products]);

  useEffect(() => {
    setHiddenCategoryKeys((prev) => prev.filter((key) => categories.some((category) => category.id === key)));
  }, [categories]);

  useEffect(() => {
    setHiddenStatusKeys((prev) => prev.filter((key) => orderStatus.some((status) => status.id === key)));
  }, [orderStatus]);

  const toggleCategory = (key) => {
    setHiddenCategoryKeys((prev) => (
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]
    ));
  };

  const toggleStatus = (key) => {
    setHiddenStatusKeys((prev) => (
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]
    ));
  };

  return (
    <div className="seller-analytics">
      <div className="seller-analytics__line">
        <RevenueLine data={revenueSeries} timeframe={timeframe} onChange={setTimeframe} />
      </div>
      <div className="seller-analytics__pies">
        <SmallPie
          data={categories}
          title="Units sold by category"
          hiddenKeys={hiddenCategoryKeys}
          onToggle={toggleCategory}
          valueFormatter={formatNumber}
        />
        <SmallPie
          data={orderStatus}
          title="Order status"
          hiddenKeys={hiddenStatusKeys}
          onToggle={toggleStatus}
          valueFormatter={formatNumber}
        />
      </div>
      <div className="seller-analytics__leaderboards">
        <ProductLeaderboard
          title="Best sellers"
          products={topProducts}
          emptyMessage="Sales rankings will appear once products start moving."
          valueLabel={(product) => product?.stats?.soldLast30Days ?? 0}
        />
        <ProductLeaderboard
          title="Slow movers"
          products={slowProducts}
          emptyMessage="Every published product has recorded recent sales."
          valueLabel={(product) => product?.stock ?? 0}
        />
      </div>
    </div>
  );
};

export default SellerCharts;
