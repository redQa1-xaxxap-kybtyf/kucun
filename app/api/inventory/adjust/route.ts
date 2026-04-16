import { type NextRequest, NextResponse } from 'next/server';

import { generateInboundRecordNumber } from '@/lib/api/inbound-handlers';
import { withErrorHandling } from '@/lib/api/middleware';
import { withAuth } from '@/lib/auth/api-helpers';
import { revalidateInventory } from '@/lib/cache';
import { prisma } from '@/lib/db';
import { getStandardTransactionOptions } from '@/lib/db/transaction-options';
import { publishInventoryChange } from '@/lib/events';
import { RateLimitType, withRateLimit } from '@/lib/rate-limit';
import {
  addToFIFOQueue,
  consumeFIFOQueueByBatch,
  ensureFIFOQueueMatchesInventory,
  getWeightedAverageCostFromFIFOByBatch,
} from '@/lib/services/fifo-cost-service';
import { runWithFifoTransactionRetry } from '@/lib/services/fifo-transaction-retry';
import { upsertManualDamageLedgerFromAdjustment } from '@/lib/services/manual-damage-ledger-service';
import { generateAdjustmentNumber } from '@/lib/utils/adjustment-number-generator';
import { roundCostPrice } from '@/lib/utils/cost-price';
import { withIdempotency } from '@/lib/utils/idempotency';
import { inventoryAdjustSchema } from '@/lib/validations/inventory-operations';

const roundCurrency = (value: number): number =>
  Math.round(Number(value || 0) * 100) / 100;

interface AdjustmentData {
  productId: string;
  adjustQuantity: number;
  reason: string;
  batchNumber?: string;
  variantId?: string;
  notes?: string;
  damageCategory?: 'damage' | 'scrap' | 'loss' | 'other';
  damageHandling?: 'pending_confirm' | 'supplier_claim' | 'internal_loss';
}

/**
 * 执行库存调整事务
 */
