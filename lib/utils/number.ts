export function toNumber(value: unknown, fallback: number = 0): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : fallback;
  }

  if (typeof value === 'bigint') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  if (value === null || value === undefined) {
    return fallback;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  if (typeof value === 'object') {
    const maybeToNumber = (value as { toNumber?: () => unknown }).toNumber;
    if (typeof maybeToNumber === 'function') {
      const parsed = maybeToNumber.call(value);
      return typeof parsed === 'number' && Number.isFinite(parsed)
        ? parsed
        : fallback;
    }

    const maybeToString = (value as { toString?: () => string }).toString;
    if (typeof maybeToString === 'function') {
      const parsed = Number(maybeToString.call(value));
      return Number.isFinite(parsed) ? parsed : fallback;
    }
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = toNumber(value, Number.NaN);
  return Number.isFinite(parsed) ? parsed : null;
}
