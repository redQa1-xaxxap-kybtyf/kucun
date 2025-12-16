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
}

function parseSafeInt(value: string | null | undefined): number | null {
  if (value == null) return null;
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

  const page = Math.max(
    1,
    parseSafeInt(searchParams.get('page')) ?? defaultPage
  );
  const limit = Math.min(
    maxLimit,
    Math.max(1, parseSafeInt(searchParams.get('limit')) ?? defaultLimit)
  );

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
export function sliceLimitPlusOne<T>(rows: T[], limit: number): {
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

