/**
 * 批次号生成器
 * 将批次号生成逻辑从事务内移出,允许在事务外执行和重试
 *
 * 性能优化原理:
 * - 减少事务内的数据库查询次数
 * - 允许批次号生成失败时单独重试,不影响整个事务
 * - 使用聚合查询代替 count 查询,减少全表扫描
 */

import { prisma } from '@/lib/db';

/**
 * 生成批次号(事务外执行)
 *
 * 格式: {产品编码}-{日期YYYYMMDD}-{序号001}
 * 示例: TILE001-20251021-001
 *
 * @param productId 产品ID
 * @param providedBatchNumber 用户提供的批次号(可选)
 * @returns 最终批次号
 */
export async function generateBatchNumberOutsideTransaction(
  productId: string,
  providedBatchNumber?: string
): Promise<string> {
  // 如果用户提供了批次号,直接返回
  if (providedBatchNumber) {
    return providedBatchNumber;
  }

  // 获取产品信息
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { code: true },
  });

  if (!product) {
    throw new Error(`产品不存在: ${productId}`);
  }

  // 生成日期前缀
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  const batchPrefix = `${product.code}-${dateStr}-`;

  // 性能优化: 使用 findFirst + orderBy 代替 count 查询
  // 优势: 只需要扫描索引,不需要计数所有记录
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const lastBatch = await prisma.inboundRecord.findFirst({
    where: {
      productId,
      batchNumber: {
        startsWith: batchPrefix, // 使用 startsWith 匹配,比 contains 更高效
      },
      createdAt: {
        gte: todayStart, // 只查询今天的记录
      },
    },
    orderBy: {
      batchNumber: 'desc', // 降序排列,获取最大序号
    },
    select: {
      batchNumber: true,
    },
  });

  // 解析序号
  let sequence = 1;
  if (lastBatch?.batchNumber) {
    const parts = lastBatch.batchNumber.split('-');
    const lastSequence = parseInt(parts[parts.length - 1] || '0', 10);
    sequence = lastSequence + 1;
  }

  // 生成最终批次号
  const sequenceStr = String(sequence).padStart(3, '0');
  return `${batchPrefix}${sequenceStr}`;
}

/**
 * 批量生成批次号(用于批量入库)
 *
 * @param items 批量入库项目列表
 * @returns 包含批次号的项目列表
 */
export async function generateBatchNumbersForBatch(
  items: Array<{
    productId: string;
    batchNumber?: string;
  }>
): Promise<Array<{ productId: string; batchNumber: string }>> {
  const results: Array<{ productId: string; batchNumber: string }> = [];

  // 按产品分组,避免重复查询
  const productGroups = new Map<string, typeof items>();
  for (const item of items) {
    const group = productGroups.get(item.productId) || [];
    group.push(item);
    productGroups.set(item.productId, group);
  }

  // 为每个产品组生成批次号
  for (const [productId, group] of productGroups) {
    let baseSequence = 0;

    for (const item of group) {
      if (item.batchNumber) {
        // 用户提供了批次号,直接使用
        results.push({
          productId: item.productId,
          batchNumber: item.batchNumber,
        });
      } else {
        // 生成批次号,序号递增
        const batchNumber = await generateBatchNumberOutsideTransaction(
          productId
        );

        // 解析序号并递增
        const parts = batchNumber.split('-');
        const sequence = parseInt(parts[parts.length - 1] || '0', 10);
        parts[parts.length - 1] = String(sequence + baseSequence).padStart(
          3,
          '0'
        );

        results.push({
          productId: item.productId,
          batchNumber: parts.join('-'),
        });

        baseSequence++;
      }
    }
  }

  return results;
}
