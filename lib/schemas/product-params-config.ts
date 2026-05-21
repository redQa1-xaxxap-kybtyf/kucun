import type { ParamConfig } from '@/hooks/url-search-params';
import {
  PRODUCT_DEFAULT_SORT,
  PRODUCT_SORT_FIELDS,
  PRODUCT_STATUS_VALUES,
} from '@/lib/config/product';
import { paginationConfig } from '@/lib/env';
import type { ProductQueryParams } from '@/lib/types/product';

const sortByValues = Object.values(PRODUCT_SORT_FIELDS);

export const productParamsConfig: Record<
  keyof ProductQueryParams,
  ParamConfig
> = {
  search: { type: 'string', default: '' },
  categoryId: { type: 'string', default: undefined },
  status: { type: 'enum', values: PRODUCT_STATUS_VALUES, default: undefined },
  sortBy: {
    type: 'enum',
    values: sortByValues,
    default: PRODUCT_DEFAULT_SORT.sortBy,
  },
  sortOrder: {
    type: 'enum',
    values: ['asc', 'desc'] as const,
    default: PRODUCT_DEFAULT_SORT.sortOrder,
  },
  page: { type: 'number', default: 1, min: 1 },
  limit: {
    type: 'number',
    default: paginationConfig.defaultPageSize,
    min: 1,
    max: paginationConfig.maxPageSize,
  },
};
