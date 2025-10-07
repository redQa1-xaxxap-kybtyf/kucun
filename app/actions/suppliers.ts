'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * 供应商管理模块 Server Actions
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

const createSupplierSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, '供应商名称不能为空')
    .max(100, '供应商名称不能超过100个字符'),
  phone: z
    .string()
    .trim()
    .max(20, '联系电话不能超过20个字符')
    .regex(/^[\d\s\-\+\(\)]*$/, '联系电话格式不正确')
    .optional()
    .nullable(),
  address: z
    .string()
    .trim()
    .max(200, '地址不能超过200个字符')
    .optional()
    .nullable(),
});

const updateSupplierSchema = z.object({
  name: z
    .string()
    .min(1, '供应商名称不能为空')
    .max(100, '供应商名称不能超过100个字符')
    .optional(),
  phone: z
    .string()
    .max(20, '联系电话不能超过20个字符')
    .regex(/^[\d\s\-\+\(\)]*$/, '联系电话格式不正确')
    .optional()
    .or(z.literal('')),
  address: z
    .string()
    .max(200, '地址不能超过200个字符')
    .optional()
    .or(z.literal('')),
  status: z.enum(['active', 'inactive']).optional(),
});

const updateSupplierStatusSchema = z.object({
  supplierId: z.string().min(1, '供应商 ID 不能为空'),
  status: z.enum(['active', 'inactive']),
});

// ============================================
// Server Actions
// ============================================

/**
 * 创建供应商
 */
export async function createSupplier(
  formData: FormData
): Promise<ActionResult<{ id: string; name: string; supplierCode: string }>> {
  try {
    // 1. 身份认证
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: '未授权操作' };
    }

    // 2. 解析和验证数据
    const rawData = JSON.parse(formData.get('data') as string);
    const data = createSupplierSchema.parse(rawData);

    // 3. 生成供应商编码
    // 格式: SUP + 年月日 + 4位序号 (例如: SUP20250107001)
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');

    // 查询今天创建的最后一个供应商编码
    const lastSupplier = await prisma.supplier.findFirst({
      where: {
        supplierCode: {
          startsWith: `SUP${dateStr}`,
        },
      },
      orderBy: {
        supplierCode: 'desc',
      },
    });

    let sequenceNumber = 1;
    if (lastSupplier) {
      // 提取序号并加1
      const lastSequence = parseInt(lastSupplier.supplierCode.slice(-4));
      sequenceNumber = lastSequence + 1;
    }

    const supplierCode = `SUP${dateStr}${sequenceNumber.toString().padStart(4, '0')}`;

    // 4. 创建供应商
    const supplier = await prisma.supplier.create({
      data: {
        name: data.name,
        supplierCode,
        phone: data.phone || null,
        address: data.address || null,
        status: 'active',
      },
    });

    // 5. 重新验证路径
    revalidatePath('/suppliers');

    return {
      success: true,
      data: {
        id: supplier.id,
        name: supplier.name,
        supplierCode: supplier.supplierCode,
      },
    };
  } catch (error) {
    console.error('创建供应商失败:', error);
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    return { success: false, error: '创建供应商失败' };
  }
}

/**
 * 更新供应商
 */
export async function updateSupplier(
  formData: FormData
): Promise<ActionResult<{ id: string; name: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: '未授权操作' };
    }

    const supplierId = formData.get('supplierId') as string;
    const rawData = JSON.parse(formData.get('data') as string);
    const data = updateSupplierSchema.parse(rawData);

    // 检查供应商是否存在
    const existingSupplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
    });

    if (!existingSupplier) {
      return { success: false, error: '供应商不存在' };
    }

    // 更新供应商
    const supplier = await prisma.supplier.update({
      where: { id: supplierId },
      data: {
        name: data.name,
        phone: data.phone === '' ? null : data.phone,
        address: data.address === '' ? null : data.address,
        status: data.status,
      },
    });

    revalidatePath('/suppliers');
    revalidatePath(`/suppliers/${supplierId}`);

    return {
      success: true,
      data: { id: supplier.id, name: supplier.name },
    };
  } catch (error) {
    console.error('更新供应商失败:', error);
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    return { success: false, error: '更新供应商失败' };
  }
}

/**
 * 更新供应商状态
 */
export async function updateSupplierStatus(
  formData: FormData
): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: '未授权操作' };
    }

    const rawData = {
      supplierId: formData.get('supplierId') as string,
      status: formData.get('status') as string,
    };

    const data = updateSupplierStatusSchema.parse(rawData);

    // 检查供应商是否存在
    const supplier = await prisma.supplier.findUnique({
      where: { id: data.supplierId },
      include: {
        factoryShipmentOrderItems: {
          include: {
            order: true,
          },
        },
        payableRecords: true,
      },
    });

    if (!supplier) {
      return { success: false, error: '供应商不存在' };
    }

    // 如果要停用供应商，检查是否有未完成的业务
    if (data.status === 'inactive') {
      // 检查是否有进行中的厂家发货订单
      const activeOrders = supplier.factoryShipmentOrderItems.filter(
        item =>
          item.order.status !== 'completed' && item.order.status !== 'cancelled'
      );

      if (activeOrders.length > 0) {
        return {
          success: false,
          error: `该供应商有 ${activeOrders.length} 个进行中的发货订单，无法停用`,
        };
      }

      // 检查是否有未结清的应付账款
      const unpaidPayables = supplier.payableRecords.filter(
        record => record.status !== 'paid' && record.status !== 'cancelled'
      );

      if (unpaidPayables.length > 0) {
        return {
          success: false,
          error: `该供应商有 ${unpaidPayables.length} 笔未结清的应付账款，无法停用`,
        };
      }
    }

    await prisma.supplier.update({
      where: { id: data.supplierId },
      data: { status: data.status },
    });

    revalidatePath('/suppliers');
    revalidatePath(`/suppliers/${data.supplierId}`);

    return { success: true };
  } catch (error) {
    console.error('更新供应商状态失败:', error);
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    return { success: false, error: '更新供应商状态失败' };
  }
}

