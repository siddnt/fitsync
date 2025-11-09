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
  delivered: '#8CE99A',
  outstanding: '#FFB020',
  cancelled: '#E54D14',
};

const TIMEFRAME_OPTIONS = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

const TIMEFRAME_COPY = {
  weekly: 'Daily sales across the last 7 days.',
  monthly: 'Monthly sales across the last 12 months.',
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

function buildRevenueSeriesByDay(orders = [], days = 7) {
  const today = new Date();
  const windowMap = new Map();

  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const key = date.toISOString().slice(0, 10);
    windowMap.set(key, {
      id: key,
      label: date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      fullLabel: date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }),
      value: 0,
    });
  }

  (orders || []).forEach((order) => {
    if (!order?.createdAt) return;
    const date = new Date(order.createdAt);
    if (Number.isNaN(date.getTime())) return;
    const key = date.toISOString().slice(0, 10);
    if (!windowMap.has(key)) return;

    const item = windowMap.get(key);
    item.value += Number(order.total) || 0;
  });

  return Array.from(windowMap.values());
}

function buildRevenueSeriesByMonth(orders = [], months = 12) {
  const today = new Date();
  const windowMap = new Map();

  for (let i = months - 1; i >= 0; i -= 1) {
    const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    windowMap.set(key, {
      id: key,
      label: date.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
      fullLabel: date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
      value: 0,
    });
  }

  (orders || []).forEach((order) => {
    if (!order?.createdAt) return;
    const date = new Date(order.createdAt);
    if (Number.isNaN(date.getTime())) return;
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    if (!windowMap.has(key)) return;

    const item = windowMap.get(key);
    item.value += Number(order.total) || 0;
  });

  return Array.from(windowMap.values());
}

function buildCategoryBreakdown(products = []) {
  const map = new Map();
  (products || []).forEach((product) => {
    const raw = product?.category || product?.type || 'Uncategorised';
    const label = raw || 'Uncategorised';
    const id = label.toString().toLowerCase();
    map.set(id, {
      id,
      name: label,
      value: (map.get(id)?.value || 0) + 1,
    });
  });

  return Array.from(map.values());
}

function buildOrderStatusBreakdown(orders = []) {
  const counts = new Map([
    ['delivered', 0],
    ['outstanding', 0],
    ['cancelled', 0],
  ]);

  (orders || []).forEach((order) => {
    const items = order?.items || [];
    items.forEach((item) => {
      const status = (item?.status || 'outstanding').toLowerCase();
      if (!counts.has(status)) {
        counts.set(status, 0);
      }
      counts.set(status, counts.get(status) + 1);
    });
  });

  return Array.from(counts.entries()).map(([key, value]) => ({
    id: key,
    name: key.charAt(0).toUpperCase() + key.slice(1),
    value,
  }));
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
                  {total ? ` · ${percentage}%` : ''}
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
            <Tooltip
              formatter={(value, name) => [valueFormatter(value), name]}
            />
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
        <p className="empty-chart">No revenue yet</p>
      )}
    </div>
  );
};

const SellerCharts = ({ orders = [], products = [] }) => {
  const [timeframe, setTimeframe] = useState('weekly');
  const [hiddenCategoryKeys, setHiddenCategoryKeys] = useState([]);
  const [hiddenStatusKeys, setHiddenStatusKeys] = useState([]);

  const revenueWeekly = useMemo(() => buildRevenueSeriesByDay(orders, 7), [orders]);
  const revenueMonthly = useMemo(() => buildRevenueSeriesByMonth(orders, 12), [orders]);

  const revenueSeries = timeframe === 'weekly' ? revenueWeekly : revenueMonthly;

  const categories = useMemo(() => applyColors(buildCategoryBreakdown(products)), [products]);
  const orderStatus = useMemo(
    () => applyColors(buildOrderStatusBreakdown(orders), STATUS_COLOR_MAP),
    [orders],
  );

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
          title="By category"
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
    </div>
  );
};

export default SellerCharts;
