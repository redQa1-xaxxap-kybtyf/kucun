/**
 * FIFO成本计算服务
 *
 * 实现先进先出(First-In-First-Out)成本核算方法
 *
 * 核心功能:
 * 1. 入库时记录批次成本到队列
 * 2. 出库时按入库时间先后顺序消耗库存
 * 3. 计算准确的FIFO成本
 *
 * 遵循原则:
 * - KISS: 保持逻辑简单直观
 * - 数据一致性: 使用事务保证队列与库存同步
 * - 性能优化: 减少数据库查询次数
 */

import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// 事务类型定义：显式使用 Prisma.TransactionClient，避免使用模糊的 Omit<typeof prisma,...> 类型
type PrismaTransaction = Prisma.TransactionClient;

// FIFO批次成本信息
export interface FIFOBatch {
  inboundRecordId: string;
  qty: number;
  unitCost: number;
  batchCost: number;
}

// FIFO成本计算结果
export interface FIFOCostResult {
  totalCost: number;
  averageUnitCost: number;
  batches: FIFOBatch[];
}

/**
 * 添加入库记录到FIFO队列
 */
export async function addToFIFOQueue(
  params: {
    productId: string;
    variantId: string | null;
    batchNumber: string | null;
    inboundRecordId: string;
    quantity: number;
    unitCost: number;
    inboundDate: Date;
  },
  tx: PrismaTransaction
): Promise<void> {
  try {
    await tx.inventoryCostQueue.create({
      data: {
        productId: params.productId,
        variantId: params.variantId,
        batchNumber: params.batchNumber,
        inboundRecordId: params.inboundRecordId,
        remainingQty: params.quantity,
        unitCost: params.unitCost,
        inboundDate: params.inboundDate,
      },
    });

    logger.info('fifo-cost-service', 'FIFO队列入队成功', {
      productId: params.productId,
      variantId: params.variantId,
      inboundRecordId: params.inboundRecordId,
      quantity: params.quantity,
      unitCost: params.unitCost,
    });
  } catch (error) {
    logger.error('fifo-cost-service', 'FIFO队列入队失败', error);
    throw error;
  }
}

/**
 * 获取FIFO成本(只计算,不消耗库存)
 * 用于查询出库成本,不修改数据
 */
export async function getFIFOCost(
  productId: string,
  variantId: string | null,
  outboundQty: number
): Promise<FIFOCostResult> {
  try {
    // 查询FIFO队列,按入库时间升序排列
    const queue = await prisma.inventoryCostQueue.findMany({
      where: {
        productId,
        variantId,
        remainingQty: { gt: 0 },
      },
      orderBy: {
        inboundDate: 'asc', // FIFO核心:先进先出
      },
    });

    if (queue.length === 0) {
      logger.warn('fifo-cost-service', 'FIFO队列为空', {
        productId,
        variantId,
      });
      return {
        totalCost: 0,
        averageUnitCost: 0,
        batches: [],
      };
    }

    // 按FIFO顺序计算成本
    let remainingToConsume = outboundQty;
    let totalCost = 0;
    const batches: FIFOBatch[] = [];

    for (const batch of queue) {
      if (remainingToConsume <= 0) break;

      const consumeQty = Math.min(remainingToConsume, batch.remainingQty);
      const batchCost = consumeQty * batch.unitCost;

      totalCost += batchCost;
      batches.push({
        inboundRecordId: batch.inboundRecordId,
        qty: consumeQty,
        unitCost: batch.unitCost,
        batchCost,
      });

      remainingToConsume -= consumeQty;
    }

    // 检查库存是否足够
    if (remainingToConsume > 0) {
      logger.warn('fifo-cost-service', 'FIFO队列库存不足', {
        productId,
        variantId,
        required: outboundQty,
        available: outboundQty - remainingToConsume,
        shortage: remainingToConsume,
      });
      throw new Error(
        `库存不足: 需要 ${outboundQty}, 可用 ${outboundQty - remainingToConsume}`
      );
    }

    const averageUnitCost = totalCost / outboundQty;

    logger.info('fifo-cost-service', 'FIFO成本计算成功', {
      productId,
      variantId,
      outboundQty,
      totalCost,
      averageUnitCost,
      batchCount: batches.length,
    });

    return {
      totalCost: Math.round(totalCost * 100) / 100,
      averageUnitCost: Math.round(averageUnitCost * 100) / 100,
      batches,
    };
  } catch (error) {
    logger.error('fifo-cost-service', 'FIFO成本计算失败', error);
    throw error;
  }
}