/**
 * 删除供应商
 */
export async function deleteSupplier(
  supplierId: string
): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: '未授权操作' };
    }

    await prisma.$transaction(async tx => {
      // 检查供应商是否存在
      const supplier = await tx.supplier.findUnique({
        where: { id: supplierId },
        include: {
          factoryShipmentOrderItems: true,
          payableRecords: true,
        },
      });

      if (!supplier) {
        throw new Error('供应商不存在');
      }

      // 检查是否有关联的发货订单
      if (supplier.factoryShipmentOrderItems.length > 0) {
        throw new Error(
          `该供应商有 ${supplier.factoryShipmentOrderItems.length} 个发货订单，无法删除`
        );
      }

      // 检查是否有关联的应付账款
      if (supplier.payableRecords.length > 0) {
        throw new Error(
          `该供应商有 ${supplier.payableRecords.length} 笔应付账款记录，无法删除`
        );
      }

      // 删除供应商
      await tx.supplier.delete({
        where: { id: supplierId },
      });
    });

    revalidatePath('/suppliers');

    return { success: true };
  } catch (error) {
    console.error('删除供应商失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '删除供应商失败',
    };
  }
}

/**
 * 批量更新供应商状态
 */
export async function batchUpdateSupplierStatus(
  formData: FormData
): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: '未授权操作' };
    }

    const supplierIds = JSON.parse(
      formData.get('supplierIds') as string
    ) as string[];
    const status = formData.get('status') as 'active' | 'inactive';

    if (!supplierIds || supplierIds.length === 0) {
      return { success: false, error: '未选择供应商' };
    }

    // 如果要停用供应商，需要检查每个供应商
    if (status === 'inactive') {
      const suppliers = await prisma.supplier.findMany({
        where: { id: { in: supplierIds } },
        include: {
          factoryShipmentOrderItems: {
            include: {
              order: true,
            },
          },
          payableRecords: true,
        },
      });

      for (const supplier of suppliers) {
        // 检查进行中的订单
        const activeOrders = supplier.factoryShipmentOrderItems.filter(
          item =>
            item.order.status !== 'completed' &&
            item.order.status !== 'cancelled'
        );

        if (activeOrders.length > 0) {
          return {
            success: false,
            error: `供应商 "${supplier.name}" 有 ${activeOrders.length} 个进行中的发货订单，无法批量停用`,
          };
        }

        // 检查未结清的应付账款
        const unpaidPayables = supplier.payableRecords.filter(
          record => record.status !== 'paid' && record.status !== 'cancelled'
        );

        if (unpaidPayables.length > 0) {
          return {
            success: false,
            error: `供应商 "${supplier.name}" 有 ${unpaidPayables.length} 笔未结清的应付账款，无法批量停用`,
          };
        }
      }
    }

    await prisma.supplier.updateMany({
      where: { id: { in: supplierIds } },
      data: { status },
    });

    revalidatePath('/suppliers');

    return { success: true };
  } catch (error) {
    console.error('批量更新供应商状态失败:', error);
    return { success: false, error: '批量更新供应商状态失败' };
  }
}

/**
 * 批量删除供应商
 */
export async function batchDeleteSuppliers(
  formData: FormData
): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: '未授权操作' };
    }

    const supplierIds = JSON.parse(
      formData.get('supplierIds') as string
    ) as string[];

    if (!supplierIds || supplierIds.length === 0) {
      return { success: false, error: '未选择供应商' };
    }

    await prisma.$transaction(async tx => {
      // 检查所有供应商
      const suppliers = await tx.supplier.findMany({
        where: { id: { in: supplierIds } },
        include: {
          factoryShipmentOrderItems: true,
          payableRecords: true,
        },
      });

      for (const supplier of suppliers) {
        if (supplier.factoryShipmentOrderItems.length > 0) {
          throw new Error(
            `供应商 "${supplier.name}" 有 ${supplier.factoryShipmentOrderItems.length} 个发货订单，无法批量删除`
          );
        }

        if (supplier.payableRecords.length > 0) {
          throw new Error(
            `供应商 "${supplier.name}" 有 ${supplier.payableRecords.length} 笔应付账款记录，无法批量删除`
          );
        }
      }

      // 删除所有供应商
      await tx.supplier.deleteMany({
        where: { id: { in: supplierIds } },
      });
    });

    revalidatePath('/suppliers');

    return { success: true };
  } catch (error) {
    console.error('批量删除供应商失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '批量删除供应商失败',
    };
  }
}
