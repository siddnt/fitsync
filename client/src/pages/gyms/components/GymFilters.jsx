import PropTypes from 'prop-types';
import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';

const amenitiesOptions = ['AC', 'Nutrition', 'Steam', 'Swimming', 'Parking', 'Showers'];

const GymFilters = ({ filters, onChange }) => {
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
            <input
              {...field}
              type="text"
              placeholder="Search by gym"
              onChange={(event) => {
                field.onChange(event);
                handleFieldChange('search', event.target.value);
              }}
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
            <input
              {...field}
              type="text"
              placeholder="e.g. Mumbai"
              onChange={(event) => {
                field.onChange(event);
                handleFieldChange('city', event.target.value);
              }}
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
              {amenitiesOptions.map((amenity) => {
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
};

export default GymFilters;
