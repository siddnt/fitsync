import DashboardSection from '../components/DashboardSection.jsx';
import EmptyState from '../components/EmptyState.jsx';
import SkeletonPanel from '../../../ui/SkeletonPanel.jsx';
import { useGetTraineeDietQuery } from '../../../services/dashboardApi.js';
import { formatDate } from '../../../utils/format.js';
import '../Dashboard.css';

const combineMacros = (meals = []) => {
  const macroTotals = {};
  meals.forEach((meal) => {
    if (!meal.macros) return;

    if (meal.macros instanceof Map) {
      meal.macros.forEach((value, key) => {
        macroTotals[key] = (macroTotals[key] || 0) + Number(value || 0);
      });
    } else {
      Object.entries(meal.macros).forEach(([key, value]) => {
        macroTotals[key] = (macroTotals[key] || 0) + Number(value || 0);
      });
    }
  });
  return macroTotals;
};

const MacroList = ({ macros }) => (
  <div className="pill-row" style={{ marginTop: '0.75rem' }}>
    {Object.entries(macros).map(([macro, value]) => (
      <span key={macro} className="pill">
        {macro}: {Math.round(value)} g
      </span>
    ))}
  </div>
);

const TraineeDietPage = () => {
  const { data, isLoading, isError, refetch } = useGetTraineeDietQuery();
  const dietPlans = data?.data;
  const latest = dietPlans?.latest;
  const upcoming = dietPlans?.upcoming;
  const history = dietPlans?.history ?? [];

  if (isLoading) {
    return (
      <div className="dashboard-grid">
        {['Current meal plan', 'Upcoming adjustments', 'Previous plans'].map((title) => (
          <DashboardSection key={title} title={title}>
            <SkeletonPanel lines={6} />
          </DashboardSection>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="dashboard-grid">
        <DashboardSection
          title="Unable to load diet plans"
          action={(
            <button type="button" onClick={() => refetch()}>
              Retry
            </button>
          )}
        >
          <EmptyState message="We could not fetch your nutrition plans. Please try again." />
        </DashboardSection>
      </div>
    );
  }

  const currentMacros = latest ? combineMacros(latest.meals ?? []) : {};

  return (
    <div className="dashboard-grid">
      <DashboardSection title="Current meal plan">
        {latest ? (
          <div>
            <div className="pill-row">
              <span className="pill">Week of {formatDate(latest.weekOf)}</span>
              <span className="pill">Meals {latest.meals?.length ?? 0}</span>
            </div>
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>Meal</th>
                  <th>Description</th>
                  <th>Calories</th>
                </tr>
              </thead>
              <tbody>
                {(latest.meals ?? []).map((meal, index) => (
                  <tr key={`${meal.name}-${index}`}>
                    <td>{meal.name}</td>
                    <td>{meal.description ?? '—'}</td>
                    <td>{meal.calories ? `${meal.calories} kcal` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {Object.keys(currentMacros).length ? <MacroList macros={currentMacros} /> : null}
            {latest.notes ? <p>{latest.notes}</p> : null}
          </div>
        ) : (
          <EmptyState message="Your trainer has not assigned a meal plan yet." />
        )}
      </DashboardSection>

      <DashboardSection title="Upcoming adjustments">
        {upcoming ? (
          <div>
            <div className="pill-row">
              <span className="pill">Week of {formatDate(upcoming.weekOf)}</span>
              <span className="pill">Meals {upcoming.meals?.length ?? 0}</span>
            </div>
            {upcoming.notes ? <p>{upcoming.notes}</p> : <EmptyState message="No notes from your trainer yet." />}
          </div>
        ) : (
          <EmptyState message="There are no scheduled adjustments yet." />
        )}
      </DashboardSection>

      <DashboardSection title="Previous plans">
        {history.length ? (
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Week of</th>
                <th>Meals</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {history.map((entry) => (
                <tr key={entry.weekOf}>
                  <td>{formatDate(entry.weekOf)}</td>
                  <td>{entry.mealsCount}</td>
                  <td>{entry.notes ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState message="Prior plans will appear here after your next revision." />
        )}
      </DashboardSection>
    </div>
  );
};

export default TraineeDietPage;
