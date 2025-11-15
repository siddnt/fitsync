import PropTypes from 'prop-types';
import { Field, reduxForm } from 'redux-form';
import FormField from '../../components/forms/FormField.jsx';
import './GymForms.css';

const GymEditFormComponent = ({ handleSubmit, submitting, onCancel, error }) => (
  <form className="gym-form" onSubmit={handleSubmit}>
    <div className="gym-form__grid">
      <Field name="name" component={FormField} label="Gym name" placeholder="FitSync Downtown" />
      <Field name="location.city" component={FormField} label="City" placeholder="Mumbai" />
      <Field name="location.state" component={FormField} label="State" placeholder="Maharashtra" />
  <Field name="pricing.mrp" component={FormField} label="MRP (₹)" type="number" min="0" step="1" />
      <Field
        name="pricing.discounted"
        component={FormField}
        label="Discounted price (₹)"
        type="number"
        min="0"
  step="1"
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

    {error ? <div className="form-error">{error}</div> : null}

    <div className="gym-form__actions">
      <button type="button" className="ghost-button" onClick={onCancel} disabled={submitting}>
        Cancel
      </button>
      <button type="submit" className="cta-button" disabled={submitting}>
        {submitting ? 'Saving…' : 'Save changes'}
      </button>
    </div>
  </form>
);

GymEditFormComponent.propTypes = {
  handleSubmit: PropTypes.func.isRequired,
  submitting: PropTypes.bool,
  onCancel: PropTypes.func.isRequired,
  error: PropTypes.string,
};

GymEditFormComponent.defaultProps = {
  submitting: false,
  error: null,
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

  return errors;
};

const GymEditForm = reduxForm({
  form: 'gymEdit',
  enableReinitialize: true,
  keepDirtyOnReinitialize: false,
  destroyOnUnmount: true,
  validate,
})(GymEditFormComponent);

export default GymEditForm;
