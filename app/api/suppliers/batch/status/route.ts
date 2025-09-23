import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
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

    // 批量更新存在的供应商状态
    for (const supplier of suppliersToUpdate) {
      try {
        // 检查状态是否需要更新
        if (supplier.status === status) {
          // 状态相同，跳过更新但计入成功
          updatedCount++;
          continue;
        }

        await prisma.supplier.update({
          where: { id: supplier.id },
          data: { status },
        });

        updatedCount++;
      } catch (error) {
        failedCount++;
        failedSuppliers.push({
          id: supplier.id,
          name: supplier.name,
          reason: error instanceof Error ? error.message : '更新失败',
        });
      }
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
