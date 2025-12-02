import PropTypes from 'prop-types';
import { Field, reduxForm } from 'redux-form';
import FormField from '../../components/forms/FormField.jsx';
import ChipMultiSelect from '../../components/forms/ChipMultiSelect.jsx';
import { AMENITY_OPTIONS } from '../../constants/amenities.js';
import './GymForms.css';

const GymEditFormComponent = ({ handleSubmit, submitting, onCancel, error }) => (
  <form className="gym-form" onSubmit={handleSubmit}>
    <section className="gym-form__section">
      <div className="gym-form__section-header">
        <div>
          <p className="gym-form__section-title">Basic info</p>
          <p className="gym-form__section-hint">Members see these details first.</p>
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
          <p className="gym-form__section-hint">Keep memberships transparent for members.</p>
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
          <p className="gym-form__section-hint">Share how and when members can reach you.</p>
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
          <p className="gym-form__section-hint">Add colour to the listing with specifics.</p>
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
              helperText="Pick the amenities that match this gym."
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

  const mrpInput = values.pricing?.mrp;
  const mrpProvided = mrpInput !== undefined && mrpInput !== null && mrpInput !== '';
  const mrpValue = mrpProvided ? Number(mrpInput) : undefined;
  if (mrpProvided) {
    if (!Number.isFinite(mrpValue) || mrpValue <= 0) {
      errors.pricing = { ...(errors.pricing ?? {}), mrp: 'Enter a valid monthly price' };
    }
  }

  const discountedInput = values.pricing?.discounted;
  const discountedProvided = discountedInput !== undefined && discountedInput !== null && discountedInput !== '';
  if (discountedProvided) {
    const discountedValue = Number(discountedInput);
    if (!Number.isFinite(discountedValue) || discountedValue < 0) {
      errors.pricing = { ...(errors.pricing ?? {}), discounted: 'Enter a valid discounted price' };
    } else if (mrpProvided && Number.isFinite(mrpValue) && discountedValue > mrpValue) {
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
