import { type NextRequest, NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth/api-helpers';
import { prisma } from '@/lib/db';
import { ensureSupplierCanBeDeactivated } from '@/lib/services/supplier-service';
import type { BatchUpdateSupplierStatusResult } from '@/lib/types/supplier';
import { BatchUpdateSupplierStatusSchema } from '@/lib/validations/supplier';

/**
 * PUT /api/suppliers/batch/status - 批量更新供应商状态
 */
export const PUT = withAuth(
  async (request: NextRequest) => {
    // 解析请求体
    const body = await request.json();
    const { supplierIds, status } = BatchUpdateSupplierStatusSchema.parse(body);

    // 查询要更新的供应商
    const suppliersToUpdate = await prisma.supplier.findMany({
      where: { id: { in: supplierIds } },
      select: { id: true, name: true, status: true },
      take: supplierIds.length,
    });

    const foundIds = suppliersToUpdate.map(s => s.id);
    const notFoundIds = supplierIds.filter(id => !foundIds.includes(id));

    let updatedCount = 0;
    let failedCount = 0;
    let unchangedCount = 0;
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

    // 统计状态相同的供应商(无需更新)
    unchangedCount = suppliersToUpdate.filter(s => s.status === status).length;

    // 获取需要更新的供应商
    const suppliersNeedingUpdate = suppliersToUpdate.filter(
      s => s.status !== status
    );

    const idsToUpdate: string[] = [];

    for (const supplier of suppliersNeedingUpdate) {
      if (status !== 'active') {
        try {
          await ensureSupplierCanBeDeactivated(supplier.id, supplier.name);
          idsToUpdate.push(supplier.id);
        } catch (error) {
          failedCount++;
          failedSuppliers.push({
            id: supplier.id,
            name: supplier.name,
            reason: error instanceof Error ? error.message : '供应商无法停用',
          });
        }
      } else {
        idsToUpdate.push(supplier.id);
      }
    }

    // 使用 updateMany 一次性更新所有需要更新的供应商
    if (idsToUpdate.length > 0) {
      try {
        const result = await prisma.supplier.updateMany({
          where: {
            id: { in: idsToUpdate },
          },
          data: { status },
        });

        updatedCount += result.count;
      } catch (error) {
        // 如果批量更新失败,回退到逐个更新
        console.warn('批量更新失败,回退到逐个更新:', error);

        for (const supplierId of idsToUpdate) {
          const supplier = suppliersToUpdate.find(s => s.id === supplierId);
          if (!supplier) {
            continue;
          }
          try {
            await prisma.supplier.update({
              where: { id: supplier.id },
              data: { status },
            });
            updatedCount += 1;
          } catch (updateError) {
            failedCount++;
            failedSuppliers.push({
              id: supplier.id,
              name: supplier.name,
              reason:
                updateError instanceof Error ? updateError.message : '更新失败',
            });
          }
        }
      }
    }

    const statusText =
      status === 'active' ? '启用' : status === 'inactive' ? '停用' : '暂停';
    const result: BatchUpdateSupplierStatusResult = {
      success: failedCount === 0,
      updatedCount,
      unchangedCount,
      failedCount,
      failedSuppliers: failedSuppliers.length > 0 ? failedSuppliers : undefined,
      message: `成功${statusText} ${updatedCount} 个供应商${unchangedCount > 0 ? `，${unchangedCount} 个已处于目标状态` : ''}${failedCount > 0 ? `，${failedCount} 个失败` : ''}`,
    };

    return NextResponse.json(result);
  },
  { permissions: ['suppliers:edit'] }
);
