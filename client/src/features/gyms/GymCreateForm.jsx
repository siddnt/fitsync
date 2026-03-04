import PropTypes from 'prop-types';
import { useState } from 'react';
import { Field, reduxForm } from 'redux-form';
import { useSelector } from 'react-redux';
import FormField from '../../components/forms/FormField.jsx';
import ChipMultiSelect from '../../components/forms/ChipMultiSelect.jsx';
import { AMENITY_OPTIONS } from '../../constants/amenities.js';
import { useCreateGymListingCheckoutMutation } from '../../services/paymentApi.js';
import './GymForms.css';

const GymCreateFormComponent = ({
  handleSubmit,
  submitting,
  onCancel,
  error,
  plans,
  isPlansLoading,
}) => {
  const [paymentMethod, setPaymentMethod] = useState('stripe');
  const [stripeError, setStripeError] = useState(null);
  const [createGymListingCheckout, { isLoading: isCreatingCheckout }] = useCreateGymListingCheckoutMutation();
  const currentValues = useSelector((state) => state.form?.gymCreate?.values || {});

  const handleStripePayment = async () => {
    setStripeError(null);

    if (!currentValues.planCode) {
      setStripeError('Please select a listing plan');
      return;
    }

    try {
      const response = await createGymListingCheckout({
        planCode: currentValues.planCode,
        autoRenew: currentValues.autoRenew || false,
        gymData: {
          name: currentValues.name,
          description: currentValues.description,
          location: currentValues.location,
          pricing: currentValues.pricing,
          contact: currentValues.contact,
          schedule: currentValues.schedule,
          keyFeatures: currentValues.keyFeatures,
          tags: currentValues.tags,
        },
      }).unwrap();

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
  <form className="gym-form" onSubmit={handleSubmit}>
    <section className="gym-form__section">
      <div className="gym-form__section-header">
        <div>
          <p className="gym-form__section-title">Basic info</p>
          <p className="gym-form__section-hint">Tell members where this gym lives.</p>
        </div>
      </div>
      <div className="gym-form__section-fields">
        <Field name="name" component={FormField} label="Gym name" placeholder="FitSync Downtown" />
        <Field name="location.city" component={FormField} label="City" placeholder="Mumbai" />
        <Field name="location.state" component={FormField} label="State" placeholder="Maharashtra" />
      </div>
    </section>

    <section className="gym-form__section">
      <div className="gym-form__section-header">
        <div>
          <p className="gym-form__section-title">Pricing</p>
          <p className="gym-form__section-hint">Set the plan members will pay for.</p>
        </div>
      </div>
      <div className="gym-form__section-fields">
        <Field name="pricing.mrp" component={FormField} label="MRP (₹)" type="number" min="0" step="1" />
        <Field
          name="pricing.discounted"
          component={FormField}
          label="Discounted price (₹)"
          type="number"
          min="0"
          step="1"
        />
      </div>
    </section>

    <section className="gym-form__section">
      <div className="gym-form__section-header">
        <div>
          <p className="gym-form__section-title">Contact & timings</p>
          <p className="gym-form__section-hint">Members rely on these details to plan visits.</p>
        </div>
      </div>
      <div className="gym-form__section-fields">
        <Field name="contact.phone" component={FormField} label="Contact phone" placeholder="+91 98765 43210" />
        <Field name="schedule.open" component={FormField} label="Opens" placeholder="06:00" />
        <Field name="schedule.close" component={FormField} label="Closes" placeholder="22:00" />
      </div>
    </section>

    <section className="gym-form__section gym-form__section--highlights">
      <div className="gym-form__section-header">
        <div>
          <p className="gym-form__section-title">Highlights</p>
          <p className="gym-form__section-hint">Use keywords so members know what to expect.</p>
        </div>
      </div>
      <div className="gym-form__highlights-grid">
        <div className="gym-form__highlight-row">
          <span className="gym-form__highlight-label">Description</span>
          <div className="gym-form__highlight-control">
            <Field
              name="description"
              component={FormField}
              as="textarea"
              label={null}
              placeholder="Share why members love this gym."
              rows={4}
            />
          </div>
        </div>

        <div className="gym-form__highlight-row">
          <span className="gym-form__highlight-label">Key features</span>
          <div className="gym-form__highlight-control">
            <Field
              name="keyFeatures"
              component={ChipMultiSelect}
              options={AMENITY_OPTIONS}
              helperText="Pick the amenities that members can expect."
            />
          </div>
        </div>

        <div className="gym-form__highlight-row">
          <span className="gym-form__highlight-label">Tags</span>
          <div className="gym-form__highlight-control">
            <Field
              name="tags"
              component={FormField}
              label={null}
              placeholder="weights, cardio, yoga"
            />
          </div>
        </div>
      </div>
    </section>

    <section className="gym-form__section">
      <div className="gym-form__section-header">
        <div>
          <p className="gym-form__section-title">Listing activation</p>
          <p className="gym-form__section-hint">
            Tie this gym to an active marketplace plan so it goes live instantly.
          </p>
        </div>
      </div>
      <div className="gym-form__section-fields">
        <Field
          name="planCode"
          component={FormField}
          as="select"
          label="Listing plan"
          disabled={isPlansLoading}
        >
          <option value="">Select a plan</option>
          {plans.map((plan) => (
            <option key={plan.planCode} value={plan.planCode}>
              {`${plan.label} • ₹${plan.amount.toLocaleString('en-IN')} / ${plan.durationMonths} mo`}
            </option>
          ))}
        </Field>

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
      </div>

      <Field
        name="autoRenew"
        component={FormField}
        as="checkbox"
        label="Enable auto-renew"
        type="checkbox"
      />
    </section>

    {error ? <div className="form-error">{error}</div> : null}
    {stripeError ? <div className="form-error">{stripeError}</div> : null}

    <div className="gym-form__actions">
      <button type="button" className="ghost-button" onClick={onCancel} disabled={submitting || isCreatingCheckout}>
        Cancel
      </button>
      {paymentMethod === 'stripe' ? (
        <button
          type="button"
          className="primary-button"
          onClick={handleStripePayment}
          disabled={isCreatingCheckout || isPlansLoading}
        >
          {isCreatingCheckout ? 'Processing…' : 'Pay with Stripe & Create'}
        </button>
      ) : (
        <button type="submit" className="primary-button" disabled={submitting || isPlansLoading}>
          {submitting ? 'Creating…' : 'Create gym'}
        </button>
      )}
    </div>
  </form>
  );
};

GymCreateFormComponent.propTypes = {
  handleSubmit: PropTypes.func.isRequired,
  submitting: PropTypes.bool,
  onCancel: PropTypes.func.isRequired,
  error: PropTypes.string,
  plans: PropTypes.arrayOf(
    PropTypes.shape({
      planCode: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      amount: PropTypes.number.isRequired,
      durationMonths: PropTypes.number.isRequired,
    }),
  ),
  isPlansLoading: PropTypes.bool,
};

GymCreateFormComponent.defaultProps = {
  submitting: false,
  error: null,
  plans: [],
  isPlansLoading: false,
};

const validate = (values) => {
  const errors = {};

  const trimmedName = values.name?.trim();
  if (!trimmedName) {
    errors.name = 'Gym name is required';
  }

  const city = values.location?.city?.trim();
  if (!city) {
    errors.location = { ...(errors.location ?? {}), city: 'City is required' };
  }

  const mrpInput = values.pricing?.mrp;
  const mrpValue = Number(mrpInput);
  if (mrpInput === undefined || mrpInput === null || mrpInput === '') {
    errors.pricing = { ...(errors.pricing ?? {}), mrp: 'Provide the monthly price' };
  } else if (!Number.isFinite(mrpValue) || mrpValue <= 0) {
    errors.pricing = { ...(errors.pricing ?? {}), mrp: 'Enter a valid monthly price' };
  }

  const discountedInput = values.pricing?.discounted;
  if (discountedInput !== undefined && discountedInput !== null && discountedInput !== '') {
    const discountedValue = Number(discountedInput);
    if (!Number.isFinite(discountedValue) || discountedValue < 0) {
      errors.pricing = { ...(errors.pricing ?? {}), discounted: 'Enter a valid discounted price' };
    } else if (Number.isFinite(mrpValue) && mrpValue > 0 && discountedValue > mrpValue) {
      errors.pricing = { ...(errors.pricing ?? {}), discounted: 'Discounted price cannot exceed the MRP' };
    }
  }

  if (!values.planCode) {
    errors.planCode = 'Choose a listing plan';
  }

  return errors;
};

const GymCreateForm = reduxForm({
  form: 'gymCreate',
  validate,
  enableReinitialize: false,
  initialValues: {
    autoRenew: true,
    keyFeatures: [],
  },
})(GymCreateFormComponent);

export default GymCreateForm;
