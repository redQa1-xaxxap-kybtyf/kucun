/**
 * 应收账款业务逻辑服务层
 * 职责:
 * - 封装应收账款业务逻辑，对外暴露主查询函数
 * - 计算/查询细节拆分到 helpers 以满足 max-lines 要求
 */

import {
  aggregatePaymentsByOrder,
  buildOrderBy,
  buildPaginatedReceivables,
  buildWhereConditions,
  createSummaryReceivables,
  fetchReceivableBaseOrders,
  fetchReceivableDetails,
  filterReceivablesByStatus,
  mapOrdersById,
  paginateReceivableIds,
  calculateSummary,
} from '@/lib/services/receivables-helpers';
import type {
  ReceivablesQueryParams,
  ReceivablesResult,
} from '@/lib/services/receivables-types';
export type {
  PaymentStatus,
  ReceivableItem,
  ReceivableSummary,
  ReceivablesQueryParams,
  ReceivablesResult,
} from '@/lib/services/receivables-types';

/**
 * 获取应收账款列表
 * 可被 API Route 和服务器组件复用
 */
export async function getReceivables(
  params: ReceivablesQueryParams = {}
): Promise<ReceivablesResult> {
  const {
    page = 1,
    limit = 20,
    paymentStatus,
    sortBy,
    sortOrder,
    ...filterParams
  } = params;

  // 构建基础查询条件
  const baseWhere = buildWhereConditions(filterParams);
  const orderBy = buildOrderBy(sortBy, sortOrder);

  // 获取符合条件的订单基础数据（用于统计与分页）
  const orders = await fetchReceivableBaseOrders(baseWhere, orderBy);
  const orderIds = orders.map(order => order.id);

  // 聚合收款信息（仅获取需要的状态）
  const paymentsByOrder = await aggregatePaymentsByOrder(orderIds);

  // 构建用于统计的应收款列表
  const summaryReceivables = createSummaryReceivables(orders, paymentsByOrder);

  // 应用支付状态筛选
  const filteredReceivables = filterReceivablesByStatus(
    summaryReceivables,
    paymentStatus
  );

  // 计算统计数据
  const summary = calculateSummary(filteredReceivables);

  // 计算分页并获取当前页需要的订单详情
  const { total, totalPages, pageOrderIds } = paginateReceivableIds(
    filteredReceivables,
    page,
    limit
  );

  const pageOrders = await fetchReceivableDetails(pageOrderIds);
  const orderMap = mapOrdersById(pageOrders);
  const paginatedReceivables = buildPaginatedReceivables(
    pageOrderIds,
    orderMap
  );

  return {
    receivables: paginatedReceivables,
    pagination: { page, limit, total, totalPages },
    summary,
  };
}
