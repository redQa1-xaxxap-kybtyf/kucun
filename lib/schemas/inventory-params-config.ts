/**
 * 库存管理页面 URL 参数配置（无 zod 依赖）
 *
 * 目的：给 `useUrlSearchParams` 的“配置对象模式”使用，避免仅为 URL 参数解析/校验而把 zod 打进该路由的首屏包。
 */

import type { ParamConfig } from '@/hooks/url-search-params';
import type { InventoryQueryParams } from '@/lib/types/inventory';

const sortByValues = [
  'createdAt',
  'updatedAt',
  'quantity',
  'reservedQuantity',
  'batchNumber',
  'productId',
  'location',
] as const satisfies NonNullable<InventoryQueryParams['sortBy']>[];

const sortOrderValues = ['asc', 'desc'] as const satisfies NonNullable<
  InventoryQueryParams['sortOrder']
>[];

export const inventoryParamsConfig: Record<
  keyof InventoryQueryParams,
  ParamConfig
> = {
  search: { type: 'string', default: '' },

  categoryId: { type: 'string', default: undefined },
  lowStock: { type: 'boolean', default: false },
  hasStock: { type: 'boolean', default: false },

  sortBy: { type: 'enum', values: sortByValues, default: 'updatedAt' },
  sortOrder: { type: 'enum', values: sortOrderValues, default: 'desc' },

  page: { type: 'number', default: 1, min: 1 },
  limit: { type: 'number', default: 50, min: 1, max: 100 },

  startDate: { type: 'string', default: undefined },
  endDate: { type: 'string', default: undefined },

  productId: { type: 'string', default: undefined },
  batchNumber: { type: 'string', default: undefined },
  location: { type: 'string', default: undefined },
};

