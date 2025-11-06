import PropTypes from 'prop-types';
import { Field, reduxForm } from 'redux-form';
import { useDispatch, useSelector } from 'react-redux';
import FormField from '../../components/forms/FormField.jsx';
import {
  selectGym,
  selectSponsorshipTier,
} from './monetisationSlice.js';
import './MonetisationForms.css';

const TierOptionField = ({ input, option, onSelected }) => {
  const isSelected = input.value === option.tier;

  return (
    <label className={`plan-card${isSelected ? ' plan-card--selected' : ''}`}>
      <input
        type="radio"
        value={option.tier}
        checked={isSelected}
        onChange={() => {
          input.onChange(option.tier);
          onSelected(option.tier);
        }}
      />
      <div className="plan-card__header">
        <h4>{option.label}</h4>
        <span className="plan-card__price">₹{option.amount} / {option.durationMonths} mo</span>
      </div>
      <ul className="plan-card__features">
        <li>Monthly budget · ₹{option.monthlyBudget}</li>
        <li>Estimated reach · {option.reach.toLocaleString()}</li>
      </ul>
    </label>
  );
};

TierOptionField.propTypes = {
  input: PropTypes.object.isRequired,
  option: PropTypes.shape({
    tier: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    amount: PropTypes.number.isRequired,
    durationMonths: PropTypes.number.isRequired,
    monthlyBudget: PropTypes.number.isRequired,
    reach: PropTypes.number.isRequired,
  }).isRequired,
  onSelected: PropTypes.func.isRequired,
};

const SponsorshipFormComponent = ({
  handleSubmit,
  gymOptions,
  packages,
  submitting,
  error,
  submitSucceeded,
}) => {
  const dispatch = useDispatch();
  const lastReceipt = useSelector((state) => state.monetisation.lastReceipt);

  return (
    <form className="monetisation-form" onSubmit={handleSubmit}>
      <Field
        name="gymId"
        component={({ input, meta }) => (
          <FormField
            input={{
              ...input,
              onChange: (value) => {
                input.onChange(value);
                dispatch(selectGym(value));
              },
            }}
            label="Gym"
            as="select"
            meta={meta}
          >
            <option value="">Select a gym</option>
            {gymOptions.map((gym) => (
              <option key={gym.id} value={gym.id}>
                {gym.name}
              </option>
            ))}
          </FormField>
        )}
      />

      <div className="plan-grid">
        {packages.map((pkg) => (
          <Field
            key={pkg.tier}
            name="tier"
            component={TierOptionField}
            option={pkg}
            onSelected={(tier) => dispatch(selectSponsorshipTier(tier))}
          />
        ))}
      </div>

      <Field
        name="paymentReference"
        component={FormField}
        label="Payment reference"
        placeholder="Txn-987654"
      />

      {error ? <div className="form-error">{error}</div> : null}
      {submitSucceeded && lastReceipt ? (
        <div className="form-success">
          Sponsorship activated · Ref #{lastReceipt}
        </div>
      ) : null}

      <button type="submit" className="cta-button" disabled={submitting}>
        {submitting ? 'Processing…' : 'Activate sponsorship'}
      </button>
    </form>
  );
};

SponsorshipFormComponent.propTypes = {
  handleSubmit: PropTypes.func.isRequired,
  gymOptions: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
    }),
  ),
  packages: PropTypes.arrayOf(PropTypes.shape({
    tier: PropTypes.string.isRequired,
  })),
  submitting: PropTypes.bool,
  error: PropTypes.string,
  submitSucceeded: PropTypes.bool,
};

SponsorshipFormComponent.defaultProps = {
  gymOptions: [],
  packages: [],
  submitting: false,
  error: null,
  submitSucceeded: false,
};

const validate = (values) => {
  const errors = {};

  if (!values.gymId) {
    errors.gymId = 'Select a gym to continue';
  }
  if (!values.tier) {
    errors.tier = 'Choose a sponsorship package';
  }

  return errors;
};

const SponsorshipForm = reduxForm({
  form: 'sponsorshipPurchase',
  validate,
  enableReinitialize: true,
})(SponsorshipFormComponent);

export default SponsorshipForm;
