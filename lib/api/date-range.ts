import type { Prisma } from '@prisma/client';

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function parseDateBoundaryFromString(
  value: string,
  boundary: 'start' | 'end'
): Date {
  const trimmed = value.trim();
  if (DATE_ONLY_REGEX.test(trimmed)) {
    const time =
      boundary === 'start' ? '00:00:00.000' : '23:59:59.999';
    return new Date(`${trimmed}T${time}`);
  }

  return new Date(trimmed);
}

export function parseOptionalDateBoundary(
  value: string | null | undefined,
  boundary: 'start' | 'end'
): Date | undefined {
  const trimmed = (value ?? '').trim();
  if (!trimmed) {
    return undefined;
  }

  return parseDateBoundaryFromString(trimmed, boundary);
}

export function parseDateRangeFromSearchParams(
  searchParams: URLSearchParams,
  options?: { startKey?: string; endKey?: string }
): { startDate?: Date; endDate?: Date } {
  const startKey = options?.startKey ?? 'startDate';
  const endKey = options?.endKey ?? 'endDate';

  return {
    startDate: parseOptionalDateBoundary(searchParams.get(startKey), 'start'),
    endDate: parseOptionalDateBoundary(searchParams.get(endKey), 'end'),
  };
}

export function buildDateTimeRangeFromDates(
  startDate?: Date,
  endDate?: Date
): Prisma.DateTimeFilter | undefined {
  if (!startDate && !endDate) {
    return undefined;
  }

  const range: Prisma.DateTimeFilter = {};

  if (startDate) {
    const gte = new Date(startDate);
    gte.setHours(0, 0, 0, 0);
    range.gte = gte;
  }

  if (endDate) {
    const lte = new Date(endDate);
    lte.setHours(23, 59, 59, 999);
    range.lte = lte;
  }

  return range;
}

export function buildDateTimeRangeFromDateStrings(
  startDate?: string | null,
  endDate?: string | null
): Prisma.DateTimeFilter | undefined {
  if (!startDate && !endDate) {
    return undefined;
  }

  return buildDateTimeRangeFromDates(
    startDate ? parseDateBoundaryFromString(startDate, 'start') : undefined,
    endDate ? parseDateBoundaryFromString(endDate, 'end') : undefined
  );
}
