import PropTypes from 'prop-types';
import { Field, reduxForm } from 'redux-form';
import FormField from '../../components/forms/FormField.jsx';
import ChipMultiSelect from '../../components/forms/ChipMultiSelect.jsx';
import { AMENITY_OPTIONS } from '../../constants/amenities.js';

const WEEKDAY_OPTIONS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
import { validateMembershipPricingValues } from './helpers.js';
import MembershipPricingSection from './MembershipPricingSection.jsx';
import './GymForms.css';

const GymEditFormComponent = ({
  handleSubmit,
  submitting = false,
  onCancel,
  error = null,
}) => (
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
        <Field name="location.address" component={FormField} label="Street address" placeholder="12 Residency Road" />
        <Field name="location.city" component={FormField} label="City" placeholder="Mumbai" />
        <Field name="location.state" component={FormField} label="State" placeholder="Maharashtra" />
      </div>
    </section>

    <MembershipPricingSection
      hint="Keep memberships transparent with the exact plans buyers can choose."
      note="At least one membership plan must stay active."
    />

    <section className="gym-form__section">
      <div className="gym-form__section-header">
        <div>
          <p className="gym-form__section-title">Contact & timings</p>
          <p className="gym-form__section-hint">Share how and when members can reach you.</p>
        </div>
      </div>
      <div className="gym-form__section-fields">
        <Field name="contact.phone" component={FormField} label="Contact phone" placeholder="+91 98765 43210" />
        <Field name="contact.email" component={FormField} label="Contact email" placeholder="hello@fitsyncgym.com" />
        <Field name="contact.website" component={FormField} label="Website" placeholder="https://fitsyncgym.com" />
        <Field name="schedule.open" component={FormField} label="Opens" placeholder="06:00" />
        <Field name="schedule.close" component={FormField} label="Closes" placeholder="22:00" />
      </div>
      <div className="gym-form__section-fields">
        <div className="gym-form__highlight-row">
          <span className="gym-form__highlight-label">Working days</span>
          <div className="gym-form__highlight-control">
            <Field
              name="schedule.workingDays"
              component={ChipMultiSelect}
              options={WEEKDAY_OPTIONS}
              helperText="Pick the days the gym is open. Opening hours apply to every selected day."
            />
          </div>
        </div>
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

        <div className="gym-form__highlight-row">
          <span className="gym-form__highlight-label">Gallery URLs</span>
          <div className="gym-form__highlight-control">
            <Field
              name="gallery"
              component={FormField}
              as="textarea"
              label={null}
              placeholder={'https://.../lobby.jpg\nhttps://.../weights-floor.jpg'}
              rows={4}
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
        {submitting ? 'Saving...' : 'Save changes'}
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

const validate = (values) => {
  const errors = {};
  const pricingErrors = validateMembershipPricingValues(values.pricing, { requireAtLeastOne: true });

  if (pricingErrors) {
    errors.pricing = pricingErrors;
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
