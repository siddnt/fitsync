import PropTypes from 'prop-types';
import { Field, reduxForm } from 'redux-form';
import FormField from '../../../components/forms/FormField.jsx';
import '../Dashboard.css';

import { renderCategoryOptions, validateProductForm } from './helpers.js';

const filePropType = typeof File !== 'undefined' ? PropTypes.instanceOf(File) : PropTypes.any;

const renderImageField = ({
  input,
  meta,
  label,
  disabled,
  accept,
  onImageSelect,
  selectedFile,
}) => {
  const showError = Boolean(meta?.touched && meta?.error);
  const selectedName = selectedFile?.name
    || (input.value && input.value !== '__existing__' ? input.value : null);

  const handleBlur = () => {
    if (typeof input.onBlur === 'function') {
      input.onBlur(input.value);
    }
  };

  const handleChange = (event) => {
    const file = event.target.files && event.target.files.length ? event.target.files[0] : null;
    onImageSelect?.(file || null);

    const nextValue = file ? file.name : '';
    input.onChange(nextValue);
    if (typeof input.onBlur === 'function') {
      input.onBlur(nextValue);
    }

    // allow reselecting the same file if needed
    // eslint-disable-next-line no-param-reassign
    event.target.value = '';
  };

  return (
    <div className={`form-field${showError ? ' form-field--error' : ''}`}>
      <label>
        <span className="form-field__label">{label}</span>
        <input
          name={input.name}
          type="file"
          accept={accept}
          disabled={disabled}
          onChange={handleChange}
          onBlur={handleBlur}
          onFocus={typeof input.onFocus === 'function' ? input.onFocus : undefined}
        />
      </label>
      {selectedName ? (
        <small className="form-field__hint">Selected file: {selectedName}</small>
      ) : null}
      {showError ? <small className="form-field__error">{meta.error}</small> : null}
    </div>
  );
};

const SellerProductFormComponent = ({
  handleSubmit,
  submitting,
  onCancel,
  isEditing,
  error,
  submitSucceeded,
  initialValues,
  onImageSelect,
  selectedFile,
  previewUrl,
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
        name="mrp"
        component={FormField}
        label="MRP (₹)"
        placeholder="List price"
        type="number"
        step="0.01"
        min="0"
      />
      <Field
        name="price"
        component={FormField}
        label="Selling price (₹)"
        placeholder="Optional if no discount"
        type="number"
        step="0.01"
        min="0"
      />
      <Field
        name="stock"
        component={FormField}
        label="Stock"
        type="number"
        min="0"
        placeholder="Units available"
      />
    </div>

    <Field
      name="description"
      component={FormField}
      label="Description"
      as="textarea"
      placeholder="Tell customers what makes this product shine"
    />

    <div className="form-grid">
      <Field
        name="image"
        component={renderImageField}
        label={isEditing ? 'Replace product image' : 'Product image'}
        accept="image/*"
        disabled={submitting}
        onImageSelect={onImageSelect}
        selectedFile={selectedFile}
      />
      {selectedFile && previewUrl ? (
        <div className="form-field form-field--static">
          <span className="form-field__label">Selected image preview</span>
          <div className="form-field__static-preview">
            <img
              src={previewUrl}
              alt="Selected product preview"
              className="form-field__thumbnail"
              loading="lazy"
            />
            <small>This preview uses your latest file selection.</small>
          </div>
        </div>
      ) : null}
      {isEditing && initialValues?.existingImageUrl ? (
        <div className="form-field form-field--static">
          <span className="form-field__label">Current image</span>
          <div className="form-field__static-preview">
            <img
              src={initialValues.existingImageUrl}
              alt="Current product"
              className="form-field__thumbnail"
              loading="lazy"
            />
            <small>Leave empty to keep the existing image.</small>
          </div>
        </div>
      ) : null}
    </div>

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
  initialValues: PropTypes.shape({
    existingImageUrl: PropTypes.string,
  }),
  onImageSelect: PropTypes.func.isRequired,
  selectedFile: filePropType,
  previewUrl: PropTypes.string,
};

SellerProductFormComponent.defaultProps = {
  submitting: false,
  isEditing: false,
  error: null,
  submitSucceeded: false,
  initialValues: null,
  selectedFile: null,
  previewUrl: null,
};

const SellerProductForm = reduxForm({
  form: 'sellerProduct',
  enableReinitialize: true,
  keepDirtyOnReinitialize: false,
  destroyOnUnmount: false,
  validate: validateProductForm,
  initialValues: {
    status: 'available',
  },
})(SellerProductFormComponent);

export default SellerProductForm;
