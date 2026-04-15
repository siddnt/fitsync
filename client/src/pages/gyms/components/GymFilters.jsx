import PropTypes from 'prop-types';
import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { AMENITY_OPTIONS } from '../../../constants/amenities.js';
import SearchSuggestInput from '../../../components/dashboard/SearchSuggestInput.jsx';

const GymFilters = ({
  filters,
  onChange,
  searchSuggestions = [],
  citySuggestions = [],
}) => {
  const { control, setValue } = useForm({
    defaultValues: filters,
  });

  const handleFieldChange = (key, value) => {
    setValue(key, value, { shouldDirty: true, shouldTouch: true });
    onChange((prev) => {
      if (typeof prev === 'function') {
        // Support alternative setters though parent uses setState
        return prev((state) => ({ ...state, [key]: value }));
      }
      return { ...prev, [key]: value };
    });
  };

  const handleAmenitiesToggle = (currentAmenities, amenity, fieldOnChange) => {
    const next = currentAmenities.includes(amenity)
      ? currentAmenities.filter((value) => value !== amenity)
      : [...currentAmenities, amenity];
    fieldOnChange(next);
    onChange((prev) => ({ ...prev, amenities: next }));
  };

  useEffect(() => {
    setValue('search', filters.search);
    setValue('city', filters.city);
    setValue('amenities', filters.amenities);
  }, [filters, setValue]);

  return (
    <form className="gym-filters">
      <label>
        <span>Search</span>
        <Controller
          control={control}
          name="search"
          render={({ field }) => (
            <SearchSuggestInput
              id="gym-search"
              value={field.value ?? ''}
              onChange={(value) => {
                field.onChange(value);
                handleFieldChange('search', value);
              }}
              onSelect={(suggestion) => {
                field.onChange(suggestion.label);
                handleFieldChange('search', suggestion.label);
              }}
              suggestions={searchSuggestions}
              placeholder="Search by gym"
              ariaLabel="Search gyms"
              noResultsText="No gyms match those search attributes."
              className="gym-filters__search"
              inputClassName="gym-filters__search-input"
            />
          )}
        />
      </label>

      <label>
        <span>City</span>
        <Controller
          control={control}
          name="city"
          render={({ field }) => (
            <SearchSuggestInput
              id="gym-city"
              value={field.value ?? ''}
              onChange={(value) => {
                field.onChange(value);
                handleFieldChange('city', value);
              }}
              onSelect={(suggestion) => {
                field.onChange(suggestion.label);
                handleFieldChange('city', suggestion.label);
              }}
              suggestions={citySuggestions}
              placeholder="e.g. Mumbai"
              ariaLabel="Filter gyms by city"
              noResultsText="No city suggestions match."
              className="gym-filters__search"
              inputClassName="gym-filters__search-input"
            />
          )}
        />
      </label>

      <fieldset>
        <legend>Amenities</legend>
        <Controller
          control={control}
          name="amenities"
          render={({ field }) => (
            <div className="gym-filters__chips">
              {AMENITY_OPTIONS.map((amenity) => {
                const isSelected = field.value.includes(amenity);
                return (
                  <button
                    key={amenity}
                    type="button"
                    className={isSelected ? 'chip chip--active' : 'chip'}
                    onClick={() => handleAmenitiesToggle(field.value, amenity, field.onChange)}
                  >
                    {amenity}
                  </button>
                );
              })}
            </div>
          )}
        />
      </fieldset>
    </form>
  );
};

GymFilters.propTypes = {
  filters: PropTypes.shape({
    search: PropTypes.string,
    city: PropTypes.string,
    amenities: PropTypes.arrayOf(PropTypes.string),
  }).isRequired,
  onChange: PropTypes.func.isRequired,
  searchSuggestions: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    meta: PropTypes.string,
  })),
  citySuggestions: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    meta: PropTypes.string,
  })),
};

export default GymFilters;
