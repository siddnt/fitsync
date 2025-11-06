/**
 * Redux Form Utilities
 * Helper functions for form submission with RTK Query mutations
 */

/**
 * Creates a form submission handler that integrates with RTK Query mutations
 * @param {Object} options - Configuration options
 * @param {Function} options.mutation - RTK Query mutation hook result array
 * @param {Function} options.validate - Validation function that returns errors object
 * @param {Function} options.prepare - Optional function to transform form data before submission
 * @param {Function} options.onSuccess - Optional callback after successful submission
 * @param {Function} options.onError - Optional callback after failed submission
 * @param {Function} options.setErrors - State setter for form errors
 * @returns {Function} Submission handler function
 */
export const createSubmissionHandler = ({
  mutation,
  validate,
  prepare,
  onSuccess,
  onError,
  setErrors,
}) => {
  return async (formData) => {
    // Clear previous errors
    if (setErrors) {
      setErrors({});
    }

    // Validate form data
    if (validate) {
      const validationErrors = validate(formData);
      if (Object.keys(validationErrors).length > 0) {
        if (setErrors) {
          setErrors(validationErrors);
        }
        return;
      }
    }

    try {
      // Prepare data if transformer provided
      const payload = prepare ? prepare(formData) : formData;

      // Execute mutation
      const result = await mutation(payload).unwrap();

      // Call success callback if provided
      if (onSuccess) {
        onSuccess(result);
      }

      return result;
    } catch (error) {
      // Handle API errors
      const errorMessage = error?.data?.message || error?.message || 'An error occurred';
      
      if (setErrors) {
        setErrors({ _form: errorMessage });
      }

      // Call error callback if provided
      if (onError) {
        onError(error);
      }

      throw error;
    }
  };
};

/**
 * Common validation rules
 */
export const validators = {
  required: (value, message = 'This field is required') => {
    if (!value || (typeof value === 'string' && !value.trim())) {
      return message;
    }
    return null;
  },

  email: (value, message = 'Invalid email address') => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (value && !emailRegex.test(value)) {
      return message;
    }
    return null;
  },

  minLength: (min) => (value, message = `Minimum ${min} characters required`) => {
    if (value && value.length < min) {
      return message;
    }
    return null;
  },

  maxLength: (max) => (value, message = `Maximum ${max} characters allowed`) => {
    if (value && value.length > max) {
      return message;
    }
    return null;
  },

  number: (value, message = 'Must be a valid number') => {
    if (value && isNaN(Number(value))) {
      return message;
    }
    return null;
  },

  min: (min) => (value, message = `Minimum value is ${min}`) => {
    if (value && Number(value) < min) {
      return message;
    }
    return null;
  },

  max: (max) => (value, message = `Maximum value is ${max}`) => {
    if (value && Number(value) > max) {
      return message;
    }
    return null;
  },

  url: (value, message = 'Invalid URL format') => {
    try {
      if (value) {
        new URL(value);
      }
      return null;
    } catch {
      return message;
    }
  },
};

/**
 * Combine multiple validators for a single field
 * @param {...Function} validators - Validator functions
 * @returns {Function} Combined validator
 */
export const combineValidators = (...validators) => {
  return (value) => {
    for (const validator of validators) {
      const error = validator(value);
      if (error) {
        return error;
      }
    }
    return null;
  };
};
