import PropTypes from 'prop-types';
import { useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

const TIMEFRAME_OPTIONS = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

const fullCurrencyFormatter = new Intl.NumberFormat('en-IN', {
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

const formatFullCurrency = (value) => fullCurrencyFormatter.format(Math.round(Number(value) || 0));
const formatCompactCurrency = (value) => compactCurrencyFormatter.format(Math.round(Number(value) || 0));

const RevenueTooltip = ({ active, payload }) => {
  if (!active || !payload || !payload.length) {
    return null;
  }

  const point = payload[0]?.payload;
  if (!point) {
    return null;
  }

  return (
    <div className="owner-revenue-chart__tooltip">
      <strong>{point.fullLabel ?? point.label}</strong>
      <span>Revenue: {formatFullCurrency(point.revenue)}</span>
      <span>Expenses: {formatFullCurrency(point.expenses)}</span>
      <span>Net profit: {formatFullCurrency(point.profit)}</span>
    </div>
  );
};

RevenueTooltip.propTypes = {
  active: PropTypes.bool,
  payload: PropTypes.arrayOf(PropTypes.object),
};

RevenueTooltip.defaultProps = {
  active: false,
  payload: null,
};

const computeSummary = (data = []) => {
  if (!data.length) {
    return {
      totalRevenue: 0,
      totalExpenses: 0,
      totalProfit: 0,
      bestPeriod: null,
    };
  }

  return data.reduce(
    (acc, entry) => {
      const revenue = Number(entry.revenue) || 0;
      const expenses = Number(entry.expenses) || 0;
      const profit = Number(entry.profit) || revenue - expenses;
      const bestPeriod =
        profit > (acc.bestPeriod?.profit ?? Number.NEGATIVE_INFINITY)
          ? { label: entry.fullLabel ?? entry.label, profit }
          : acc.bestPeriod;

      return {
        totalRevenue: acc.totalRevenue + revenue,
        totalExpenses: acc.totalExpenses + expenses,
        totalProfit: acc.totalProfit + profit,
        bestPeriod,
      };
    },
    { totalRevenue: 0, totalExpenses: 0, totalProfit: 0, bestPeriod: null },
  );
};

const computeProjection = (data = []) => {
  if (!data.length) {
    return {
      revenue: 0,
      expenses: 0,
    };
  }

  if (data.length === 1) {
    const point = data[0];
    return {
      revenue: Number(point.revenue) || 0,
      expenses: Number(point.expenses) || 0,
    };
  }

  const recent = data.slice(-4);
  const revenueChanges = [];
  const expenseChanges = [];

  for (let index = 1; index < recent.length; index += 1) {
    const previous = recent[index - 1];
    const current = recent[index];
    revenueChanges.push((Number(current.revenue) || 0) - (Number(previous.revenue) || 0));
    expenseChanges.push((Number(current.expenses) || 0) - (Number(previous.expenses) || 0));
  }

  const averageChange = (changes) => {
    if (!changes.length) {
      return 0;
    }
    const total = changes.reduce((sum, change) => sum + change, 0);
    return total / changes.length;
  };

  const lastPoint = recent[recent.length - 1];
  const projectedRevenue = Math.max((Number(lastPoint.revenue) || 0) + averageChange(revenueChanges), 0);
  const projectedExpenses = Math.max((Number(lastPoint.expenses) || 0) + averageChange(expenseChanges), 0);

  return {
    revenue: projectedRevenue,
    expenses: projectedExpenses,
  };
};

const GymOwnerRevenueChart = ({ data, timeframe, onTimeframeChange, summary }) => {
  const resolvedData = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const resolvedSummary = useMemo(() => summary ?? computeSummary(resolvedData), [summary, resolvedData]);
  const projection = useMemo(() => computeProjection(resolvedData), [resolvedData]);

  const bestCopy = resolvedSummary?.bestPeriod
    ? `Top period: ${resolvedSummary.bestPeriod.label} (${formatFullCurrency(resolvedSummary.bestPeriod.profit || 0)} profit)`
    : 'We will highlight your strongest period once enough transactions are recorded.';

  return (
    <div className="owner-revenue-chart">
      <div className="owner-revenue-chart__meta">
        <div className="owner-revenue-chart__metrics">
          <div className="owner-revenue-chart__metric">
            <span>Net profit</span>
            <strong>{formatFullCurrency(resolvedSummary?.totalProfit ?? 0)}</strong>
          </div>
          <div className="owner-revenue-chart__metric">
            <span>Revenue</span>
            <strong>{formatFullCurrency(resolvedSummary?.totalRevenue ?? 0)}</strong>
          </div>
          <div className="owner-revenue-chart__metric">
            <span>Marketplace spend</span>
            <strong>{formatFullCurrency(resolvedSummary?.totalExpenses ?? 0)}</strong>
          </div>
        </div>
        <div className="owner-revenue-chart__toggle" role="group" aria-label="Select timeframe">
          {TIMEFRAME_OPTIONS.map((option) => {
            const isActive = option.value === timeframe;
            return (
              <button
                key={option.value}
                type="button"
                className={`owner-revenue-chart__toggle-button${isActive ? ' owner-revenue-chart__toggle-button--active' : ''}`}
                onClick={() => {
                  if (!isActive) {
                    onTimeframeChange(option.value);
                  }
                }}
                aria-pressed={isActive}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>
      <p className="owner-revenue-chart__hint">{bestCopy}</p>
      {resolvedData.length ? (
        <div className="chart-container chart-container--tall">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={resolvedData} margin={{ top: 12, right: 18, bottom: 0, left: -4 }}>
              <defs>
                <linearGradient id="ownerProfitArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#51cf66" stopOpacity={0.7} />
                  <stop offset="95%" stopColor="#51cf66" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="ownerExpenseArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#fa5252" stopOpacity={0.7} />
                  <stop offset="95%" stopColor="#fa5252" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="label" stroke="rgba(255,255,255,0.55)" />
              <YAxis stroke="rgba(255,255,255,0.55)" tickFormatter={formatCompactCurrency} />
              <Tooltip content={<RevenueTooltip />} />
              <Area
                type="monotone"
                dataKey="expenses"
                stroke="#fa5252"
                fill="url(#ownerExpenseArea)"
                strokeWidth={2.4}
                fillOpacity={1}
                name="Expenses"
                activeDot={{ r: 5 }}
              />
              <Area
                type="monotone"
                dataKey="profit"
                stroke="#51cf66"
                fill="url(#ownerProfitArea)"
                strokeWidth={2.4}
                fillOpacity={1}
                name="Net profit"
                activeDot={{ r: 5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="empty-state">Not enough transactions yet. We will chart your performance once data flows in.</p>
      )}
      {resolvedData.length ? (
        <div className="owner-revenue-chart__projection" aria-live="polite">
          <span className="owner-revenue-chart__projection-label">Projection</span>
          <div className="owner-revenue-chart__projection-items">
            <div className="owner-revenue-chart__projection-item owner-revenue-chart__projection-item--gain">
              <span>Earnings</span>
              <strong>{formatFullCurrency(projection.revenue)}</strong>
            </div>
            <div className="owner-revenue-chart__projection-item owner-revenue-chart__projection-item--spend">
              <span>Expenditure</span>
              <strong>{formatFullCurrency(projection.expenses)}</strong>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

GymOwnerRevenueChart.propTypes = {
  data: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string,
      label: PropTypes.string,
      fullLabel: PropTypes.string,
      revenue: PropTypes.number,
      expenses: PropTypes.number,
      profit: PropTypes.number,
    }),
  ),
  timeframe: PropTypes.oneOf(['weekly', 'monthly']).isRequired,
  onTimeframeChange: PropTypes.func.isRequired,
  summary: PropTypes.shape({
    totalRevenue: PropTypes.number,
    totalExpenses: PropTypes.number,
    totalProfit: PropTypes.number,
    bestPeriod: PropTypes.shape({
      label: PropTypes.string,
      profit: PropTypes.number,
    }),
  }),
};

GymOwnerRevenueChart.defaultProps = {
  data: [],
  summary: null,
};

export default GymOwnerRevenueChart;
