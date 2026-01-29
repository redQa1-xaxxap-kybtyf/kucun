import { paginationConfig } from '@/lib/env';

export interface OffsetPaginationParams {
  page: number;
  limit: number;
  skip: number;
  take: number;
}

export interface OffsetPaginationMeta {
  page: number;
  limit: number;
  total?: number;
  totalPages?: number;
  hasMore?: boolean;
}

export interface ParseOffsetPaginationOptions {
  defaultPage?: number;
  defaultLimit?: number;
  maxLimit?: number;
  pageParamName?: string;
  limitParamName?: string;
  /**
   * 严格模式：
   * - 当请求显式提供了 page/limit，但值非法时抛错（用于需要返回 400 的接口）
   * - 当请求未提供参数时使用默认值
   */
  strict?: boolean;
  pageFieldLabel?: string;
  limitFieldLabel?: string;
}

function parseSafeInt(value: string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * 解析 offset 分页参数，并统一 clamp 到安全范围内。
 */
export function parseOffsetPagination(
  searchParams: URLSearchParams,
  options: ParseOffsetPaginationOptions = {}
): OffsetPaginationParams {
  const defaultPage = options.defaultPage ?? 1;
  const defaultLimit = options.defaultLimit ?? paginationConfig.defaultPageSize;
  const maxLimit = options.maxLimit ?? paginationConfig.maxPageSize;
  const strict = options.strict ?? false;
  const pageLabel = options.pageFieldLabel ?? 'page';
  const limitLabel = options.limitFieldLabel ?? 'limit';
  const pageParamName = options.pageParamName ?? 'page';
  const limitParamName = options.limitParamName ?? 'limit';

  const rawPage = searchParams.get(pageParamName);
  const parsedPage = parseSafeInt(rawPage);
  if (strict && rawPage !== null) {
    if (parsedPage === null || parsedPage <= 0) {
      throw new Error(`${pageLabel}必须大于0`);
    }
  }
  const page = strict
    ? (parsedPage ?? defaultPage)
    : Math.max(1, parsedPage ?? defaultPage);

  const rawLimit = searchParams.get(limitParamName);
  const parsedLimit = parseSafeInt(rawLimit);
  if (strict && rawLimit !== null) {
    if (parsedLimit === null || parsedLimit <= 0) {
      throw new Error(`${limitLabel}必须大于0`);
    }
    if (parsedLimit > maxLimit) {
      throw new Error(`${limitLabel}不能超过${maxLimit}`);
    }
  }
  const limit = strict
    ? (parsedLimit ?? defaultLimit)
    : Math.min(maxLimit, Math.max(1, parsedLimit ?? defaultLimit));

  const skip = (page - 1) * limit;

  return {
    page,
    limit,
    skip,
    take: limit,
  };
}

/**
 * 将 take=limit+1 的结果裁剪回 limit，并返回 hasMore。
 */
export function sliceLimitPlusOne<T>(
  rows: T[],
  limit: number
): {
  items: T[];
  hasMore: boolean;
} {
  const hasMore = rows.length > limit;
  return { items: hasMore ? rows.slice(0, limit) : rows, hasMore };
}

export function buildOffsetPaginationMeta(params: {
  page: number;
  limit: number;
  total?: number;
  hasMore?: boolean;
}): OffsetPaginationMeta {
  const totalPages =
    typeof params.total === 'number'
      ? Math.ceil(params.total / params.limit)
      : undefined;
  return {
    page: params.page,
    limit: params.limit,
    total: params.total,
    totalPages,
    hasMore: params.hasMore,
  };
}