export async function executeAdjustmentTransaction(
  data: AdjustmentData,
  userId: string
) {
  const {
    productId,
    adjustQuantity,
    reason,
    batchNumber,
    variantId,
    notes,
    damageCategory,
    damageHandling,
  } = data;

  const normalizedBatchNumber =
    typeof batchNumber === 'string' ? batchNumber.trim() : '';
  const normalizedVariantId =
    typeof variantId === 'string' ? variantId.trim() : '';
  const batchNumberOrNull =
    normalizedBatchNumber.length > 0 ? normalizedBatchNumber : null;
  const variantIdOrNull =
    normalizedVariantId.length > 0 ? normalizedVariantId : null;

  if (!batchNumberOrNull) {
    throw new Error('批次号/色号为必填项');
  }

  // 1. 在事务外部生成调整单号（避免嵌套事务导致死锁）
  const adjustmentNumber = await generateAdjustmentNumber();

  return await runWithFifoTransactionRetry({
    actionLabel: '库存调整',
    moduleName: 'inventory-adjust',
    operation: () =>
      prisma.$transaction(
        async tx => {
          // 2. 查找现有库存记录
          const existingInventory = await tx.inventory.findFirst({
            where: {
              productId,
              batchNumber: batchNumberOrNull,
              variantId: variantIdOrNull,
            },
          });

          const beforeQuantity = existingInventory?.quantity || 0;
          const reservedQuantity = existingInventory?.reservedQuantity || 0;
          const afterQuantity = beforeQuantity + adjustQuantity;

          // 防止库存变为负数
          if (afterQuantity < 0) {
            throw new Error(
              `调整后库存不能为负数。当前库存: ${beforeQuantity}, 调整数量: ${adjustQuantity}`
            );
          }

          // 修复：检查调整后的可用库存是否低于预留量
          if (afterQuantity < reservedQuantity) {
            throw new Error(
              `调整后可用库存(${afterQuantity})不能低于预留数量(${reservedQuantity})。请先释放预留量或减少调整数量。`
            );
          }

          let updatedInventory;

          if (existingInventory) {
            // 乐观锁方案：使用数据库原子操作避免并发冲突
            // 使用 increment 而不是先读后写，保证操作的原子性
            // 这样即使多个请求同时调整同一库存，也不会发生数据丢失
            updatedInventory = await tx.inventory.update({
              where: { id: existingInventory.id },
              data: {
                quantity: { increment: adjustQuantity }, // 原子递增/递减操作
              },
              include: {
                product: {
                  select: { id: true, name: true, code: true },
                },
              },
            });

            // 并发安全检查：验证更新后的库存不为负数
            if (updatedInventory.quantity < 0) {
              throw new Error(
                `并发调整导致库存为负数。当前库存: ${updatedInventory.quantity}, 请重试`
              );
            }

            // 并发安全检查：验证更新后的可用库存不低于预留量
            if (updatedInventory.quantity < updatedInventory.reservedQuantity) {
              throw new Error(
                `并发调整导致可用库存(${updatedInventory.quantity})低于预留数量(${updatedInventory.reservedQuantity})，请重试`
              );
            }
          } else {
            // 创建新的库存记录（仅当调整数量为正数时）
            if (adjustQuantity <= 0) {
              throw new Error('创建新库存记录时，调整数量必须为正数');
            }

            updatedInventory = await tx.inventory.create({
              data: {
                productId,
                quantity: adjustQuantity,
                reservedQuantity: 0,
                batchNumber: batchNumberOrNull,
                variantId: variantIdOrNull,
              },
              include: {
                product: {
                  select: { id: true, name: true, code: true },
                },
              },
            });
          }

          // 3. 计算调整成本（严格按 FIFO 成本优先）
          let unitCost: number | null = null;
          let totalCost: number | null = null;

          if (adjustQuantity > 0) {
            // 增加库存：优先使用 FIFO 队列的加权平均成本，其次使用库存单价
            const fifoAvg = await getWeightedAverageCostFromFIFOByBatch(
              productId,
              variantIdOrNull,
              batchNumberOrNull,
              tx
            );

            if (fifoAvg > 0) {
              unitCost = fifoAvg;
            } else if (
              existingInventory?.unitCost !== null &&
              existingInventory?.unitCost !== undefined
            ) {
              unitCost = Number(existingInventory.unitCost);
            }

            if (unitCost !== null) {
              totalCost = roundCurrency(adjustQuantity * unitCost);
            }
          } else if (adjustQuantity < 0) {
            // 减少库存：按 FIFO 队列逐批消耗计算成本
            const absQty = Math.abs(adjustQuantity);

            const unitCostHint =
              existingInventory?.unitCost !== null &&
              existingInventory?.unitCost !== undefined
                ? Number(existingInventory.unitCost)
                : null;

            await ensureFIFOQueueMatchesInventory(
              {
                inventoryId: existingInventory?.id ?? updatedInventory.id,
                productId,
                variantId: variantIdOrNull,
                batchNumber: batchNumberOrNull,
                expectedInventoryQty: beforeQuantity,
                unitCostHint,
                userId,
                source: `inventory-adjust:${adjustmentNumber}`,
              },
              tx
            );

            const fifoCost = await consumeFIFOQueueByBatch(
              productId,
              variantIdOrNull,
              batchNumberOrNull,
              absQty,
              tx
            );

            if (absQty > 0) {
              unitCost = roundCostPrice(fifoCost.totalCost / absQty);
            }
            // 调整数量为负数，成本也为负
            totalCost = -roundCurrency(fifoCost.totalCost);
          }

          // 3.1 所有正向调整统一补录 FIFO 队列（视为一笔入库），保持 FIFO 队列数量与库存一致
          if (adjustQuantity > 0 && unitCost !== null) {
            const inboundRecord = await tx.inboundRecord.create({
              data: {
                recordNumber: generateInboundRecordNumber(),
                productId,
                variantId: variantIdOrNull,
                batchNumber: batchNumberOrNull,
                batchSpecificationId: null,
                quantity: adjustQuantity,
                unitCost,
                totalCost: roundCurrency(adjustQuantity * unitCost),
                // 统一使用 surplus 作为入库原因，备注中保留原调整原因
                reason: 'surplus',
                remarks: `库存调整自动补录（调整单：${adjustmentNumber}，原因：${reason}）`,
                userId,
                purchaseOrderId: null,
                purchaseOrderItemId: null,
                supplierId: null,
              },
            });

            await addToFIFOQueue(
              {
                productId,
                variantId: variantIdOrNull,
                batchNumber: batchNumberOrNull,
                inboundRecordId: inboundRecord.id,
                quantity: adjustQuantity,
                unitCost,
                inboundDate: new Date(),
              },
              tx
            );
          }

          // 4. 创建调整记录（审计追溯）
          const adjustmentRecord = await tx.inventoryAdjustment.create({
            data: {
              adjustmentNumber,
              productId,
              variantId: variantIdOrNull,
              batchNumber: batchNumberOrNull,
              beforeQuantity,
              adjustQuantity,
              afterQuantity,
              unitCost,
              totalCost,
              reason,
              notes,
              status: 'approved', // 直接审批通过，后续可改为需要审批
              operatorId: userId,
              approverId: userId, // 暂时自动审批
              approvedAt: new Date(),
            },
          });

          if (reason === 'damage_loss' && adjustQuantity < 0) {
            await upsertManualDamageLedgerFromAdjustment(tx, {
              adjustmentId: adjustmentRecord.id,
              productId,
              variantId: variantIdOrNull,
              batchNumber: batchNumberOrNull,
              damagedQuantity: Math.abs(adjustQuantity),
              damageCategory: damageCategory ?? 'damage',
              damageHandling: damageHandling ?? 'internal_loss',
              referenceAmount:
                totalCost === null ? null : Math.abs(roundCurrency(totalCost)),
              remarks: notes,
              createdById: userId,
            });
          }

          return { inventory: updatedInventory, adjustment: adjustmentRecord };
        },
        getStandardTransactionOptions() // 根据数据库类型自动配置事务选项（SQLite默认串行化，MySQL/PostgreSQL使用Serializable）
      ),
  });
}

