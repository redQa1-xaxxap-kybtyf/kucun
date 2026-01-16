import { toNumber } from '@/lib/utils/number';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function isDecimalLike(value: unknown): value is { toNumber: () => unknown } {
  if (!value || typeof value !== 'object') return false;
  if (value instanceof Date) return false;
  if (isPlainObject(value)) return false;
  return typeof (value as { toNumber?: unknown }).toNumber === 'function';
}

function replaceValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(item => replaceValue(item));
  }

  if (isDecimalLike(value)) {
    return toNumber(value);
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  if (value instanceof Date) {
    return value;
  }

  if (isPlainObject(value)) {
    const next: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      next[key] = replaceValue(nested);
    }
    return next;
  }

  return value;
}

/**
 * Replace Prisma Decimal instances with JavaScript numbers.
 *
 * Motivation: Next.js Server Components cannot pass Decimal objects to Client Components
 * (e.g. via TanStack Query `dehydrate()`), causing runtime errors.
 */
export function replacePrismaDecimals<T>(input: T): T {
  return replaceValue(input) as T;
}

