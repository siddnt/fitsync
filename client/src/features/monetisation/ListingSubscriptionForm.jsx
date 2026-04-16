import PropTypes from 'prop-types';
import { Field, reduxForm } from 'redux-form';
import { useDispatch, useSelector } from 'react-redux';
import FormField from '../../components/forms/FormField.jsx';
import {
  selectGym,
  selectPlan,
} from './monetisationSlice.js';
import './MonetisationForms.css';

const PlanOptionField = ({ input, option, onSelected }) => {
  const isSelected = input.value === option.planCode;

  return (
    <label className={`plan-card${isSelected ? ' plan-card--selected' : ''}`}>
      <input
        type="radio"
        value={option.planCode}
        checked={isSelected}
        onChange={() => {
          input.onChange(option.planCode);
          onSelected(option.planCode);
        }}
      />
      <div className="plan-card__header">
        <h4>{option.label}</h4>
        <span className="plan-card__price">Rs {option.amount} / {option.durationMonths} mo</span>
      </div>
      <ul className="plan-card__features">
        {option.features?.map((feature) => (
          <li key={feature}>{feature}</li>
        ))}
      </ul>
    </label>
  );
};

PlanOptionField.propTypes = {
  input: PropTypes.object.isRequired,
  option: PropTypes.shape({
    planCode: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    amount: PropTypes.number.isRequired,
    durationMonths: PropTypes.number.isRequired,
    features: PropTypes.arrayOf(PropTypes.string),
  }).isRequired,
  onSelected: PropTypes.func.isRequired,
};

const GymSelectField = ({ input, options, meta = null, onSelected }) => (
  <FormField
    input={{
      ...input,
      onChange: (value) => {
        input.onChange(value);
        onSelected(value);
      },
    }}
    label="Gym"
    as="select"
    meta={meta}
  >
    <option value="">Select a gym</option>
    {options.map((gym) => (
      <option key={gym.id} value={gym.id}>
        {gym.name}
      </option>
    ))}
  </FormField>
);

GymSelectField.propTypes = {
  input: PropTypes.object.isRequired,
  options: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
    }),
  ).isRequired,
  meta: PropTypes.object,
  onSelected: PropTypes.func.isRequired,
};

const ListingSubscriptionFormComponent = ({
  handleSubmit,
  gymOptions = [],
  plans = [],
  submitting = false,
  error = null,
  submitSucceeded = false,
}) => {
  const dispatch = useDispatch();
  const lastReceipt = useSelector((state) => state.monetisation.lastReceipt);

  return (
    <form className="monetisation-form" onSubmit={handleSubmit}>
      <Field
        name="gymId"
        component={GymSelectField}
        options={gymOptions}
        onSelected={(gymId) => dispatch(selectGym(gymId))}
      />

      <div className="plan-grid">
        {plans.map((plan) => (
          <Field
            key={plan.planCode}
            name="planCode"
            component={PlanOptionField}
            option={plan}
            onSelected={(planCode) => dispatch(selectPlan(planCode))}
          />
        ))}
      </div>

      {error ? <div className="form-error">{error}</div> : null}
      {submitSucceeded && lastReceipt ? (
        <div className="form-success">
          Subscription activated. Confirmation ID: {lastReceipt}
        </div>
      ) : null}

      <button type="submit" className="cta-button" disabled={submitting}>
        {submitting ? 'Activating...' : 'Activate plan'}
      </button>
    </form>
  );
};

ListingSubscriptionFormComponent.propTypes = {
  handleSubmit: PropTypes.func.isRequired,
  gymOptions: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
    }),
  ),
  plans: PropTypes.arrayOf(PropTypes.shape({
    planCode: PropTypes.string.isRequired,
  })),
  submitting: PropTypes.bool,
  error: PropTypes.string,
  submitSucceeded: PropTypes.bool,
};

const validate = (values) => {
  const errors = {};

  if (!values.gymId) {
    errors.gymId = 'Select a gym to continue';
  }
  if (!values.planCode) {
    errors.planCode = 'Choose a listing plan';
  }

  return errors;
};

const ListingSubscriptionForm = reduxForm({
  form: 'listingSubscription',
  validate,
  enableReinitialize: true,
})(ListingSubscriptionFormComponent);

export default ListingSubscriptionForm;
