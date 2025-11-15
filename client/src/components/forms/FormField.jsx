import PropTypes from 'prop-types';
import './FormField.css';

const FormField = ({ input, label, type, as, meta, children, ...rest }) => {
  const fieldType = as ?? 'input';
  const showError = Boolean(meta?.touched && meta?.error);
  const isFileField = type === 'file';

  let control = null;
  let fileName = null;

  if (fieldType === 'textarea') {
    control = <textarea {...input} {...rest} />;
  } else if (fieldType === 'select') {
    control = (
      <select {...input} {...rest}>
        {children}
      </select>
    );
  } else if (fieldType === 'checkbox') {
    control = (
      <label className="form-field__checkbox">
        <input type="checkbox" {...input} {...rest} checked={Boolean(input.value)} />
        <span>{label}</span>
      </label>
    );
  } else if (fieldType === 'radio') {
    control = (
      <label className="form-field__radio">
        <input type="radio" {...input} {...rest} />
        <span>{label}</span>
      </label>
    );
  } else if (isFileField) {
    // redux-form stores files as File objects; avoid binding the value attribute
    const { value, onChange, ...inputProps } = input;
    if (value && typeof value === 'object' && 'name' in value) {
      fileName = value.name;
    }
    control = (
      <input
        type="file"
        {...inputProps}
        {...rest}
        onChange={(event) => {
          const file = event.target.files && event.target.files.length ? event.target.files[0] : null;
          onChange(file);
          // allow the same file to be selected again if needed
          // eslint-disable-next-line no-param-reassign
          event.target.value = '';
        }}
      />
    );
  } else {
    control = <input type={type} {...input} {...rest} />;
  }

  return (
    <div className={`form-field${showError ? ' form-field--error' : ''}`}>
      {fieldType !== 'checkbox' && fieldType !== 'radio' && label ? (
        <label>
          <span className="form-field__label">{label}</span>
          {control}
        </label>
      ) : (
        control
      )}
      {isFileField && fileName ? (
        <small className="form-field__hint">Selected file: {fileName}</small>
      ) : null}
      {showError ? <small className="form-field__error">{meta.error}</small> : null}
    </div>
  );
};

FormField.propTypes = {
  input: PropTypes.object.isRequired,
  label: PropTypes.node,
  type: PropTypes.string,
  as: PropTypes.oneOf(['input', 'textarea', 'select', 'checkbox', 'radio']),
  meta: PropTypes.shape({
    touched: PropTypes.bool,
    error: PropTypes.string,
  }),
  children: PropTypes.node,
};

FormField.defaultProps = {
  label: null,
  type: 'text',
  as: 'input',
  meta: null,
  children: null,
};

export default FormField;
