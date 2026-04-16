import PropTypes from 'prop-types';
import { Field } from 'redux-form';
import FormField from '../../components/forms/FormField.jsx';
import { MEMBERSHIP_PLAN_OPTIONS, formatMembershipPlanDuration } from '../../constants/membershipPlans.js';

export const MembershipPricingValidationMessage = ({ meta = null }) => {
  const showError = Boolean(meta?.error && (meta?.touched || meta?.submitFailed));

  if (!showError) {
    return null;
  }

  return <p className="gym-form__plan-error">{meta.error}</p>;
};

MembershipPricingValidationMessage.propTypes = {
  meta: PropTypes.shape({
    error: PropTypes.string,
    touched: PropTypes.bool,
    submitFailed: PropTypes.bool,
  }),
};

const MembershipPricingSection = ({ hint, note = null }) => (
  <section className="gym-form__section">
    <div className="gym-form__section-header">
      <div>
        <p className="gym-form__section-title">Pricing</p>
        <p className="gym-form__section-hint">{hint}</p>
      </div>
    </div>

    <div className="gym-form__plan-grid">
      {MEMBERSHIP_PLAN_OPTIONS.map((plan) => (
        <div key={plan.code} className="gym-form__plan-card">
          <div className="gym-form__plan-header">
            <div>
              <p className="gym-form__plan-title">{plan.label}</p>
              <p className="gym-form__plan-meta">{formatMembershipPlanDuration(plan.durationMonths)}</p>
            </div>
          </div>

          <div className="gym-form__section-fields">
            <Field
              name={`pricing.plans.${plan.code}.mrp`}
              component={FormField}
              label="MRP (Rs)"
              type="number"
              min="0"
              step="1"
            />
            <Field
              name={`pricing.plans.${plan.code}.discounted`}
              component={FormField}
              label="Offer price (Rs)"
              type="number"
              min="0"
              step="1"
            />
          </div>
        </div>
      ))}
    </div>

    <Field name="pricing.membershipPlansNotice" component={MembershipPricingValidationMessage} />

    {note ? <p className="gym-form__section-note">{note}</p> : null}
  </section>
);

MembershipPricingSection.propTypes = {
  hint: PropTypes.string.isRequired,
  note: PropTypes.string,
};

export default MembershipPricingSection;
