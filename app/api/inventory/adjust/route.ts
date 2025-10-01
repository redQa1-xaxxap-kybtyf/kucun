import { getServerSession } from 'next-auth';
import { type NextRequest, NextResponse } from 'next/server';

import { withErrorHandling } from '@/lib/api/middleware';
import { authOptions } from '@/lib/auth';
import { invalidateInventoryCache } from '@/lib/cache/inventory-cache';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
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
 * 获取用户ID（开发环境或生产环境）
 */
async function getUserId(): Promise<string> {
  if (env.NODE_ENV === 'development') {
    // 开发环境下使用数据库中的第一个用户
    const user = await prisma.user.findFirst();
    if (!user) {
      throw new Error('开发环境下未找到可用用户');
    }
    return user.id;
  } else {
    // 生产环境下验证会话
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      throw new Error('未授权访问');
    }
    return session.user.id;
  }
}

/**
 * 库存调整API
 * POST /api/inventory/adjust
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  // 验证用户权限并获取用户ID
  const userId = await getUserId();

  const body = await request.json();

  // 验证请求数据
  const validatedData = inventoryAdjustSchema.parse(body);

  const { idempotencyKey, productId } = validatedData;

  // 使用幂等性包装器执行调整操作
  const result = await withIdempotency(
    idempotencyKey,
    'adjust',
    productId,
    userId,
    validatedData,
    async () => await executeAdjustmentTransaction(validatedData, userId)
  );

  // 清除相关缓存
  await invalidateInventoryCache(validatedData.productId);

  // WebSocket 推送更新
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
});
