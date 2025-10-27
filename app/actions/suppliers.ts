'use server';

import { Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { auth } from '@/lib/auth';
import type { AuthUser } from '@/lib/auth/context';
import { can } from '@/lib/auth/permissions';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import {
  ensureSupplierCanBeDeactivated,
  ensureSupplierCanBeDeleted,
} from '@/lib/services/supplier-service';

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

function mapSessionUserToAuthUser(user: {
  id: string;
  email?: string | null;
  username: string;
  name?: string | null;
  role: string;
  status: string;
}): AuthUser {
  return {
    id: user.id,
    email: user.email ?? '',
    username: user.username,
    name: user.name ?? user.username,
    role: user.role,
    status: user.status,
  };
}

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

    const authUser = mapSessionUserToAuthUser(session.user);
    if (!can(authUser, 'suppliers:create')) {
      return { success: false, error: '权限不足：需要 suppliers:create 权限' };
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
    if (lastSupplier?.supplierCode) {
      // 提取序号并加1
      const lastSequence = parseInt(lastSupplier.supplierCode.slice(-4));
      sequenceNumber = lastSequence + 1;
    }

    const maxRetries = 5;
    let supplierCode = '';
    let createdSupplier: {
      id: string;
      name: string;
      supplierCode: string | null;
    } | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt += 1) {
      supplierCode = `SUP${dateStr}${sequenceNumber.toString().padStart(4, '0')}`;

      // 4. 创建供应商
      try {
        const supplier = await prisma.supplier.create({
          data: {
            name: data.name,
            supplierCode,
            phone: data.phone || null,
            address: data.address || null,
            status: 'active',
          },
          select: {
            id: true,
            name: true,
            supplierCode: true,
          },
        });
        createdSupplier = supplier;
        break;
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          sequenceNumber += 1;
          continue;
        }
        throw error;
      }
    }

    if (!createdSupplier) {
      return { success: false, error: '创建供应商失败，请稍后重试' };
    }

    // 5. 重新验证路径
    revalidatePath('/suppliers');

    return {
      success: true,
      data: {
        id: createdSupplier.id,
        name: createdSupplier.name,
        supplierCode: createdSupplier.supplierCode ?? supplierCode,
      },
    };
  } catch (error) {
    logger.error('actions:suppliers', '创建供应商失败', error, {
      action: 'createSupplier',
    });
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message };
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
  let supplierIdForLog: string | undefined;

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: '未授权操作' };
    }

    const authUser = mapSessionUserToAuthUser(session.user);
    if (!can(authUser, 'suppliers:edit')) {
      return { success: false, error: '权限不足：需要 suppliers:edit 权限' };
    }

    const supplierId = formData.get('supplierId') as string;
    supplierIdForLog = supplierId;
    const rawData = JSON.parse(formData.get('data') as string);
    const data = updateSupplierSchema.parse(rawData);

    // 检查供应商是否存在
    const existingSupplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
      select: {
        id: true,
        name: true,
        status: true,
      },
    });

    if (!existingSupplier) {
      return { success: false, error: '供应商不存在' };
    }

    if (data.status === 'inactive' && existingSupplier.status !== 'inactive') {
      try {
        await ensureSupplierCanBeDeactivated(supplierId, existingSupplier.name);
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : '供应商无法停用',
        };
      }
    }

    const updatePayload: Prisma.SupplierUpdateInput = {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.phone !== undefined
        ? { phone: data.phone === '' ? null : data.phone }
        : {}),
      ...(data.address !== undefined
        ? { address: data.address === '' ? null : data.address }
        : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
    };

    // 更新供应商
    const supplier = await prisma.supplier.update({
      where: { id: supplierId },
      data: updatePayload,
    });

    revalidatePath('/suppliers');
    revalidatePath(`/suppliers/${supplierId}`);

    return {
      success: true,
      data: { id: supplier.id, name: supplier.name },
    };
  } catch (error) {
    logger.error('actions:suppliers', '更新供应商失败', error, {
      action: 'updateSupplier',
      supplierId: supplierIdForLog,
    });
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message };
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
  let supplierId: string | undefined;
  let status: 'active' | 'inactive' | undefined;

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: '未授权操作' };
    }

    const authUser = mapSessionUserToAuthUser(session.user);
    if (!can(authUser, 'suppliers:edit')) {
      return { success: false, error: '权限不足：需要 suppliers:edit 权限' };
    }

    const rawData = {
      supplierId: formData.get('supplierId') as string,
      status: formData.get('status') as string,
    };

    const data = updateSupplierStatusSchema.parse(rawData);
    supplierId = data.supplierId;
    status = data.status;

    // 检查供应商是否存在
    const supplier = await prisma.supplier.findUnique({
      where: { id: data.supplierId },
      select: {
        id: true,
        name: true,
        status: true,
      },
    });

    if (!supplier) {
      return { success: false, error: '供应商不存在' };
    }

    if (data.status === 'inactive' && supplier.status !== 'inactive') {
      try {
        await ensureSupplierCanBeDeactivated(data.supplierId, supplier.name);
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : '供应商无法停用',
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
    logger.error('actions:suppliers', '更新供应商状态失败', error, {
      action: 'updateSupplierStatus',
      supplierId,
      status,
    });
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message };
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

    const authUser = mapSessionUserToAuthUser(session.user);
    if (!can(authUser, 'suppliers:delete')) {
      return { success: false, error: '权限不足：需要 suppliers:delete 权限' };
    }

    try {
      await ensureSupplierCanBeDeleted(supplierId);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '供应商无法删除',
      };
    }

    const deleted = await prisma.supplier.delete({
      where: { id: supplierId },
      select: { id: true },
    });

    if (!deleted) {
      return { success: false, error: '供应商不存在' };
    }

    revalidatePath('/suppliers');

    return { success: true };
  } catch (error) {
    logger.error('actions:suppliers', '删除供应商失败', error, {
      action: 'deleteSupplier',
      supplierId,
    });
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

    const authUser = mapSessionUserToAuthUser(session.user);
    if (!can(authUser, 'suppliers:edit')) {
      return { success: false, error: '权限不足：需要 suppliers:edit 权限' };
    }

    const supplierIds = JSON.parse(
      formData.get('supplierIds') as string
    ) as string[];
    const status = formData.get('status') as 'active' | 'inactive';

    if (!supplierIds || supplierIds.length === 0) {
      return { success: false, error: '未选择供应商' };
    }

    const suppliers = await prisma.supplier.findMany({
      where: { id: { in: supplierIds } },
      select: {
        id: true,
        name: true,
        status: true,
      },
    });

    if (suppliers.length !== supplierIds.length) {
      return { success: false, error: '存在未找到的供应商，请刷新后重试' };
    }

    // 如果要停用供应商，需要检查每个供应商
    if (status === 'inactive') {
      for (const supplier of suppliers) {
        if (supplier.status === 'inactive') {
          continue;
        }
        try {
          await ensureSupplierCanBeDeactivated(supplier.id, supplier.name);
        } catch (error) {
          return {
            success: false,
            error:
              error instanceof Error
                ? error.message
                : `供应商 "${supplier.name}" 无法停用`,
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
    logger.error('actions:suppliers', '批量更新供应商状态失败', error, {
      action: 'bulkUpdateSupplierStatus',
    });
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

    const authUser = mapSessionUserToAuthUser(session.user);
    if (!can(authUser, 'suppliers:delete')) {
      return { success: false, error: '权限不足：需要 suppliers:delete 权限' };
    }

    const supplierIds = JSON.parse(
      formData.get('supplierIds') as string
    ) as string[];

    if (!supplierIds || supplierIds.length === 0) {
      return { success: false, error: '未选择供应商' };
    }

    const suppliers = await prisma.supplier.findMany({
      where: { id: { in: supplierIds } },
      select: {
        id: true,
        name: true,
      },
    });

    const foundIds = new Set(suppliers.map(s => s.id));
    const notFoundIds = supplierIds.filter(id => !foundIds.has(id));

    let failedCount = 0;
    const failedSuppliers: {
      id: string;
      name: string;
      reason: string;
    }[] = [];
    const deletableIds: string[] = [];

    notFoundIds.forEach(id => {
      failedCount += 1;
      failedSuppliers.push({
        id,
        name: '未知',
        reason: '供应商不存在',
      });
    });

    for (const supplier of suppliers) {
      try {
        await ensureSupplierCanBeDeleted(supplier.id, supplier.name);
        deletableIds.push(supplier.id);
      } catch (error) {
        failedCount += 1;
        failedSuppliers.push({
          id: supplier.id,
          name: supplier.name,
          reason: error instanceof Error ? error.message : '供应商无法删除',
        });
      }
    }

    if (deletableIds.length > 0) {
      const result = await prisma.supplier.deleteMany({
        where: { id: { in: deletableIds } },
      });
      const _deletedCount = result.count;
      const notDeleted = deletableIds.length - result.count;
      if (notDeleted > 0) {
        failedCount += notDeleted;
        failedSuppliers.push({
          id: 'unknown',
          name: '未知',
          reason: '部分供应商删除失败，请重试',
        });
      }
    }

    revalidatePath('/suppliers');

    if (failedCount > 0) {
      const errorMessage =
        failedSuppliers
          .map(item => `${item.name}：${item.reason}`)
          .filter(Boolean)
          .slice(0, 3)
          .join('；') || '部分供应商删除失败';
      return {
        success: false,
        error: errorMessage,
      };
    }

    return { success: true };
  } catch (error) {
    logger.error('actions:suppliers', '批量删除供应商失败', error, {
      action: 'bulkDeleteSuppliers',
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : '批量删除供应商失败',
    };
  }
}
