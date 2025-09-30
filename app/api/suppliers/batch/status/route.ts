import { type NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { BatchUpdateSupplierStatusSchema } from '@/lib/schemas/supplier';
import type { BatchUpdateSupplierStatusResult } from '@/lib/types/supplier';

/**
 * PUT /api/suppliers/batch/status - 批量更新供应商状态
 */
export async function PUT(request: NextRequest) {
  try {
    // 验证用户身份
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    // 解析请求体
    const body = await request.json();
    const { supplierIds, status } = BatchUpdateSupplierStatusSchema.parse(body);

    // 查询要更新的供应商
    const suppliersToUpdate = await prisma.supplier.findMany({
      where: { id: { in: supplierIds } },
      select: { id: true, name: true, status: true },
    });

    const foundIds = suppliersToUpdate.map(s => s.id);
    const notFoundIds = supplierIds.filter(id => !foundIds.includes(id));

    let updatedCount = 0;
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

    // 统计状态相同的供应商(无需更新)
    const sameStatusSuppliers = suppliersToUpdate.filter(
      s => s.status === status
    );
    const sameStatusCount = sameStatusSuppliers.length;

    // 获取需要更新的供应商ID
    const idsToUpdate = suppliersToUpdate
      .filter(s => s.status !== status)
      .map(s => s.id);

    // 使用updateMany一次性更新所有需要更新的供应商
    if (idsToUpdate.length > 0) {
      try {
        const result = await prisma.supplier.updateMany({
          where: {
            id: { in: idsToUpdate },
          },
          data: { status },
        });

        updatedCount = result.count + sameStatusCount;
      } catch (error) {
        // 如果批量更新失败,回退到逐个更新
        console.warn('批量更新失败,回退到逐个更新:', error);

        for (const supplier of suppliersToUpdate) {
          try {
            if (supplier.status === status) {
              updatedCount++;
              continue;
            }

            await prisma.supplier.update({
              where: { id: supplier.id },
              data: { status },
            });

            updatedCount++;
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
    } else {
      // 所有供应商状态都相同,无需更新
      updatedCount = sameStatusCount;
    }

    const statusText = status === 'active' ? '启用' : '停用';
    const result: BatchUpdateSupplierStatusResult = {
      success: failedCount === 0,
      updatedCount,
      failedCount,
      failedSuppliers: failedSuppliers.length > 0 ? failedSuppliers : undefined,
      message: `成功${statusText} ${updatedCount} 个供应商${failedCount > 0 ? `，${failedCount} 个失败` : ''}`,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('批量更新供应商状态失败:', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : '批量更新供应商状态失败',
      },
      { status: 500 }
    );
  }
}
