'use server';

import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { z } from 'zod';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

export type ActionResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string; details?: unknown };

type AdjustReason =
  | 'inventory_gain'
  | 'inventory_loss'
  | 'damage_loss'
  | 'surplus_gain'
  | 'transfer'
  | 'other';

const ADJUST_REASON_MAP: Record<string, AdjustReason> = {
  INVENTORY_GAIN: 'inventory_gain',
  PURCHASE: 'inventory_gain',
  RETURN: 'inventory_gain',
  INVENTORY_LOSS: 'inventory_loss',
  SALE: 'inventory_loss',
  DAMAGE: 'damage_loss',
  DAMAGE_LOSS: 'damage_loss',
  SURPLUS: 'surplus_gain',
  SURPLUS_GAIN: 'surplus_gain',
  TRANSFER: 'transfer',
  COUNT: 'other',
  OTHER: 'other',
};

const inventoryAdjustFormSchema = z.object({
  productId: z.string().min(1, '产品 ID 不能为空'),
  variantId: z
    .string()
    .optional()
    .transform(value => (value?.trim() ? value.trim() : undefined)),
  batchNumber: z
    .string()
    .optional()
    .transform(value => (value?.trim() ? value.trim() : undefined)),
  quantity: z.coerce
    .number()
    .int('调整数量必须为整数')
    .refine(value => value !== 0, '调整数量不能为 0'),
  reason: z.string().min(1, '调整原因不能为空'),
  notes: z
    .string()
    .optional()
    .transform(value => (value?.trim() ? value.trim() : undefined)),
});

type InventoryAdjustInput = {
  productId: string;
  variantId: string | null;
  batchNumber: string | null;
  adjustQuantity: number;
  reason: AdjustReason;
  notes?: string | null;
};

function normalizeAdjustInput(
  input: z.infer<typeof inventoryAdjustFormSchema>
): InventoryAdjustInput {
  const variantId = input.variantId ?? null;
  const batchNumber = input.batchNumber ?? null;
  const reasonKey = input.reason.trim().toUpperCase();
  const mappedReason = ADJUST_REASON_MAP[reasonKey] ?? 'other';

  return {
    productId: input.productId,
    variantId,
    batchNumber,
    adjustQuantity: input.quantity,
    reason: mappedReason,
    notes: input.notes ?? null,
  };
}

function generateAdjustmentNumber() {
  const now = new Date();
  const timestamp = now
    .toISOString()
    .replace(/[-:.TZ]/g, '')
    .slice(0, 14);
  const randomSuffix = Math.random().toString(36).slice(-4).toUpperCase();
  return `ADJ-${timestamp}-${randomSuffix}`;
}

async function applyInventoryAdjustment(
  tx: Omit<
    typeof prisma,
    '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
  >,
  input: InventoryAdjustInput,
  operatorId: string
) {
  const inventory = await tx.inventory.findFirst({
    where: {
      productId: input.productId,
      variantId: input.variantId,
      batchNumber: input.batchNumber,
    },
  });

  const beforeQuantity = inventory?.quantity ?? 0;
  const afterQuantity = beforeQuantity + input.adjustQuantity;

  if (afterQuantity < 0) {
    throw new Error('库存不足，无法扣减');
  }

  let inventoryId: string;

  if (inventory) {
    const updated = await tx.inventory.update({
      where: { id: inventory.id },
      data: { quantity: afterQuantity },
    });
    inventoryId = updated.id;
  } else {
    if (input.adjustQuantity < 0) {
      throw new Error('无法扣减不存在的库存');
    }

    const created = await tx.inventory.create({
      data: {
        productId: input.productId,
        variantId: input.variantId,
        batchNumber: input.batchNumber,
        quantity: afterQuantity,
        reservedQuantity: 0,
      },
    });
    inventoryId = created.id;
  }

  await tx.inventoryAdjustment.create({
    data: {
      adjustmentNumber: generateAdjustmentNumber(),
      productId: input.productId,
      variantId: input.variantId,
      batchNumber: input.batchNumber,
      beforeQuantity,
      adjustQuantity: input.adjustQuantity,
      afterQuantity,
      reason: input.reason,
      notes: input.notes ?? null,
      operatorId,
      status: 'completed',
    },
  });

  return { id: inventoryId, newQuantity: afterQuantity };
}

export async function adjustInventory(
  formData: FormData
): Promise<ActionResult<{ id: string; newQuantity: number }>> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: '未授权：请先登录' };
    }

    const parseResult = inventoryAdjustFormSchema.safeParse({
      productId: formData.get('productId'),
      variantId: formData.get('variantId'),
      batchNumber: formData.get('batchNumber'),
      quantity: formData.get('quantity'),
      reason: formData.get('reason'),
      notes: formData.get('notes'),
    });

    if (!parseResult.success) {
      return {
        success: false,
        error: '输入数据格式不正确',
        details: parseResult.error.issues,
      };
    }

    const normalizedInput = normalizeAdjustInput(parseResult.data);

    const result = await prisma.$transaction(tx =>
      applyInventoryAdjustment(tx, normalizedInput, session.user.id)
    );

    revalidatePath('/inventory');
    revalidatePath('/inventory/adjustments');

    return { success: true, data: result };
  } catch (error) {
    console.error('库存调整失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '库存调整失败',
    };
  }
}

export async function batchAdjustInventory(
  formData: FormData
): Promise<ActionResult<{ count: number }>> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: '未授权：请先登录' };
    }

    const batchDataRaw = formData.get('batchData');
    if (typeof batchDataRaw !== 'string' || batchDataRaw.trim().length === 0) {
      return { success: false, error: '缺少批量数据' };
    }

    let parsedPayload: unknown;
    try {
      parsedPayload = JSON.parse(batchDataRaw);
    } catch {
      return { success: false, error: '批量数据格式不正确' };
    }

    if (!Array.isArray(parsedPayload)) {
      return { success: false, error: '批量数据必须是数组' };
    }

    const normalizedInputs: InventoryAdjustInput[] = [];

    for (const item of parsedPayload) {
      const parseResult = inventoryAdjustFormSchema.safeParse(item);
      if (!parseResult.success) {
        return {
          success: false,
          error: '数据验证失败',
          details: parseResult.error.issues,
        };
      }
      normalizedInputs.push(normalizeAdjustInput(parseResult.data));
    }

    await prisma.$transaction(async tx => {
      for (const input of normalizedInputs) {
        await applyInventoryAdjustment(tx, input, session.user.id);
      }
    });

    revalidatePath('/inventory');
    revalidatePath('/inventory/adjustments');

    return { success: true, data: { count: normalizedInputs.length } };
  } catch (error) {
    console.error('批量调整失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '批量调整失败',
    };
  }
}
