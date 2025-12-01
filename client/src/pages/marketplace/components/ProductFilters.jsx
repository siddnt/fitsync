import PropTypes from 'prop-types';

const CATEGORY_OPTIONS = [
  { value: 'all', label: 'All categories' },
  { value: 'supplements', label: 'Supplements' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'clothing', label: 'Clothing' },
  { value: 'accessories', label: 'Accessories' },
];

const PRICE_PRESETS = [
  { id: 'under-500', label: 'Under ₹500', min: 0, max: 500 },
  { id: '500-1000', label: '₹500 – ₹1,000', min: 500, max: 1000 },
  { id: '1000-2000', label: '₹1,000 – ₹2,000', min: 1000, max: 2000 },
  { id: '2000-plus', label: '₹2,000+', min: 2000, max: null },
];

const ProductFilters = ({ filters, onChange, onReset, onPricePreset, disabled }) => (
  <aside className="marketplace-sidebar" aria-label="Marketplace filters">
    <div className="marketplace-filter-group">
      <div className="marketplace-filter-group__header">
        <h3>Filters</h3>
        <button type="button" onClick={onReset} disabled={disabled}>
          Reset
        </button>
      </div>
    </div>

    <div className="marketplace-filter-group">
      <label htmlFor="marketplace-category">Category</label>
      <select
        id="marketplace-category"
        value={filters.category}
        onChange={(event) => onChange({ category: event.target.value })}
        disabled={disabled}
      >
        {CATEGORY_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>

    <div className="marketplace-filter-group">
      <span className="marketplace-filter-group__label">Price</span>
      <div className="marketplace-filter-group__chips">
        {PRICE_PRESETS.map((preset) => (
          <button
            type="button"
            key={preset.id}
            onClick={() => onPricePreset(preset.min, preset.max)}
            disabled={disabled}
          >
            {preset.label}
          </button>
        ))}
      </div>
      <div className="marketplace-price-inputs">
        <label htmlFor="price-min">Min</label>
        <input
          id="price-min"
          type="number"
          min="0"
          inputMode="numeric"
          value={filters.minPrice}
          onChange={(event) => onChange({ minPrice: event.target.value })}
          disabled={disabled}
        />
        <label htmlFor="price-max">Max</label>
        <input
          id="price-max"
          type="number"
          min="0"
          inputMode="numeric"
          value={filters.maxPrice}
          onChange={(event) => onChange({ maxPrice: event.target.value })}
          disabled={disabled}
        />
      </div>
    </div>

    <div className="marketplace-filter-group">
      <label className="marketplace-toggle">
        <input
          type="checkbox"
          checked={filters.inStockOnly}
          onChange={(event) => onChange({ inStockOnly: event.target.checked })}
          disabled={disabled}
        />
        <span>Only show in-stock items</span>
      </label>
    </div>
  </aside>
);

ProductFilters.propTypes = {
  filters: PropTypes.shape({
    category: PropTypes.string,
    minPrice: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    maxPrice: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    inStockOnly: PropTypes.bool,
  }).isRequired,
  onChange: PropTypes.func.isRequired,
  onReset: PropTypes.func.isRequired,
  onPricePreset: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
};

ProductFilters.defaultProps = {
  disabled: false,
};

export default ProductFilters;
