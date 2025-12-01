import DashboardSection from '../components/DashboardSection.jsx';
import EmptyState from '../components/EmptyState.jsx';
import SkeletonPanel from '../../../ui/SkeletonPanel.jsx';
import { useGetTraineeDietQuery } from '../../../services/dashboardApi.js';
import { formatDate } from '../../../utils/format.js';
import '../Dashboard.css';

const combineMacros = (meals = []) => {
  const macroTotals = {};
  meals.forEach((meal) => {
    if (!meal) {
      return;
    }
    if (meal.macros) {
      const entries = meal.macros instanceof Map ? Object.fromEntries(meal.macros) : meal.macros;
      Object.entries(entries).forEach(([key, value]) => {
        macroTotals[key] = (macroTotals[key] || 0) + Number(value || 0);
      });
      return;
    }

    if (meal.calories !== undefined) {
      macroTotals.calories = (macroTotals.calories || 0) + Number(meal.calories || 0);
    }
    if (meal.protein !== undefined) {
      macroTotals.protein = (macroTotals.protein || 0) + Number(meal.protein || 0);
    }
    if (meal.fat !== undefined) {
      macroTotals.fat = (macroTotals.fat || 0) + Number(meal.fat || 0);
    }
    if (meal.carbs !== undefined) {
      macroTotals.carbs = (macroTotals.carbs || 0) + Number(meal.carbs || 0);
    }
  });
  return macroTotals;
};

const MacroList = ({ macros }) => (
  <div className="pill-row" style={{ marginTop: '0.75rem' }}>
    {Object.entries(macros).map(([macro, value]) => {
      const label = macro.charAt(0).toUpperCase() + macro.slice(1);
      const unit = macro.toLowerCase() === 'calories' ? 'kcal' : 'g';
      return (
        <span key={macro} className="pill">
          {label}: {Math.round(value)} {unit}
        </span>
      );
    })}
  </div>
);

const mealDisplayLabel = (meal) => meal.label ?? meal.mealType ?? meal.name ?? 'Meal';

const DietPlanCard = ({ plan }) => {
  if (!plan) {
    return null;
  }

  const macros = combineMacros(plan.meals ?? []);

  return (
    <div className="diet-plan-card">
      <div className="pill-row">
        <span className="pill">Week of {plan.weekOf ? formatDate(plan.weekOf) : '—'}</span>
        <span className="pill">Meals {plan.meals?.length ?? 0}</span>
      </div>
      <div className="diet-plan-grid">
        <div className="diet-plan-grid__row diet-plan-grid__header">
          <span>Meal</span>
          <span>Item</span>
          <span>Calories</span>
          <span>Protein</span>
          <span>Fat</span>
        </div>
        {(plan.meals ?? []).map((meal) => (
          <div key={`${meal.mealType ?? meal.name ?? meal.label}`}
            className="diet-plan-grid__row"
          >
            <strong>{mealDisplayLabel(meal)}</strong>
            <div className="diet-plan-grid__item">
              {meal.item ? <span>{meal.item}</span> : <span className="muted">—</span>}
              {meal.notes ? <small>{meal.notes}</small> : null}
            </div>
            <span>{meal.calories !== undefined && meal.calories !== null ? `${meal.calories} kcal` : '—'}</span>
            <span>{meal.protein !== undefined && meal.protein !== null ? `${meal.protein} g` : '—'}</span>
            <span>{meal.fat !== undefined && meal.fat !== null ? `${meal.fat} g` : '—'}</span>
          </div>
        ))}
      </div>
      {Object.keys(macros).length ? <MacroList macros={macros} /> : null}
      {plan.notes ? <p className="diet-plan-notes">{plan.notes}</p> : null}
    </div>
  );
};

const TraineeDietPage = () => {
  const { data, isLoading, isError, refetch } = useGetTraineeDietQuery();
  const dietPlans = data?.data;
  const latest = dietPlans?.latest;
  const history = dietPlans?.history ?? [];

  if (isLoading) {
    return (
      <div className="dashboard-grid dashboard-grid--stacked">
        <DashboardSection title="Current meal plan">
          <SkeletonPanel lines={6} />
        </DashboardSection>
        <DashboardSection title="Previous plans">
          <SkeletonPanel lines={6} />
        </DashboardSection>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="dashboard-grid dashboard-grid--stacked">
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

  return (
    <div className="dashboard-grid dashboard-grid--stacked">
      <DashboardSection title="Current meal plan">
        {latest ? (
          <DietPlanCard plan={latest} />
        ) : (
          <EmptyState message="Your trainer has not assigned a meal plan yet." />
        )}
      </DashboardSection>

      <DashboardSection title="Previous plans">
        {history.length ? (
          <div className="diet-plan-history">
            {history.map((entry) => (
              <div key={entry._id ?? entry.weekOf ?? entry.id} className="diet-plan-history__card">
                <DietPlanCard plan={entry} />
              </div>
            ))}
          </div>
        ) : (
          <EmptyState message="Prior plans will appear here after your next revision." />
        )}
      </DashboardSection>
    </div>
  );
};

export default TraineeDietPage;
