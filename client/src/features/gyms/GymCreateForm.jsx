import PropTypes from 'prop-types';
import { Field, reduxForm } from 'redux-form';
import FormField from '../../components/forms/FormField.jsx';
import './GymForms.css';

const GymCreateFormComponent = ({
  handleSubmit,
  submitting,
  onCancel,
  error,
  plans,
  isPlansLoading,
}) => (
  <form className="gym-form" onSubmit={handleSubmit}>
    <div className="gym-form__grid">
      <Field name="name" component={FormField} label="Gym name" placeholder="FitSync Downtown" />
      <Field name="location.city" component={FormField} label="City" placeholder="Mumbai" />
      <Field name="location.state" component={FormField} label="State" placeholder="Maharashtra" />
      <Field name="pricing.mrp" component={FormField} label="MRP (₹)" type="number" min="0" step="100" />
      <Field
        name="pricing.discounted"
        component={FormField}
        label="Discounted price (₹)"
        type="number"
        min="0"
        step="100"
      />
      <Field name="contact.phone" component={FormField} label="Contact phone" placeholder="+91 98765 43210" />
      <Field name="schedule.open" component={FormField} label="Opens" placeholder="06:00" />
      <Field name="schedule.close" component={FormField} label="Closes" placeholder="22:00" />
    </div>

    <Field
      name="description"
      component={FormField}
      as="textarea"
      label="Description"
      placeholder="Share why members love this gym."
      rows={4}
    />

    <Field
      name="keyFeatures"
      component={FormField}
      label="Key features"
      placeholder="AC, Personal lockers, Steam"
    />

    <Field name="tags" component={FormField} label="Tags" placeholder="weights, cardio, yoga" />

    <div>
      <h3>Listing activation</h3>
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

      <Field
        name="autoRenew"
        component={FormField}
        as="checkbox"
        label="Enable auto-renew"
        type="checkbox"
      />

      <Field
        name="paymentReference"
        component={FormField}
        label="Payment reference"
        placeholder="Txn-123456"
      />
    </div>

    {error ? <div className="form-error">{error}</div> : null}

    <div className="gym-form__actions">
      <button type="button" className="ghost-button" onClick={onCancel} disabled={submitting}>
        Cancel
      </button>
      <button type="submit" className="cta-button" disabled={submitting || isPlansLoading}>
        {submitting ? 'Creating…' : 'Create gym'}
      </button>
    </div>
  </form>
);

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

  if (!values.name) {
    errors.name = 'Gym name is required';
  }

  if (!values.location || !values.location.city) {
    errors.location = { ...(errors.location ?? {}), city: 'City is required' };
  }

  if (!values.pricing || !values.pricing.mrp) {
    errors.pricing = { ...(errors.pricing ?? {}), mrp: 'Provide the monthly price' };
  }

  if (!values.planCode) {
    errors.planCode = 'Choose a listing plan';
  }

  if (!values.paymentReference) {
    errors.paymentReference = 'Enter the payment reference used for this activation';
  }

  return errors;
};

const GymCreateForm = reduxForm({
  form: 'gymCreate',
  validate,
  enableReinitialize: false,
  initialValues: {
    autoRenew: true,
  },
})(GymCreateFormComponent);

export default GymCreateForm;
