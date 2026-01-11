/**
 * FIFO出库服务
 *
 * 处理基于FIFO(先进先出)的库存出库逻辑
 *
 * 核心功能:
 * 1. 计算FIFO出库成本
 * 2. 消耗FIFO队列
 * 3. 更新库存数量
 * 4. 创建出库记录
 *
 * 遵循原则:
 * - 原子性: 所有操作必须在事务中完成
 * - 先检查后执行: 先验证库存足够再出库
 * - 批次追溯: 记录每次出库消耗的批次明细
 */

import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

import {
  consumeFIFOQueueByBatch,
  type FIFOCostResult,
} from './fifo-cost-service';

// 事务类型定义：与 fifo-cost-service 保持一致，显式使用 TransactionClient
type PrismaTransaction = Prisma.TransactionClient;

/**
 * FIFO出库参数
 */
export interface FIFOOutboundParams {
  productId: string;
  variantId: string | null;
  batchNumber: string | null;
  quantity: number;
  reason: string;
  remarks?: string;
  userId: string; // 操作人，用于填充 operatorId
  // 关联单据信息(可选)
  salesOrderId?: string;
  salesOrderItemId?: string;
}

/**
 * FIFO出库结果
 */
export interface FIFOOutboundResult {
  outboundRecordId: string;
  recordNumber: string;
  quantity: number;
  totalCost: number;
  averageUnitCost: number;
  batchesConsumed: number;
  fifoDetails: FIFOCostResult['batches'];
}

/**
 * 执行FIFO出库事务
 *
 * 包含以下步骤:
 * 1. 消耗FIFO成本队列(获取成本并更新队列)
 * 2. 更新库存数量
 * 3. 创建出库记录
 *
 * @param params 出库参数
 * @param tx Prisma事务客户端
 * @returns 出库结果
 */
export async function executeFIFOOutbound(
  params: FIFOOutboundParams,
  tx: PrismaTransaction
): Promise<FIFOOutboundResult> {
  try {
    // 🎯 步骤1: FIFO成本计算并消耗队列
    const fifoCost = await consumeFIFOQueueByBatch(
      params.productId,
      params.variantId,
      params.batchNumber,
      params.quantity,
      tx
    );

    logger.info('fifo-outbound-service', 'FIFO成本计算完成', {
      productId: params.productId,
      variantId: params.variantId,
      quantity: params.quantity,
      totalCost: fifoCost.totalCost,
      averageUnitCost: fifoCost.averageUnitCost,
      batchCount: fifoCost.batches.length,
    });

    // 🎯 步骤2: 更新库存数量
    const inventory = await tx.inventory.findFirst({
      where: {
        productId: params.productId,
        variantId: params.variantId,
        batchNumber: params.batchNumber,
      },
    });

    if (!inventory) {
      throw new Error(
        `库存记录不存在: productId=${params.productId}, variantId=${params.variantId}`
      );
    }

    if (inventory.quantity < params.quantity) {
      throw new Error(
        `库存不足: 需要${params.quantity}, 可用${inventory.quantity}`
      );
    }

    await tx.inventory.update({
      where: { id: inventory.id },
      data: {
        quantity: {
          decrement: params.quantity,
        },
        updatedAt: new Date(),
      },
    });

    logger.info('fifo-outbound-service', '库存数量已更新', {
      inventoryId: inventory.id,
      decrementQty: params.quantity,
      remainingQty: inventory.quantity - params.quantity,
    });

    // 🎯 步骤3: 创建出库记录
    const recordNumber = generateOutboundRecordNumber();

    const outboundRecord = await tx.outboundRecord.create({
      data: {
        recordNumber,
        productId: params.productId,
        variantId: params.variantId,
        batchNumber: params.batchNumber,
        inventoryId: inventory.id,
        quantity: params.quantity,
        unitCost: fifoCost.averageUnitCost,
        totalCost: fifoCost.totalCost,
        reason: params.reason,
        notes: params.remarks || null,
        operatorId: params.userId,
        salesOrderId: params.salesOrderId || null,
      },
    });

    logger.info('fifo-outbound-service', '出库记录已创建', {
      outboundRecordId: outboundRecord.id,
      recordNumber: outboundRecord.recordNumber,
    });

    return {
      outboundRecordId: outboundRecord.id,
      recordNumber: outboundRecord.recordNumber,
      quantity: params.quantity,
      totalCost: fifoCost.totalCost,
      averageUnitCost: fifoCost.averageUnitCost,
      batchesConsumed: fifoCost.batches.length,
      fifoDetails: fifoCost.batches,
    };
  } catch (error) {
    logger.error('fifo-outbound-service', 'FIFO出库失败', error, {
      productId: params.productId,
      quantity: params.quantity,
    });
    throw error;
  }
}

/**
 * 生成出库记录编号
 * 格式: OUT-YYYYMMDD-XXXXXX
 */
function generateOutboundRecordNumber(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `OUT-${dateStr}-${randomStr}`;
}

/**
 * 批量FIFO出库
 * 用于销售订单发货等场景,一次出库多个产品
 *
 * @param items 出库项目列表
 * @param tx Prisma事务客户端
 * @returns 出库结果列表
 */
export async function executeBatchFIFOOutbound(
  items: FIFOOutboundParams[],
  tx: PrismaTransaction
): Promise<FIFOOutboundResult[]> {
  const results: FIFOOutboundResult[] = [];

  for (const item of items) {
    const result = await executeFIFOOutbound(item, tx);
    results.push(result);
  }

  logger.info('fifo-outbound-service', '批量FIFO出库完成', {
    itemCount: items.length,
    totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
    totalCost: results.reduce((sum, result) => sum + result.totalCost, 0),
  });

  return results;
}

/**
 * 检查FIFO库存是否足够
 * 用于出库前的预检查
 *
 * @param productId 产品ID
 * @param variantId 变体ID
 * @param requiredQty 需要的数量
 * @returns 是否足够及可用数量
 */
export async function checkFIFOInventoryAvailable(
  productId: string,
  variantId: string | null,
  requiredQty: number
): Promise<{
  available: boolean;
  availableQty: number;
  shortage: number;
}> {
  try {
    // 查询FIFO队列总可用数量
    const aggregateResult = await prisma.inventoryCostQueue.aggregate({
      where: {
        productId,
        variantId,
        remainingQty: { gt: 0 },
      },
      _sum: {
        remainingQty: true,
      },
    });

    const availableQty = Number(aggregateResult._sum.remainingQty ?? 0);

    const available = availableQty >= requiredQty;
    const shortage = available ? 0 : requiredQty - availableQty;

    return {
      available,
      availableQty,
      shortage,
    };
  } catch (error) {
    logger.error('fifo-outbound-service', '检查FIFO库存失败', error);
    return {
      available: false,
      availableQty: 0,
      shortage: requiredQty,
    };
  }
}
