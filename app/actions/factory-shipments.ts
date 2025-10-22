'use server';

import type { Prisma } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { generateFactoryShipmentNumber } from '@/lib/services/simple-order-number-generator';
import {
  FACTORY_SHIPMENT_STATUS,
  type FactoryShipmentStatus,
} from '@/lib/types/factory-shipment';

const FACTORY_SHIPMENT_STATUS_VALUES = Object.values(
  FACTORY_SHIPMENT_STATUS
) as FactoryShipmentStatus[];

const factoryShipmentStatusEnum = z.enum(
  FACTORY_SHIPMENT_STATUS_VALUES as [
    FactoryShipmentStatus,
    ...FactoryShipmentStatus[],
  ]
);

/**
 * 厂家发货模块 Server Actions
 *
 * ✅ Next.js 15 最佳实践：
 * 1. 'use server' 指令
 * 2. Zod 参数验证
 * 3. 身份认证检查
 * 4. Prisma 事务处理
 * 5. 路径重新验证
 */

// ============================================
// 类型定义
// ============================================

export type ActionResult<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
};

// ============================================
// Zod 验证模式
// ============================================

const factoryShipmentItemSchema = z
  .object({
    productId: z.string().optional(),
    supplierId: z.string().min(1, '供应商 ID 不能为空'),
    isManualProduct: z.boolean().optional(),
    manualProductName: z.string().optional(),
    manualSpecification: z.string().optional(),
    manualWeight: z.number().nonnegative('重量不能为负数').optional(),
    manualUnit: z.string().optional(),
    displayName: z.string().min(1, '商品名称不能为空'),
    specification: z.string().optional(),
    unit: z.string().optional(),
    weight: z.number().nonnegative('重量不能为负数').optional(),
    quantity: z.number().positive('数量必须大于 0'),
    unitPrice: z.number().nonnegative('单价不能为负'),
    totalPrice: z.number().nonnegative('总价不能为负'),
    remarks: z.string().optional(),
  })
  .superRefine((item, ctx) => {
    const trimmedManualName = item.manualProductName?.trim();
    const hasProduct = Boolean(item.productId && item.productId.trim());
    const isManual = Boolean(item.isManualProduct);

    if (!isManual && !hasProduct) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '请选择商品或启用手动商品',
      });
    }

    if (isManual && !trimmedManualName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '手动商品必须填写名称',
        path: ['manualProductName'],
      });
    }
  });

const createFactoryShipmentSchema = z.object({
  customerId: z.string().min(1, '客户 ID 不能为空'),
  containerNumber: z.string().optional(),
  status: factoryShipmentStatusEnum.default(FACTORY_SHIPMENT_STATUS.DRAFT),
  planDate: z.string().optional(),
  shipmentDate: z.string().optional(),
  arrivalDate: z.string().optional(),
  items: z.array(factoryShipmentItemSchema).min(1, '至少需要一个商品项'),
  receivableAmount: z.number().nonnegative('应收金额不能为负').optional(),
  depositAmount: z.number().nonnegative('定金金额不能为负').optional(),
  remarks: z.string().optional(),
});

const updateFactoryShipmentStatusSchema = z.object({
  shipmentId: z.string().min(1, '发货单 ID 不能为空'),
  status: factoryShipmentStatusEnum,
});

type FactoryShipmentItemInput = z.infer<typeof factoryShipmentItemSchema>;
type FactoryShipmentFormData = z.infer<typeof createFactoryShipmentSchema>;

async function resolveShipmentItems(
  tx: Omit<
    typeof prisma,
    '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
  >,
  items: FactoryShipmentItemInput[]
): Promise<
  Prisma.FactoryShipmentOrderItemUncheckedCreateWithoutFactoryShipmentOrderInput[]
> {
  const productIds = Array.from(
    new Set(
      items
        .map(item => item.productId)
        .filter((id): id is string => Boolean(id))
    )
  );

  const products =
    productIds.length > 0
      ? await tx.product.findMany({
          where: { id: { in: productIds } },
          select: {
            id: true,
            name: true,
            specification: true,
            unit: true,
            weight: true,
          },
        })
      : [];

  const productMap = new Map(products.map(product => [product.id, product]));

  return items.map(item => {
    const product = item.productId ? productMap.get(item.productId) : undefined;
    const trimmedManualName = item.manualProductName?.trim();
    const trimmedDisplayName =
      item.displayName?.trim() ||
      (product?.name ?? trimmedManualName ?? '未知商品');
    const trimmedSpecification =
      item.specification?.trim() ?? product?.specification ?? undefined;
    const trimmedUnit = item.unit?.trim() ?? product?.unit ?? 'piece';
    const itemWeight =
      typeof item.weight === 'number'
        ? item.weight
        : (product?.weight ?? undefined);

    return {
      productId:
        item.productId && item.productId.trim().length > 0
          ? item.productId
          : null,
      supplierId: item.supplierId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
      isManualProduct: item.isManualProduct ? true : undefined,
      manualProductName: item.isManualProduct
        ? (trimmedManualName ?? '临时商品')
        : undefined,
      manualSpecification: item.isManualProduct
        ? (item.manualSpecification?.trim() ?? undefined)
        : undefined,
      manualWeight: item.isManualProduct
        ? (item.manualWeight ?? undefined)
        : undefined,
      manualUnit: item.isManualProduct
        ? (item.manualUnit?.trim() ?? undefined)
        : undefined,
      remarks: item.remarks?.trim() ?? undefined,
      displayName: trimmedDisplayName,
      specification: trimmedSpecification,
      unit: trimmedUnit,
      weight: itemWeight,
    };
  });
}

