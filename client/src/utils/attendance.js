const NORMALISED_STATUSES = ['present', 'late', 'absent'];

const cloneCounts = () => ({ present: 0, late: 0, absent: 0 });

export const getDateKey = (value) => {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const toUtcDate = (dateKey) => (dateKey ? new Date(`${dateKey}T00:00:00.000Z`) : null);

const resolveStartDate = (attendanceMap, enrollmentStart) => {
  const startKey = getDateKey(enrollmentStart);
  if (startKey) {
    return toUtcDate(startKey);
  }
  const keys = Object.keys(attendanceMap || {});
  if (!keys.length) {
    return null;
  }
  keys.sort();
  return toUtcDate(keys[0]);
};

export const normaliseStatus = (value) => {
  if (!value) {
    return null;
  }
  const normalized = value.toString().toLowerCase();
  return NORMALISED_STATUSES.includes(normalized) ? normalized : null;
};

export const buildAttendanceMap = (records = [], enrollmentStart = null) => {
  const map = {};
  const todayKey = getDateKey(new Date());
  const today = toUtcDate(todayKey);

  (Array.isArray(records) ? records : []).forEach((record) => {
    const dateKey = getDateKey(record?.date);
    if (!dateKey) {
      return;
    }
    map[dateKey] = {
      status: normaliseStatus(record.status),
      notes: record.notes ?? null,
    };
  });

  const startKey = getDateKey(enrollmentStart);
  if (startKey && today) {
    const cursor = toUtcDate(startKey);
    while (cursor <= today) {
      const dateKey = getDateKey(cursor);
      if (!map[dateKey]) {
        map[dateKey] = { status: 'absent', notes: null };
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }

  return map;
};

export const getAttendanceStats = (attendanceMap = {}, enrollmentStart = null, lookbackDays = 30) => {
  const todayKey = getDateKey(new Date());
  if (!todayKey) {
    return {
      counts: cloneCounts(),
      percentages: { present: 0, late: 0, absent: 0 },
      totalDays: 0,
      range: null,
    };
  }

  const today = toUtcDate(todayKey);
  const startBoundaryKey = getDateKey(enrollmentStart);
  const startBoundary = startBoundaryKey ? toUtcDate(startBoundaryKey) : null;

  const counts = cloneCounts();
  let consideredDays = 0;
  let firstIncludedKey = null;

  for (let offset = 0; offset < lookbackDays; offset += 1) {
    const cursor = new Date(today);
    cursor.setUTCDate(cursor.getUTCDate() - offset);

    if (startBoundary && cursor < startBoundary) {
      break;
    }

    const dateKey = getDateKey(cursor);
    const status = attendanceMap[dateKey]?.status ?? (startBoundary ? 'absent' : null);
    const normalised = normaliseStatus(status) ?? 'absent';

    counts[normalised] += 1;
    consideredDays += 1;
    firstIncludedKey = dateKey;
  }

  if (!consideredDays) {
    return {
      counts,
      percentages: { present: 0, late: 0, absent: 0 },
      totalDays: 0,
      range: null,
    };
  }

  const percentages = Object.fromEntries(
    Object.entries(counts).map(([key, value]) => [key, Math.round((value / consideredDays) * 100)]),
  );

  return {
    counts,
    percentages,
    totalDays: consideredDays,
    range: {
      start: firstIncludedKey,
      end: todayKey,
    },
  };
};

export const getAttendanceTotals = (attendanceMap = {}, enrollmentStart = null) => {
  const todayKey = getDateKey(new Date());
  const today = toUtcDate(todayKey);
  const startDate = resolveStartDate(attendanceMap, enrollmentStart);

  if (!startDate || !today) {
    return {
      counts: cloneCounts(),
      totalDays: 0,
      range: null,
    };
  }

  const counts = cloneCounts();
  const cursor = new Date(startDate);

  while (cursor <= today) {
    const dateKey = getDateKey(cursor);
    const status = attendanceMap[dateKey]?.status ?? 'absent';
    const normalised = normaliseStatus(status) ?? 'absent';
    counts[normalised] += 1;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  const totalDays = counts.present + counts.late + counts.absent;

  return {
    counts,
    totalDays,
    range: {
      start: getDateKey(startDate),
      end: todayKey,
    },
  };
};

export const getMaxStreak = (attendanceMap = {}, enrollmentStart = null) => {
  const todayKey = getDateKey(new Date());
  const today = toUtcDate(todayKey);
  const startDate = resolveStartDate(attendanceMap, enrollmentStart);

  if (!startDate || !today) {
    return 0;
  }

  let max = 0;
  let current = 0;
  const cursor = new Date(startDate);

  while (cursor <= today) {
    const status = normaliseStatus(attendanceMap[getDateKey(cursor)]?.status);
    if (status === 'present') {
      current += 1;
      max = Math.max(max, current);
    } else {
      current = 0;
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return max;
};
