/**
 * 应收账款页面 URL 参数配置（无 zod 依赖）
 *
 * 目的：仅为 URL 参数解析/校验时不把 zod 打进该路由首屏包。
 */

import type { ParamConfig } from '@/hooks/url-search-params';
import type { ReceivablesParams } from '@/lib/schemas/receivables-params';
import type { PaymentStatus } from '@/lib/services/receivables-service';

const paymentStatusValues = [
  'unpaid',
  'partial',
  'pending',
  'paid',
] as const satisfies PaymentStatus[];

const sortByValues = [
  'orderDate',
  'createdAt',
  'updatedAt',
  'dueDate',
  'orderNumber',
  'customerName',
  'totalAmount',
  'paidAmount',
  'remainingAmount',
] as const satisfies NonNullable<ReceivablesParams['sortBy']>[];

const sortOrderValues = ['asc', 'desc'] as const satisfies NonNullable<
  ReceivablesParams['sortOrder']
>[];

export const receivablesParamsConfig: Record<
  keyof ReceivablesParams,
  ParamConfig
> = {
  search: { type: 'string', default: '' },

  paymentStatus: {
    type: 'enum',
    values: paymentStatusValues,
    default: undefined,
  },

  sortBy: { type: 'enum', values: sortByValues, default: 'orderDate' },
  sortOrder: { type: 'enum', values: sortOrderValues, default: 'desc' },

  page: { type: 'number', default: 1, min: 1 },
  limit: { type: 'number', default: 50, min: 1, max: 100 },

  startDate: { type: 'string', default: undefined },
  endDate: { type: 'string', default: undefined },
};
