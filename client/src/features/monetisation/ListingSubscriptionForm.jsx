import PropTypes from 'prop-types';
import { Field, reduxForm } from 'redux-form';
import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import FormField from '../../components/forms/FormField.jsx';
import { useCreateGymListingCheckoutMutation } from '../../services/paymentApi.js';
import {
  selectPlan,
  selectGym,
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
        <span className="plan-card__price">₹{option.amount} / {option.durationMonths} mo</span>
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

const GymSelectField = ({ input, options, meta, onSelected }) => (
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

GymSelectField.defaultProps = {
  meta: null,
};

const ListingSubscriptionFormComponent = ({
  handleSubmit,
  gymOptions,
  plans,
  submitting,
  error,
  submitSucceeded,
}) => {
  const dispatch = useDispatch();
  const lastReceipt = useSelector((state) => state.monetisation.lastReceipt);
  const [paymentMethod, setPaymentMethod] = useState('stripe');
  const [stripeError, setStripeError] = useState(null);
  const [createGymListingCheckout, { isLoading: isCreatingCheckout }] = useCreateGymListingCheckoutMutation();

  const currentValues = useSelector((state) => state.form?.listingSubscription?.values || {});

  const handleStripePayment = async () => {
    setStripeError(null);

    if (!currentValues.gymId) {
      setStripeError('Please select a gym');
      return;
    }

    if (!currentValues.planCode) {
      setStripeError('Please select a plan');
      return;
    }

    try {
      const response = await createGymListingCheckout({
        gymId: currentValues.gymId,
        planCode: currentValues.planCode,
        autoRenew: currentValues.autoRenew || false,
      }).unwrap();

      // Redirect to Stripe checkout
      if (response?.data?.url) {
        window.location.href = response.data.url;
      } else {
        setStripeError('Failed to create payment session. Please try again.');
      }
    } catch (err) {
      setStripeError(err?.data?.message ?? 'Failed to initiate payment. Please try again.');
    }
  };

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

      <Field
        name="autoRenew"
        component={FormField}
        as="checkbox"
        label="Enable auto-renew"
        type="checkbox"
      />

      <div className="form-field">
        <label>
          <span className="form-field__label">Payment method</span>
          <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
            <option value="stripe">Card Payment (Stripe)</option>
            <option value="manual">Manual Payment Reference</option>
          </select>
        </label>
      </div>

      {paymentMethod === 'manual' ? (
        <Field
          name="paymentReference"
          component={FormField}
          label="Payment reference"
          placeholder="Txn-123456"
        />
      ) : null}

      {error ? <div className="form-error">{error}</div> : null}
      {stripeError ? <div className="form-error">{stripeError}</div> : null}
      {submitSucceeded && lastReceipt ? (
        <div className="form-success">
          Subscription activated · Ref #{lastReceipt}
        </div>
      ) : null}

      {paymentMethod === 'stripe' ? (
        <button 
          type="button" 
          className="primary-button" 
          onClick={handleStripePayment}
          disabled={isCreatingCheckout}
        >
          {isCreatingCheckout ? 'Processing…' : 'Pay with Stripe'}
        </button>
      ) : (
        <button type="submit" className="primary-button" disabled={submitting}>
          {submitting ? 'Activating…' : 'Activate plan'}
        </button>
      )}
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

ListingSubscriptionFormComponent.defaultProps = {
  gymOptions: [],
  plans: [],
  submitting: false,
  error: null,
  submitSucceeded: false,
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
  initialValues: {
    autoRenew: true,
  },
})(ListingSubscriptionFormComponent);

export default ListingSubscriptionForm;
