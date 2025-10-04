import { NextResponse, type NextRequest } from 'next/server';

import { withAuth } from '@/lib/auth/api-helpers';
import { prisma } from '@/lib/db';
import type { BatchDeleteSuppliersResult } from '@/lib/types/supplier';
import { BatchDeleteSuppliersSchema } from '@/lib/validations/supplier';

/**
 * DELETE /api/suppliers/batch - 批量删除供应商
 */
export const DELETE = withAuth(
  async (request: NextRequest) => {
    // 解析请求体
    const body = await request.json();
    const { supplierIds } = BatchDeleteSuppliersSchema.parse(body);

    // 查询要删除的供应商
    const suppliersToDelete = await prisma.supplier.findMany({
      where: { id: { in: supplierIds } },
      select: { id: true, name: true },
    });

    const foundIds = suppliersToDelete.map(s => s.id);
    const notFoundIds = supplierIds.filter(id => !foundIds.includes(id));

    let deletedCount = 0;
    let failedCount = 0;
    const failedSuppliers: { id: string; name: string; reason: string }[] = [];

    // 处理不存在的供应商
    notFoundIds.forEach(id => {
      failedCount++;
      failedSuppliers.push({
        id,
        name: '未知',
        reason: '供应商不存在',
      });
    });

    // 批量删除存在的供应商
    for (const supplier of suppliersToDelete) {
      try {
        // TODO: 检查是否有关联的采购订单等
        // 这里可以根据业务需求添加相关检查

        await prisma.supplier.delete({
          where: { id: supplier.id },
        });

        deletedCount++;
      } catch (error) {
        failedCount++;
        failedSuppliers.push({
          id: supplier.id,
          name: supplier.name,
          reason: error instanceof Error ? error.message : '删除失败',
        });
      }
    }

    const result: BatchDeleteSuppliersResult = {
      success: failedCount === 0,
      deletedCount,
      failedCount,
      failedSuppliers: failedSuppliers.length > 0 ? failedSuppliers : undefined,
      message: `成功删除 ${deletedCount} 个供应商${failedCount > 0 ? `，${failedCount} 个失败` : ''}`,
    };

    return NextResponse.json(result);
  },
  { permissions: ['suppliers:delete'] }
);