function parseJsonPayload<T>(formData: FormData, key: string): T {
  const payload = formData.get(key);
  if (typeof payload !== 'string' || !payload) {
    throw new Error('提交数据格式不正确');
  }
  return JSON.parse(payload) as T;
}

// ============================================
// Server Actions
// ============================================

/**
 * 创建厂家发货订单
 */
export async function createFactoryShipment(
  formData: FormData
): Promise<ActionResult<{ id: string; containerNumber: string | null }>> {
  try {
    // 1. 身份认证
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: '未授权操作' };
    }

    // 2. 解析和验证数据
    const rawData = parseJsonPayload<FactoryShipmentFormData>(formData, 'data');
    const data = createFactoryShipmentSchema.parse(rawData);

    // 3. 计算总金额
    const totalAmount = data.items.reduce(
      (sum, item) => sum + item.totalPrice,
      0
    );
    const grandTotal = totalAmount;

    // 4. 数据库事务
    const result = await prisma.$transaction(async tx => {
      const itemsPayload = await resolveShipmentItems(tx, data.items);
      const orderNumber = await generateFactoryShipmentNumber();
      const status: FactoryShipmentStatus =
        (data.status as FactoryShipmentStatus | undefined) ??
        FACTORY_SHIPMENT_STATUS.DRAFT;
      const receivableAmount = data.receivableAmount ?? grandTotal;
      const depositAmount = Math.min(data.depositAmount ?? 0, receivableAmount);
      const trimmedContainer = data.containerNumber?.trim();

      // 创建厂家发货订单
      const shipment = await tx.factoryShipmentOrder.create({
        data: {
          orderNumber,
          containerNumber:
            trimmedContainer && trimmedContainer.length > 0
              ? trimmedContainer
              : null,
          customerId: data.customerId,
          status,
          totalAmount: grandTotal,
          receivableAmount,
          depositAmount,
          planDate: data.planDate ? new Date(data.planDate) : undefined,
          shipmentDate: data.shipmentDate
            ? new Date(data.shipmentDate)
            : undefined,
          arrivalDate: data.arrivalDate
            ? new Date(data.arrivalDate)
            : undefined,
          remarks: data.remarks?.trim() || undefined,
          userId: session.user.id,
          items: {
            create: itemsPayload,
          },
        },
      });

      // 如果订单状态为已到货，增加库存
      if (
        status === FACTORY_SHIPMENT_STATUS.ARRIVED ||
        status === FACTORY_SHIPMENT_STATUS.COMPLETED
      ) {
        for (const item of itemsPayload) {
          if (item.productId && !item.isManualProduct) {
            const quantityDelta = Math.round(item.quantity);
            // 查找或创建库存记录
            const existingInventory = await tx.inventory.findFirst({
              where: { productId: item.productId },
            });

            if (existingInventory) {
              await tx.inventory.update({
                where: { id: existingInventory.id },
                data: {
                  quantity: {
                    increment: quantityDelta,
                  },
                },
              });
            } else {
              await tx.inventory.create({
                data: {
                  productId: item.productId,
                  quantity: quantityDelta,
                  reservedQuantity: 0,
                },
              });
            }
          }
        }
      }

      return shipment;
    });

    // 5. 重新验证路径
    revalidatePath('/factory-shipments');
    revalidatePath('/inventory');

    return {
      success: true,
      data: { id: result.id, containerNumber: result.containerNumber },
    };
  } catch (error) {
    console.error('创建厂家发货订单失败:', error);
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues?.[0]?.message ?? '数据验证失败',
      };
    }
    return { success: false, error: '创建厂家发货订单失败' };
  }
}

/**
 * 更新厂家发货订单状态
 */
