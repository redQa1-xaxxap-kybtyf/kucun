import { type NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import type { AdjustmentQueryParams } from '@/lib/types/inventory';

/**
 * 获取库存调整记录列表
 * GET /api/inventory/adjustments
 */
export async function GET(request: NextRequest) {
  try {
    // 验证用户权限
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);

    // 解析查询参数
    const queryParams: AdjustmentQueryParams = {
      page: Number(searchParams.get('page')) || 1,
      limit: Math.min(Number(searchParams.get('limit')) || 20, 100),
      search: searchParams.get('search') || undefined,
      sortBy:
        (searchParams.get('sortBy') as AdjustmentQueryParams['sortBy']) ||
        'createdAt',
      sortOrder: (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc',
      productId: searchParams.get('productId') || undefined,
      variantId: searchParams.get('variantId') || undefined,
      batchNumber: searchParams.get('batchNumber') || undefined,
      reason:
        (searchParams.get('reason') as AdjustmentQueryParams['reason']) ||
        undefined,
      status:
        (searchParams.get('status') as AdjustmentQueryParams['status']) ||
        undefined,
      operatorId: searchParams.get('operatorId') || undefined,
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
    };

    const { page, limit, search, sortBy, sortOrder } = queryParams;
    const offset = (page - 1) * limit;

    // 构建查询条件
    const where: Record<string, unknown> = {};

    // 搜索条件
    if (search) {
      where.OR = [
        { adjustmentNumber: { contains: search } },
        { notes: { contains: search } },
        { product: { name: { contains: search } } },
        { product: { code: { contains: search } } },
      ];
    }

    // 筛选条件
    if (queryParams.productId) {
      where.productId = queryParams.productId;
    }

    if (queryParams.variantId) {
      where.variantId = queryParams.variantId;
    }

    if (queryParams.batchNumber) {
      where.batchNumber = queryParams.batchNumber;
    }

    if (queryParams.reason) {
      where.reason = queryParams.reason;
    }

    if (queryParams.status) {
      where.status = queryParams.status;
    }

    if (queryParams.operatorId) {
      where.operatorId = queryParams.operatorId;
    }

    // 日期范围筛选
    if (queryParams.startDate || queryParams.endDate) {
      where.createdAt = {};
      if (queryParams.startDate) {
        where.createdAt.gte = new Date(queryParams.startDate);
      }
      if (queryParams.endDate) {
        where.createdAt.lte = new Date(queryParams.endDate);
      }
    }

    // 排序配置
    const orderBy: Record<string, 'asc' | 'desc'> = {};
    if (sortBy === 'createdAt') {
      orderBy.createdAt = sortOrder;
    } else if (sortBy === 'adjustmentNumber') {
      orderBy.adjustmentNumber = sortOrder;
    } else if (sortBy === 'adjustQuantity') {
      orderBy.adjustQuantity = sortOrder;
    } else if (sortBy === 'reason') {
      orderBy.reason = sortOrder;
    }

    // 查询数据
    const [adjustments, total] = await Promise.all([
      prisma.inventoryAdjustment.findMany({
        where,
        include: {
          product: {
            select: {
              id: true,
              code: true,
              name: true,
              specification: true,
              unit: true,
            },
          },
          variant: {
            select: {
              id: true,
              colorCode: true,
              colorName: true,
              sku: true,
            },
          },
          operator: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          approver: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy,
        skip: offset,
        take: limit,
      }),
      prisma.inventoryAdjustment.count({ where }),
    ]);

    // 格式化数据
    const formattedAdjustments = adjustments.map(adjustment => ({
      id: adjustment.id,
      adjustmentNumber: adjustment.adjustmentNumber,
      productId: adjustment.productId,
      variantId: adjustment.variantId,
      batchNumber: adjustment.batchNumber,
      beforeQuantity: adjustment.beforeQuantity,
      adjustQuantity: adjustment.adjustQuantity,
      afterQuantity: adjustment.afterQuantity,
      reason: adjustment.reason,
      notes: adjustment.notes,
      status: adjustment.status,
      operatorId: adjustment.operatorId,
      approverId: adjustment.approverId,
      approvedAt: adjustment.approvedAt?.toISOString(),
      createdAt: adjustment.createdAt.toISOString(),
      updatedAt: adjustment.updatedAt.toISOString(),
      product: adjustment.product,
      variant: adjustment.variant,
      operator: adjustment.operator,
      approver: adjustment.approver,
    }));

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      success: true,
      data: {
        adjustments: formattedAdjustments,
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
      },
    });
  } catch (error) {
    console.error('获取库存调整记录失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '获取库存调整记录失败',
      },
      { status: 500 }
    );
  }
}
