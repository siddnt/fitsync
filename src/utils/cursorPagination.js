import mongoose from 'mongoose';

const getFieldValue = (document, path) =>
  path.split('.').reduce((value, segment) => value?.[segment], document);

const buildSignature = (sortFields = []) =>
  sortFields.map(({ field, order }) => `${field}:${order}`).join('|');

const serializeValue = (value, type = 'string') => {
  if (value === undefined || value === null) {
    return null;
  }

  if (type === 'date') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  if (type === 'objectId') {
    return String(value);
  }

  return value;
};

const deserializeValue = (value, type = 'string') => {
  if (value === undefined || value === null) {
    return null;
  }

  if (type === 'date') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (type === 'number') {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : null;
  }

  if (type === 'objectId') {
    return mongoose.Types.ObjectId.isValid(value)
      ? new mongoose.Types.ObjectId(value)
      : null;
  }

  return String(value);
};

export const encodeCursorToken = ({ document, sortFields = [] }) => {
  if (!document || !sortFields.length) {
    return null;
  }

  const values = sortFields.map(({ field, type }) => serializeValue(getFieldValue(document, field), type));
  if (values.some((value) => value === null || value === undefined)) {
    return null;
  }

  const payload = {
    v: 1,
    s: buildSignature(sortFields),
    values,
  };

  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
};

export const decodeCursorToken = (cursor, sortFields = []) => {
  if (!cursor) {
    return [];
  }

  try {
    const raw = Buffer.from(cursor, 'base64url').toString('utf8');
    const payload = JSON.parse(raw);

    if (payload?.v !== 1 || payload?.s !== buildSignature(sortFields)) {
      return null;
    }

    if (!Array.isArray(payload.values) || payload.values.length !== sortFields.length) {
      return null;
    }

    const values = payload.values.map((value, index) =>
      deserializeValue(value, sortFields[index]?.type));

    return values.every((value) => value !== null && value !== undefined)
      ? values
      : null;
  } catch (_error) {
    return null;
  }
};

export const buildCursorSortStage = (sortFields = []) =>
  sortFields.reduce((stage, { field, order }) => {
    stage[field] = order;
    return stage;
  }, {});

export const buildCursorFilter = ({
  baseFilter = {},
  cursor,
  sortFields = [],
}) => {
  if (!cursor) {
    return baseFilter;
  }

  const values = decodeCursorToken(cursor, sortFields);
  if (!values) {
    return null;
  }

  const orConditions = sortFields.map(({ field, order }, index) => {
    const condition = {};

    for (let cursorIndex = 0; cursorIndex < index; cursorIndex += 1) {
      condition[sortFields[cursorIndex].field] = values[cursorIndex];
    }

    condition[field] = {
      [order >= 0 ? '$gt' : '$lt']: values[index],
    };

    return condition;
  });

  if (!orConditions.length) {
    return baseFilter;
  }

  return {
    $and: [baseFilter, { $or: orConditions }],
  };
};

