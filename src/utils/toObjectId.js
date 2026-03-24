import mongoose from 'mongoose';
import { ApiError } from './ApiError.js';

/**
 * Safely converts a value to a Mongoose ObjectId.
 * Throws ApiError if the value is missing or invalid.
 */
const toObjectId = (value, label = 'ID') => {
  if (!value) {
    throw new ApiError(400, `${label} is required.`);
  }
  try {
    return new mongoose.Types.ObjectId(value);
  } catch (_error) {
    throw new ApiError(400, `${label} is invalid.`);
  }
};

export default toObjectId;
