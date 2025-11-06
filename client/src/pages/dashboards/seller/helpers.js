import { createElement } from 'react';
import { SubmissionError } from 'redux-form';

export const categoryOptions = [
  { value: 'supplements', label: 'Supplements' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'clothing', label: 'Clothing' },
  { value: 'accessories', label: 'Accessories' },
];

export const normaliseCategoryValue = (value) => {
  if (typeof value !== 'string') {
    return value;
  }

  const lower = value.toLowerCase();

  if (lower === 'apparel') {
    return 'clothing';
  }

  if (lower === 'nutrition') {
    return 'supplements';
  }

  return lower;
};

export const renderCategoryOptions = () => [
  createElement('option', { key: 'placeholder', value: '' }, 'Select category'),
  ...categoryOptions.map((option) =>
    createElement('option', { key: option.value, value: option.value }, option.label),
  ),
];

export const validateProductForm = (values) => {
  const errors = {};

  if (!values.name) {
    errors.name = 'Product name is required';
  }
  if (!values.description) {
    errors.description = 'Add a short description';
  }
  if (values.price === undefined || values.price === null || values.price === '') {
    errors.price = 'Price is required';
  } else if (Number.isNaN(Number(values.price))) {
    errors.price = 'Price must be a number';
  }
  if (values.stock === undefined || values.stock === null || values.stock === '') {
    errors.stock = 'Stock quantity is required';
  } else if (Number.isNaN(Number(values.stock))) {
    errors.stock = 'Stock must be a number';
  } else if (Number(values.stock) < 0) {
    errors.stock = 'Stock cannot be negative';
  }
  if (!values.category) {
    errors.category = 'Pick a category';
  }

  return errors;
};

export const createSubmissionHandler = (mutator) => async (values) => {
  try {
    await mutator(values);
  } catch (mutationError) {
    throw new SubmissionError({
      _error: mutationError?.data?.message ?? 'Could not save the product.',
    });
  }
};
