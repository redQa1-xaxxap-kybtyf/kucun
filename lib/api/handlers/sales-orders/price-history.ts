import { logger } from '@/lib/logger';

import type { CreateInput, OrderItemInput, Tx } from './types';

const isProductItem = (
  item: OrderItemInput
): item is OrderItemInput & { productId: string } =>
  !item.isManualProduct && typeof item.productId === 'string';

const hasPriceRecord = (
  item: OrderItemInput
): item is OrderItemInput & { productId: string; unitPrice: number } =>
  isProductItem(item) &&
  typeof item.unitPrice === 'number' &&
  item.unitPrice !== 0;

/**
 * 记录客户产品价格历史
 *
 * 性能优化 (2025-10-22):
 * - 从逐条 create (N次数据库操作) 改为 createMany (1次数据库操作)
 * - 使用 skipDuplicates 自动忽略重复记录
 * - 预期性能提升: 10个商品从 50-100ms 降至 5-10ms (提升 90%)
 *
 * @param tx - 数据库事务对象
 * @param data - 销售订单创建数据
 * @param salesOrderId - 销售订单ID
 */
export const recordCustomerPriceHistory = async (
  tx: Tx,
  data: CreateInput,
  salesOrderId: string
) => {
  const priceType = data.orderType === 'NORMAL' ? 'SALES' : 'FACTORY';
  const records = data.items.filter(hasPriceRecord).map(item => ({
    customerId: data.customerId,
    productId: item.productId,
    priceType,
    unitPrice: item.unitPrice,
    orderId: salesOrderId,
    orderType: 'SALES_ORDER' as const,
  }));

  // 如果没有需要记录的价格,直接返回
  if (records.length === 0) {
    return;
  }

  try {
    // ✅ 性能优化: 使用批量插入代替逐条插入
    // - skipDuplicates: true 会自动忽略违反唯一约束的记录
    // - 在 MySQL/PostgreSQL 中使用 INSERT IGNORE 或 ON CONFLICT DO NOTHING
    // - 单次数据库往返,大幅减少网络开销和锁竞争
    await tx.customerProductPrice.createMany({
      data: records,
      skipDuplicates: true, // 自动忽略重复键错误
    });
  } catch (error) {
    // 即使批量插入完全失败,也不应该影响订单创建
    // 价格历史是辅助功能,失败只需记录日志
    logger.error('price-history', '批量插入价格历史失败', error, {
      customerId: data.customerId,
      salesOrderId,
      recordCount: records.length,
    });
    // 注意: 这里不抛出错误,避免影响订单创建流程
  }
};
