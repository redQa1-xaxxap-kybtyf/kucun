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
  calculateReceivablesSummary,
  createSummaryReceivables,
  fetchReceivableBaseOrders,
  fetchReceivableDetails,
  filterReceivablesByStatus,
  mapOrdersById,
} from '@/lib/services/receivables-helpers';
import type {
  ReceivablesQueryParams,
  ReceivablesResult,
} from '@/lib/services/receivables-types';
export type {
  PaymentStatus,
  ReceivableItem,
  ReceivablesQueryParams,
  ReceivablesResult,
  ReceivableSummary,
} from '@/lib/services/receivables-types';

/**
 * 获取应收账款列表
 * 可被 API Route 和服务器组件复用
 *
 * ✅ P0修复: 重写数据访问层，使用标准 Prisma 分页
 * - 移除硬编码的 5000 上限
 * - 使用数据库级别的 skip/take 分页
 * - 统计数据基于全量聚合查询，不受分页影响
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

  // ✅ 修复: 使用标准 Prisma 分页，不再拉取 5000 条记录
  const skip = (page - 1) * limit;

  // 1. 按 skip/take 取当前页的订单基础数据
  const orders = await fetchReceivableBaseOrders(
    baseWhere,
    orderBy,
    skip,
    limit
  );
  const orderIds = orders.map(order => order.id);

  // 3. 聚合当前页订单的收款信息
  const paymentsByOrder = await aggregatePaymentsByOrder(orderIds);

  // 4. 构建当前页的应收款列表
  const summaryReceivables = createSummaryReceivables(orders, paymentsByOrder);

  // 5. 应用支付状态筛选（仅影响当前页）
  const filteredReceivables = filterReceivablesByStatus(
    summaryReceivables,
    paymentStatus
  );

  // 6. 计算全量统计数据（使用聚合查询，不受分页影响）
  const summary = await calculateReceivablesSummary(baseWhere, paymentStatus);

  // 7. 获取当前页订单的详细信息
  const pageOrderIds = filteredReceivables.map(item => item.id);
  const pageOrders = await fetchReceivableDetails(pageOrderIds);
  const orderMap = mapOrdersById(pageOrders);
  const paginatedReceivables = buildPaginatedReceivables(
    pageOrderIds,
    orderMap
  );

  // 8. 计算总页数（基于统计数据中的 receivableCount）
  const total = summary.receivableCount + summary.paidCount;
  const totalPages = Math.ceil(total / limit);

  return {
    receivables: paginatedReceivables,
    pagination: { page, limit, total, totalPages },
    summary,
  };
}
