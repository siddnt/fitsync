import mongoose from 'mongoose';
import { ApiError } from '../utils/ApiError.js';

const MAX_PAGE_SIZE = 100;

const normalizeAmenities = (value) => {
  if (value === undefined) {
    return undefined;
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  throw new ApiError(400, 'Amenities filter is invalid.');
};

export const requireActiveUser = (req, _res, next) => {
  if (req.user?.status !== 'active') {
    throw new ApiError(403, 'User account is not active.');
  }

  next();
};

export const validateGymListQuery = (req, _res, next) => {
  const { page, limit, search, city, amenities } = req.query ?? {};

  if (page !== undefined) {
    const parsedPage = Number(page);
    if (!Number.isInteger(parsedPage) || parsedPage < 1) {
      throw new ApiError(400, 'Page must be a positive integer.');
    }
    req.query.page = String(parsedPage);
  }

  if (limit !== undefined) {
    const parsedLimit = Number(limit);
    if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > MAX_PAGE_SIZE) {
      throw new ApiError(400, `Limit must be a positive integer not greater than ${MAX_PAGE_SIZE}.`);
    }
    req.query.limit = String(parsedLimit);
  }

  if (search !== undefined && typeof search !== 'string') {
    throw new ApiError(400, 'Search filter must be a string.');
  }

  if (city !== undefined && typeof city !== 'string') {
    throw new ApiError(400, 'City filter must be a string.');
  }

  if (amenities !== undefined) {
    req.query.amenities = normalizeAmenities(amenities);
  }

  next();
};

export const validateObjectIdParam = (paramName, label = paramName) => (req, _res, next) => {
  const value = req.params?.[paramName];

  if (!value || !mongoose.Types.ObjectId.isValid(value)) {
    throw new ApiError(400, `${label} is invalid.`);
  }

  next();
};
