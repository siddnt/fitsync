import PropTypes from 'prop-types';
import './ChipMultiSelect.css';

const ChipMultiSelect = ({ input, meta, options, helperText }) => {
  const currentValue = Array.isArray(input.value)
    ? input.value
    : typeof input.value === 'string' && input.value.trim().length
      ? input.value
          .split(',')
          .map((token) => token.trim())
          .filter(Boolean)
      : [];

  const toggleOption = (option) => {
    const next = currentValue.includes(option)
      ? currentValue.filter((item) => item !== option)
      : [...currentValue, option];
    input.onChange(next);
    if (input.onBlur) {
      input.onBlur(next);
    }
  };

  const showError = Boolean(meta?.touched && meta?.error);

  return (
    <div className={`chip-multiselect${showError ? ' chip-multiselect--error' : ''}`}>
      <div className="chip-multiselect__grid">
        {options.map((option) => {
          const isActive = currentValue.includes(option);
          return (
            <button
              key={option}
              type="button"
              className={isActive ? 'chip chip--active' : 'chip'}
              onClick={() => toggleOption(option)}
            >
              {option}
            </button>
          );
        })}
      </div>
      {helperText ? <small className="chip-multiselect__hint">{helperText}</small> : null}
      {showError ? <small className="chip-multiselect__error">{meta.error}</small> : null}
    </div>
  );
};

ChipMultiSelect.propTypes = {
  input: PropTypes.shape({
    value: PropTypes.any,
    onChange: PropTypes.func.isRequired,
    onBlur: PropTypes.func,
  }).isRequired,
  meta: PropTypes.shape({
    touched: PropTypes.bool,
    error: PropTypes.string,
  }),
  options: PropTypes.arrayOf(PropTypes.string),
  helperText: PropTypes.string,
};

ChipMultiSelect.defaultProps = {
  meta: null,
  options: [],
  helperText: null,
};

export default ChipMultiSelect;
