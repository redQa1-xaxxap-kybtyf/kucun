/**
 * 销售订单页面 URL 参数配置（无 zod 依赖）
 *
 * 目的：仅为 URL 参数解析/校验时不把 zod 打进该路由首屏包。
 */

import type { ParamConfig } from '@/hooks/url-search-params';
import type {
  SalesOrderFilterStatus,
  SalesOrderQueryParams,
  SalesOrderType,
} from '@/lib/types/sales-order';

const statusValues = [
  'pending',
  'draft',
  'confirmed',
  'shipped',
  'completed',
  'cancelled',
] as const satisfies SalesOrderFilterStatus[];

const sortByValues = [
  'orderNumber',
  'orderDate',
  'createdAt',
  'updatedAt',
  'totalAmount',
  'status',
  'shippedAt',
] as const satisfies NonNullable<SalesOrderQueryParams['sortBy']>[];

const sortOrderValues = ['asc', 'desc'] as const satisfies NonNullable<
  SalesOrderQueryParams['sortOrder']
>[];

const orderTypeValues = ['NORMAL', 'TRANSFER'] as const satisfies SalesOrderType[];

export const salesOrderParamsConfig: Record<
  keyof SalesOrderQueryParams,
  ParamConfig
> = {
  search: { type: 'string', default: '' },
  status: { type: 'enum', values: statusValues, default: undefined },

  customerId: { type: 'string', default: '' },
  userId: { type: 'string', default: '' },

  sortBy: { type: 'enum', values: sortByValues, default: 'orderDate' },
  sortOrder: { type: 'enum', values: sortOrderValues, default: 'desc' },

  page: { type: 'number', default: 1, min: 1 },
  limit: { type: 'number', default: undefined, min: 1, max: 100 },

  startDate: { type: 'string', default: undefined },
  endDate: { type: 'string', default: undefined },

  orderType: { type: 'enum', values: orderTypeValues, default: undefined },
  isSampleOrder: { type: 'boolean', default: undefined },
  hasReturns: { type: 'boolean', default: undefined },
  includeTest: { type: 'boolean', default: undefined },
  includeVoided: { type: 'boolean', default: undefined },
};
