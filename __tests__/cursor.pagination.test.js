import mongoose from 'mongoose';
import {
  buildCursorFilter,
  buildCursorSortStage,
  decodeCursorToken,
  encodeCursorToken,
} from '../src/utils/cursorPagination.js';

describe('cursor pagination utilities', () => {
  const sortFields = [
    { field: 'updatedAt', order: -1, type: 'date' },
    { field: '_id', order: -1, type: 'objectId' },
  ];

  it('round-trips cursor payloads for supported field types', () => {
    const document = {
      updatedAt: new Date('2026-04-15T10:00:00.000Z'),
      _id: new mongoose.Types.ObjectId('64d2c0f0a1b2c3d4e5f67890'),
    };

    const cursor = encodeCursorToken({ document, sortFields });
    const values = decodeCursorToken(cursor, sortFields);

    expect(cursor).toBeTruthy();
    expect(values?.[0]).toEqual(new Date('2026-04-15T10:00:00.000Z'));
    expect(String(values?.[1])).toBe('64d2c0f0a1b2c3d4e5f67890');
  });

  it('builds lexicographic Mongo filters for descending cursor pagination', () => {
    const document = {
      updatedAt: new Date('2026-04-15T10:00:00.000Z'),
      _id: new mongoose.Types.ObjectId('64d2c0f0a1b2c3d4e5f67890'),
    };

    const cursor = encodeCursorToken({ document, sortFields });
    const filter = buildCursorFilter({
      baseFilter: { status: 'active' },
      cursor,
      sortFields,
    });

    expect(filter).toEqual({
      $and: [
        { status: 'active' },
        {
          $or: [
            { updatedAt: { $lt: new Date('2026-04-15T10:00:00.000Z') } },
            {
              updatedAt: new Date('2026-04-15T10:00:00.000Z'),
              _id: { $lt: new mongoose.Types.ObjectId('64d2c0f0a1b2c3d4e5f67890') },
            },
          ],
        },
      ],
    });
  });

  it('returns null for invalid cursor tokens and preserves sort order metadata', () => {
    expect(decodeCursorToken('invalid-cursor', sortFields)).toBeNull();
    expect(buildCursorFilter({
      baseFilter: { status: 'active' },
      cursor: 'invalid-cursor',
      sortFields,
    })).toBeNull();
    expect(buildCursorSortStage(sortFields)).toEqual({ updatedAt: -1, _id: -1 });
  });
});