export async function updateFactoryShipmentStatus(
  formData: FormData
): Promise<ActionResult> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: '未授权操作' };
    }

    const rawData = {
      shipmentId: formData.get('shipmentId') as string,
      status: formData.get('status') as string,
    };

    const data = updateFactoryShipmentStatusSchema.parse(rawData);

    await prisma.$transaction(async tx => {
      // 获取发货单详情
      const shipment = await tx.factoryShipmentOrder.findUnique({
        where: { id: data.shipmentId },
        include: { items: true },
      });

      if (!shipment) {
        throw new Error('发货单不存在');
      }

      // 更新发货单状态
      await tx.factoryShipmentOrder.update({
        where: { id: data.shipmentId },
        data: { status: data.status },
      });

      // 如果从待发货/运输中变为已到货，增加库存
      if (
        (shipment.status === 'pending' || shipment.status === 'in_transit') &&
        (data.status === 'arrived' || data.status === 'completed')
      ) {
        for (const item of shipment.items) {
          if (item.productId && !item.isManualProduct) {
            const quantityDelta = Math.round(item.quantity);
            const existingInventory = await tx.inventory.findFirst({
              where: { productId: item.productId },
            });

            if (existingInventory) {
              await tx.inventory.update({
                where: { id: existingInventory.id },
                data: {
                  quantity: {
                    increment: quantityDelta,
                  },
                },
              });
            }
          }
        }
      }
    });

    revalidatePath('/factory-shipments');
    revalidatePath(`/factory-shipments/${data.shipmentId}`);
    revalidatePath('/inventory');

    return { success: true };
  } catch (error) {
    console.error('更新发货单状态失败:', error);
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues?.[0]?.message ?? '数据验证失败',
      };
    }
    return { success: false, error: '更新发货单状态失败' };
  }
}

/**
 * 删除厂家发货订单
 */
export async function deleteFactoryShipment(
  shipmentId: string
): Promise<ActionResult> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: '未授权操作' };
    }

    await prisma.$transaction(async tx => {
      // 检查发货单是否存在
      const shipment = await tx.factoryShipmentOrder.findUnique({
        where: { id: shipmentId },
        include: { items: true },
      });

      if (!shipment) {
        throw new Error('发货单不存在');
      }

      // 不能删除已到货或已完成的发货单
      if (shipment.status === 'arrived' || shipment.status === 'completed') {
        throw new Error('不能删除已到货或已完成的发货单');
      }

      // 删除发货单项
      await tx.factoryShipmentOrderItem.deleteMany({
        where: { factoryShipmentOrderId: shipmentId },
      });

      // 删除发货单
      await tx.factoryShipmentOrder.delete({
        where: { id: shipmentId },
      });
    });

    revalidatePath('/factory-shipments');

    return { success: true };
  } catch (error) {
    console.error('删除发货单失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '删除发货单失败',
    };
  }
}

/**
 * 更新厂家发货订单
 */
export async function updateFactoryShipment(
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { success: false, error: '未授权操作' };
    }

    const shipmentIdValue = formData.get('shipmentId');
    if (typeof shipmentIdValue !== 'string' || !shipmentIdValue) {
      return { success: false, error: '发货单 ID 不能为空' };
    }
    const shipmentId = shipmentIdValue;

    const rawData = parseJsonPayload<FactoryShipmentFormData>(formData, 'data');
    const data = createFactoryShipmentSchema.parse(rawData);

    // 计算总金额
    const totalAmount = data.items.reduce(
      (sum, item) => sum + item.totalPrice,
      0
    );
    const grandTotal = totalAmount;

    await prisma.$transaction(async tx => {
      // 检查发货单是否存在
      const existingShipment = await tx.factoryShipmentOrder.findUnique({
        where: { id: shipmentId },
        include: { items: true },
      });

      if (!existingShipment) {
        throw new Error('发货单不存在');
      }

      // 不能修改已完成的发货单
      if (existingShipment.status === 'completed') {
        throw new Error('不能修改已完成的发货单');
      }

      // 删除旧的发货单项和临时商品
      await tx.factoryShipmentOrderItem.deleteMany({
        where: { factoryShipmentOrderId: shipmentId },
      });

      const itemsPayload = await resolveShipmentItems(tx, data.items);
      const receivableAmount = data.receivableAmount ?? grandTotal;
      const depositAmount = Math.min(
        data.depositAmount ?? existingShipment.depositAmount ?? 0,
        receivableAmount
      );
      const updateData: Prisma.FactoryShipmentOrderUncheckedUpdateInput = {
        customerId: data.customerId,
        status: data.status ?? existingShipment.status,
        totalAmount: grandTotal,
        receivableAmount,
        depositAmount,
        remarks: data.remarks?.trim() ?? existingShipment.remarks ?? undefined,
        items: {
          create: itemsPayload,
        },
      };

      if (data.containerNumber !== undefined) {
        const trimmed = data.containerNumber.trim();
        if (trimmed.length > 0) {
          updateData.containerNumber = trimmed;
        }
      }

      if (data.planDate) {
        updateData.planDate = new Date(data.planDate);
      }

      if (data.shipmentDate) {
        updateData.shipmentDate = new Date(data.shipmentDate);
      }

      if (data.arrivalDate) {
        updateData.arrivalDate = new Date(data.arrivalDate);
      }

      // 更新发货单
      await tx.factoryShipmentOrder.update({
        where: { id: shipmentId },
        data: updateData,
      });
    });

    revalidatePath('/factory-shipments');
    revalidatePath(`/factory-shipments/${shipmentId}`);

    return { success: true, data: { id: shipmentId } };
  } catch (error) {
    console.error('更新厂家发货订单失败:', error);
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues?.[0]?.message ?? '数据验证失败',
      };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : '更新厂家发货订单失败',
    };
  }
}
