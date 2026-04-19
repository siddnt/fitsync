import mongoose from 'mongoose';
import { ApiError } from './ApiError.js';

const toObjectId = (value, label = 'Id') => {
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