/**
 * 库存调整API
 * POST /api/inventory/adjust
 */
const postInventoryAdjustHandler = withAuth(
  async (request: NextRequest, { user }) =>
    withErrorHandling(async () => {
      const body = await request.json();

      // 验证请求数据
      const validatedData = inventoryAdjustSchema.parse(body);

      const { idempotencyKey, productId } = validatedData;

      // 使用幂等性包装器执行调整操作
      const result = await withIdempotency(
        idempotencyKey,
        'adjust',
        productId,
        user.id,
        validatedData,
        async () => await executeAdjustmentTransaction(validatedData, user.id)
      );

      // 使用统一的缓存失效系统（自动级联失效相关缓存）
      await revalidateInventory(validatedData.productId);

      // 发布库存变更事件（新事件系统）
      await publishInventoryChange({
        action: 'adjust',
        productId: validatedData.productId,
        productName: result.inventory.product.name,
        oldQuantity: result.adjustment.beforeQuantity,
        newQuantity: result.adjustment.afterQuantity,
        reason: validatedData.reason,
        operator: user.name || user.username,
        userId: user.id,
      });

      return NextResponse.json({
        success: true,
        data: {
          inventory: result.inventory,
          adjustment: result.adjustment,
        },
        message: '库存调整成功',
      });
    })(request, {}),
  { permissions: ['inventory:adjust'] }
);

export const POST = withRateLimit(RateLimitType.WRITE)(
  postInventoryAdjustHandler
);
