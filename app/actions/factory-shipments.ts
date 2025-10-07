'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

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

const factoryShipmentItemSchema = z.object({
  productId: z.string().optional(),
  supplierId: z.string().min(1, '供应商 ID 不能为空'),
  isManualProduct: z.boolean().default(false),
  manualProductName: z.string().optional(),
  quantity: z.number().positive('数量必须大于 0'),
  unitPrice: z.number().nonnegative('单价不能为负'),
  totalPrice: z.number().nonnegative('总价不能为负'),
  colorCode: z.string().optional(),
  productionDate: z.string().optional(),
  remarks: z.string().optional(),
});

const temporaryProductSchema = z.object({
  name: z.string().min(1, '商品名称不能为空'),
  specification: z.string().optional(),
  quantity: z.number().positive('数量必须大于 0'),
  unitPrice: z.number().nonnegative('单价不能为负'),
  totalPrice: z.number().nonnegative('总价不能为负'),
  remarks: z.string().optional(),
});

const createFactoryShipmentSchema = z.object({
  containerNumber: z.string().min(1, '柜号不能为空'),
  status: z
    .enum(['pending', 'in_transit', 'arrived', 'completed', 'cancelled'])
    .default('pending'),
  shipmentDate: z.string().optional(),
  arrivalDate: z.string().optional(),
  items: z.array(factoryShipmentItemSchema).min(1, '至少需要一个商品项'),
  temporaryProducts: z.array(temporaryProductSchema).optional(),
  remarks: z.string().optional(),
});

const updateFactoryShipmentStatusSchema = z.object({
  shipmentId: z.string().min(1, '发货单 ID 不能为空'),
  status: z.enum([
    'pending',
    'in_transit',
    'arrived',
    'completed',
    'cancelled',
  ]),
});

// ============================================
// Server Actions
// ============================================

/**
 * 创建厂家发货订单
 */
