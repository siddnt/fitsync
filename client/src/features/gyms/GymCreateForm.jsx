import PropTypes from 'prop-types';
import { Field, reduxForm } from 'redux-form';
import FormField from '../../components/forms/FormField.jsx';
import ChipMultiSelect from '../../components/forms/ChipMultiSelect.jsx';
import { AMENITY_OPTIONS } from '../../constants/amenities.js';
import { validateMembershipPricingValues } from './helpers.js';
import MembershipPricingSection from './MembershipPricingSection.jsx';
import './GymForms.css';

const GymCreateFormComponent = ({
  handleSubmit,
  submitting = false,
  onCancel,
  error = null,
  plans = [],
  isPlansLoading = false,
}) => (
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

    <MembershipPricingSection
      hint="Set the membership plans members can actually buy."
      note="Configure one or more plans. Leave unused plans blank."
    />

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
              {`${plan.label} / Rs${plan.amount.toLocaleString('en-IN')} / ${plan.durationMonths} mo`}
            </option>
          ))}
        </Field>
      </div>
    </section>

    {error ? <div className="form-error">{error}</div> : null}

    <div className="gym-form__actions">
      <button type="button" className="ghost-button" onClick={onCancel} disabled={submitting}>
        Cancel
      </button>
      <button type="submit" className="cta-button" disabled={submitting || isPlansLoading}>
        {submitting ? 'Creating...' : 'Create gym'}
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

  const pricingErrors = validateMembershipPricingValues(values.pricing, { requireAtLeastOne: true });
  if (pricingErrors) {
    errors.pricing = pricingErrors;
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
    keyFeatures: [],
    pricing: {
      plans: {},
    },
  },
})(GymCreateFormComponent);

export default GymCreateForm;