/**
 * 消耗FIFO队列(出库时使用)
 * 按FIFO顺序减少库存,必须在事务中调用
 */
export async function consumeFIFOQueue(
  productId: string,
  variantId: string | null,
  outboundQty: number,
  tx: PrismaTransaction
): Promise<FIFOCostResult> {
  try {
    // 查询FIFO队列
    const queue = await tx.inventoryCostQueue.findMany({
      where: {
        productId,
        variantId,
        remainingQty: { gt: 0 },
      },
      orderBy: {
        inboundDate: 'asc',
      },
    });

    if (queue.length === 0) {
      throw new Error('FIFO队列为空,无法出库');
    }

    let remainingToConsume = outboundQty;
    let totalCost = 0;
    const batches: FIFOBatch[] = [];

    // 按FIFO顺序消耗库存
    for (const batch of queue) {
      if (remainingToConsume <= 0) break;

      const consumeQty = Math.min(remainingToConsume, batch.remainingQty);
      const batchCost = consumeQty * batch.unitCost;
      const newRemainingQty = batch.remainingQty - consumeQty;

      // 使用乐观并发控制更新队列剩余数量
      // 通过 remainingQty 条件防止两个事务同时消耗同一批次
      const updateResult = await tx.inventoryCostQueue.updateMany({
        where: {
          id: batch.id,
          remainingQty: batch.remainingQty,
        },
        data: {
          remainingQty: newRemainingQty,
        },
      });

      // 如果没有任何行被更新，说明在本事务期间有并发修改，触发重试或报错
      if (updateResult.count === 0) {
        logger.warn(
          'fifo-cost-service',
          'FIFO队列并发冲突，批次已被其他事务修改',
          {
            batchId: batch.id,
            expectedRemainingQty: batch.remainingQty,
          }
        );
        throw new Error('FIFO队列并发冲突，请重试出库操作');
      }

      totalCost += batchCost;
      batches.push({
        inboundRecordId: batch.inboundRecordId,
        qty: consumeQty,
        unitCost: batch.unitCost,
        batchCost,
      });

      remainingToConsume -= consumeQty;

      logger.debug('fifo-cost-service', 'FIFO批次消耗', {
        batchId: batch.id,
        consumeQty,
        remainingQty: newRemainingQty,
      });
    }

    if (remainingToConsume > 0) {
      throw new Error(
        `库存不足: 需要 ${outboundQty}, 可用 ${outboundQty - remainingToConsume}`
      );
    }

    const averageUnitCost = totalCost / outboundQty;

    logger.info('fifo-cost-service', 'FIFO队列消耗成功', {
      productId,
      variantId,
      outboundQty,
      totalCost,
      averageUnitCost,
      batchCount: batches.length,
    });

    return {
      totalCost: Math.round(totalCost * 100) / 100,
      averageUnitCost: Math.round(averageUnitCost * 100) / 100,
      batches,
    };
  } catch (error) {
    logger.error('fifo-cost-service', 'FIFO队列消耗失败', error);
    throw error;
  }
}

/**
 * 获取当前加权平均成本(用于兼容性)
 * 基于FIFO队列计算全部库存的平均成本
 */
export async function getWeightedAverageCostFromFIFO(
  productId: string,
  variantId: string | null
): Promise<number> {
  try {
    const queue = await prisma.inventoryCostQueue.findMany({
      where: {
        productId,
        variantId,
        remainingQty: { gt: 0 },
      },
    });

    if (queue.length === 0) {
      return 0;
    }

    let totalQty = 0;
    let totalCost = 0;

    for (const batch of queue) {
      totalQty += batch.remainingQty;
      totalCost += batch.remainingQty * batch.unitCost;
    }

    const avgCost = totalQty > 0 ? totalCost / totalQty : 0;

    return Math.round(avgCost * 100) / 100;
  } catch (error) {
    logger.error('fifo-cost-service', '计算加权平均成本失败', error);
    return 0;
  }
}

/**
 * 清理已消耗完的FIFO队列记录
 * 定期调用,减少数据库记录数
 */
export async function cleanupEmptyFIFOQueue(): Promise<number> {
  try {
    const result = await prisma.inventoryCostQueue.deleteMany({
      where: {
        remainingQty: { lte: 0 },
      },
    });

    logger.info('fifo-cost-service', 'FIFO队列清理完成', {
      deletedCount: result.count,
    });

    return result.count;
  } catch (error) {
    logger.error('fifo-cost-service', 'FIFO队列清理失败', error);
    return 0;
  }
}