export async function createFactoryShipment(
  formData: FormData
): Promise<ActionResult<{ id: string; containerNumber: string }>> {
  try {
    // 1. 身份认证
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: '未授权操作' };
    }

    // 2. 解析和验证数据
    const rawData = JSON.parse(formData.get('data') as string);
    const data = createFactoryShipmentSchema.parse(rawData);

    // 3. 计算总金额
    const totalAmount = data.items.reduce(
      (sum, item) => sum + item.totalPrice,
      0
    );
    const temporaryProductsAmount =
      data.temporaryProducts?.reduce((sum, item) => sum + item.totalPrice, 0) ||
      0;
    const grandTotal = totalAmount + temporaryProductsAmount;

    // 4. 数据库事务
    const result = await prisma.$transaction(async tx => {
      // 创建厂家发货订单
      const shipment = await tx.factoryShipmentOrder.create({
        data: {
          containerNumber: data.containerNumber,
          status: data.status,
          totalAmount: grandTotal,
          shipmentDate: data.shipmentDate
            ? new Date(data.shipmentDate)
            : undefined,
          arrivalDate: data.arrivalDate
            ? new Date(data.arrivalDate)
            : undefined,
          remarks: data.remarks,
          userId: session.user.id,
          items: {
            create: data.items.map(item => ({
              productId: item.productId,
              supplierId: item.supplierId,
              isManualProduct: item.isManualProduct,
              manualProductName: item.manualProductName,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.totalPrice,
              colorCode: item.colorCode,
              productionDate: item.productionDate
                ? new Date(item.productionDate)
                : undefined,
              remarks: item.remarks,
            })),
          },
          temporaryProducts: data.temporaryProducts
            ? {
                create: data.temporaryProducts.map(product => ({
                  name: product.name,
                  specification: product.specification,
                  quantity: product.quantity,
                  unitPrice: product.unitPrice,
                  totalPrice: product.totalPrice,
                  remarks: product.remarks,
                })),
              }
            : undefined,
        },
      });

      // 如果订单状态为已到货，增加库存
      if (data.status === 'arrived' || data.status === 'completed') {
        for (const item of data.items) {
          if (item.productId && !item.isManualProduct) {
            // 查找或创建库存记录
            const existingInventory = await tx.inventory.findFirst({
              where: { productId: item.productId },
            });

            if (existingInventory) {
              await tx.inventory.update({
                where: { id: existingInventory.id },
                data: {
                  currentQuantity: {
                    increment: item.quantity,
                  },
                },
              });
            } else {
              await tx.inventory.create({
                data: {
                  productId: item.productId,
                  warehouseId: 'default-warehouse-id', // 需要根据实际情况调整
                  currentQuantity: item.quantity,
                  minQuantity: 0,
                  maxQuantity: 10000,
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
      return { success: false, error: error.errors[0].message };
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
    const session = await auth();
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
            const existingInventory = await tx.inventory.findFirst({
              where: { productId: item.productId },
            });

            if (existingInventory) {
              await tx.inventory.update({
                where: { id: existingInventory.id },
                data: {
                  currentQuantity: {
                    increment: item.quantity,
                  },
                },
              });
            }
          }
        }
      }

      // 如果从已到货变为取消，减少库存
      if (
        (shipment.status === 'arrived' || shipment.status === 'completed') &&
        data.status === 'cancelled'
      ) {
        for (const item of shipment.items) {
          if (item.productId && !item.isManualProduct) {
            await tx.inventory.updateMany({
              where: { productId: item.productId },
              data: {
                currentQuantity: {
                  decrement: item.quantity,
                },
              },
            });
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
      return { success: false, error: error.errors[0].message };
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
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: '未授权操作' };
    }

    await prisma.$transaction(async tx => {
      // 检查发货单是否存在
      const shipment = await tx.factoryShipmentOrder.findUnique({
        where: { id: shipmentId },
        include: { items: true, temporaryProducts: true },
      });

      if (!shipment) {
        throw new Error('发货单不存在');
      }

      // 不能删除已到货或已完成的发货单
      if (shipment.status === 'arrived' || shipment.status === 'completed') {
        throw new Error('不能删除已到货或已完成的发货单');
      }

      // 删除临时商品
      if (shipment.temporaryProducts.length > 0) {
        await tx.temporaryProduct.deleteMany({
          where: { factoryShipmentId: shipmentId },
        });
      }

      // 删除发货单项
      await tx.factoryShipmentItem.deleteMany({
        where: { factoryShipmentId: shipmentId },
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
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: '未授权操作' };
    }

    const shipmentId = formData.get('shipmentId') as string;
    const rawData = JSON.parse(formData.get('data') as string);
    const data = createFactoryShipmentSchema.parse(rawData);

    // 计算总金额
    const totalAmount = data.items.reduce(
      (sum, item) => sum + item.totalPrice,
      0
    );
    const temporaryProductsAmount =
      data.temporaryProducts?.reduce((sum, item) => sum + item.totalPrice, 0) ||
      0;
    const grandTotal = totalAmount + temporaryProductsAmount;

    await prisma.$transaction(async tx => {
      // 检查发货单是否存在
      const existingShipment = await tx.factoryShipmentOrder.findUnique({
        where: { id: shipmentId },
        include: { items: true, temporaryProducts: true },
      });

      if (!existingShipment) {
        throw new Error('发货单不存在');
      }

      // 不能修改已完成的发货单
      if (existingShipment.status === 'completed') {
        throw new Error('不能修改已完成的发货单');
      }

      // 删除旧的发货单项和临时商品
      await tx.factoryShipmentItem.deleteMany({
        where: { factoryShipmentId: shipmentId },
      });
      await tx.temporaryProduct.deleteMany({
        where: { factoryShipmentId: shipmentId },
      });

      // 更新发货单
      await tx.factoryShipmentOrder.update({
        where: { id: shipmentId },
        data: {
          containerNumber: data.containerNumber,
          status: data.status,
          totalAmount: grandTotal,
          shipmentDate: data.shipmentDate
            ? new Date(data.shipmentDate)
            : undefined,
          arrivalDate: data.arrivalDate
            ? new Date(data.arrivalDate)
            : undefined,
          remarks: data.remarks,
          items: {
            create: data.items.map(item => ({
              productId: item.productId,
              supplierId: item.supplierId,
              isManualProduct: item.isManualProduct,
              manualProductName: item.manualProductName,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.totalPrice,
              colorCode: item.colorCode,
              productionDate: item.productionDate
                ? new Date(item.productionDate)
                : undefined,
              remarks: item.remarks,
            })),
          },
          temporaryProducts: data.temporaryProducts
            ? {
                create: data.temporaryProducts.map(product => ({
                  name: product.name,
                  specification: product.specification,
                  quantity: product.quantity,
                  unitPrice: product.unitPrice,
                  totalPrice: product.totalPrice,
                  remarks: product.remarks,
                })),
              }
            : undefined,
        },
      });
    });

    revalidatePath('/factory-shipments');
    revalidatePath(`/factory-shipments/${shipmentId}`);

    return { success: true, data: { id: shipmentId } };
  } catch (error) {
    console.error('更新厂家发货订单失败:', error);
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : '更新厂家发货订单失败',
    };
  }
}
