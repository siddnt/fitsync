import PropTypes from 'prop-types';
import { Field, reduxForm } from 'redux-form';
import FormField from '../../../components/forms/FormField.jsx';
import '../Dashboard.css';

import { renderCategoryOptions, validateProductForm } from './helpers.js';

const SellerProductFormComponent = ({
  handleSubmit,
  submitting,
  onCancel,
  isEditing,
  error,
  submitSucceeded,
}) => (
  <form className="dashboard-form" onSubmit={handleSubmit}>
    <div className="form-grid">
      <Field
        name="name"
        component={FormField}
        label="Product name"
        placeholder="E.g. Muscle recovery whey"
      />
      <Field
        name="category"
        component={FormField}
        label="Category"
        as="select"
      >
        {renderCategoryOptions()}
      </Field>
      <Field
        name="price"
        component={FormField}
        label="Price (₹)"
        type="number"
        step="0.01"
      />
      <Field
        name="stock"
        component={FormField}
        label="Stock"
        type="number"
        placeholder="Optional"
      />
    </div>

    <Field
      name="description"
      component={FormField}
      label="Description"
      as="textarea"
      placeholder="Tell customers what makes this product shine"
    />

    <Field
      name="image"
      component={FormField}
      label="Image URL"
      placeholder="https://"
    />

    <div className="form-grid">
      <Field
        name="status"
        component={FormField}
        label="Stock status"
        as="select"
      >
        <option value="available">Available</option>
        <option value="out-of-stock">Out of stock</option>
      </Field>
      <Field
        name="isPublished"
        component={FormField}
        label="Show in marketplace"
        as="checkbox"
        type="checkbox"
      />
    </div>

    {error ? <div className="form-error">{error}</div> : null}
    {submitSucceeded && !error ? (
      <div className="form-success">Product saved.</div>
    ) : null}

    <div className="button-row">
      <button type="submit" disabled={submitting}>
        {submitting ? 'Saving…' : isEditing ? 'Update product' : 'Add product'}
      </button>
      <button type="button" onClick={onCancel} className="secondary-button" disabled={submitting}>
        Cancel
      </button>
    </div>
  </form>
);

SellerProductFormComponent.propTypes = {
  handleSubmit: PropTypes.func.isRequired,
  submitting: PropTypes.bool,
  onCancel: PropTypes.func.isRequired,
  isEditing: PropTypes.bool,
  error: PropTypes.string,
  submitSucceeded: PropTypes.bool,
};

SellerProductFormComponent.defaultProps = {
  submitting: false,
  isEditing: false,
  error: null,
  submitSucceeded: false,
};

const SellerProductForm = reduxForm({
  form: 'sellerProduct',
  enableReinitialize: true,
  keepDirtyOnReinitialize: false,
  destroyOnUnmount: false,
  validate: validateProductForm,
  initialValues: {
    status: 'available',
    isPublished: true,
  },
})(SellerProductFormComponent);

export default SellerProductForm;
