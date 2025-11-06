import PropTypes from 'prop-types';
import './FormField.css';

const FormField = ({ input, label, type, as, meta, children, ...rest }) => {
  const fieldType = as ?? 'input';
  const showError = Boolean(meta?.touched && meta?.error);

  let control = null;

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
