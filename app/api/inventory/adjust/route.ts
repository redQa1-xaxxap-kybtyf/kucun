import { type NextRequest, NextResponse } from 'next/server';

import { withErrorHandling } from '@/lib/api/middleware';
import { successResponse, withAuth } from '@/lib/auth/api-helpers';
import { revalidateInventory } from '@/lib/cache';
import { prisma } from '@/lib/db';
import { publishInventoryChange } from '@/lib/events';
import { generateAdjustmentNumber } from '@/lib/utils/adjustment-number-generator';
import { withIdempotency } from '@/lib/utils/idempotency';
import { inventoryAdjustSchema } from '@/lib/validations/inventory-operations';
import { publishWs } from '@/lib/ws/ws-server';

interface AdjustmentData {
  productId: string;
  adjustQuantity: number;
  reason: string;
  batchNumber?: string;
  variantId?: string;
  notes?: string;
}

/**
 * 执行库存调整事务
 */
async function executeAdjustmentTransaction(
  data: AdjustmentData,
  userId: string
) {
  const { productId, adjustQuantity, reason, batchNumber, variantId, notes } =
    data;

  // 1. 在事务外部生成调整单号（避免嵌套事务导致死锁）
  const adjustmentNumber = await generateAdjustmentNumber();

  return await prisma.$transaction(
    async tx => {
      // 2. 查找现有库存记录
      const existingInventory = await tx.inventory.findFirst({
        where: {
          productId,
          ...(batchNumber && { batchNumber }),
          ...(variantId && { variantId }),
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
        // 更新现有库存
        updatedInventory = await tx.inventory.update({
          where: { id: existingInventory.id },
          data: { quantity: afterQuantity },
          include: {
            product: {
              select: { id: true, name: true, code: true },
            },
          },
        });
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
            batchNumber,
            variantId,
          },
          include: {
            product: {
              select: { id: true, name: true, code: true },
            },
          },
        });
      }

      // 3. 创建调整记录（审计追溯）
      const adjustmentRecord = await tx.inventoryAdjustment.create({
        data: {
          adjustmentNumber,
          productId,
          variantId,
          batchNumber,
          beforeQuantity,
          adjustQuantity,
          afterQuantity,
          reason,
          notes,
          status: 'approved', // 直接审批通过，后续可改为需要审批
          operatorId: userId,
          approverId: userId, // 暂时自动审批
          approvedAt: new Date(),
        },
      });

      return { inventory: updatedInventory, adjustment: adjustmentRecord };
    },
    {
      // 修复：SQLite不支持Serializable隔离级别，根据数据库类型动态设置
      ...(process.env.DATABASE_URL?.includes('mysql') && {
        isolationLevel: 'Serializable' as const,
      }),
      timeout: 10000,
    }
  );
}

/**
 * 库存调整API
 * POST /api/inventory/adjust
 */
export const POST = withAuth(
  async (request: NextRequest, { user }) => {
    return withErrorHandling(async () => {
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

      // WebSocket 推送更新（向后兼容，后续可移除）
      publishWs('inventory', {
        type: 'adjust',
        productId: validatedData.productId,
        adjustQuantity: validatedData.adjustQuantity,
        inventoryId: result.inventory.id,
        adjustmentNumber: result.adjustment.adjustmentNumber,
      });

      return NextResponse.json({
        success: true,
        data: {
          inventory: result.inventory,
          adjustment: result.adjustment,
        },
        message: '库存调整成功',
      });
    })(request, {});
  },
  { permissions: ['inventory:adjust'] }
);
