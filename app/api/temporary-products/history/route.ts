import { type NextRequest, NextResponse } from 'next/server';

import { parseOffsetPagination } from '@/lib/api/pagination';
import { prisma } from '@/lib/db';

/**
 * GET /api/temporary-products/history
 * 查询历史临时产品列表（按使用频率降序排序）
 *
 * Query Parameters:
 * - supplierId: 供应商ID（可选，如果提供则只返回该供应商的临时产品）
 * - search: 搜索关键词（可选，搜索产品名称和规格）
 * - page: 页码（默认1）
 * - limit: 每页数量（默认20）
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const supplierId = searchParams.get('supplierId');
    const search = searchParams.get('search');

    let page: number;
    let limit: number;
    let skip: number;
    try {
      const parsed = parseOffsetPagination(searchParams, {
        defaultLimit: 20,
        maxLimit: 100,
        strict: true,
        pageFieldLabel: '页码',
        limitFieldLabel: '每页数量',
      });
      page = parsed.page;
      limit = parsed.limit;
      skip = parsed.skip;
    } catch (error) {
      return NextResponse.json(
        {
          error: error instanceof Error ? error.message : '分页参数格式不正确',
        },
        { status: 400 }
      );
    }

    // 构建查询条件
    const where: {
      supplierId?: string;
      OR?: Array<{
        name?: { contains: string };
        specification?: { contains: string };
      }>;
    } = {};

    if (supplierId) {
      where.supplierId = supplierId;
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { specification: { contains: search } },
      ];
    }

    // 查询总数
    const total = await prisma.temporaryProduct.count({ where });

    // 查询数据（按使用频率降序排序）
    const products = await prisma.temporaryProduct.findMany({
      where,
      select: {
        id: true,
        code: true,
        name: true,
        specification: true,
        unit: true,
        weight: true,
        piecesPerUnit: true,
        usageCount: true,
        lastUsedAt: true,
        supplierId: true,
        supplier: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [
        { usageCount: 'desc' }, // 按使用次数降序
        { lastUsedAt: 'desc' }, // 最近使用时间降序
        { id: 'desc' },
      ],
      skip,
      take: limit,
    });

    return NextResponse.json({
      data: products,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('查询历史临时产品失败:', error);
    return NextResponse.json(
      { error: '查询历史临时产品失败' },
      { status: 500 }
    );
  }
}
