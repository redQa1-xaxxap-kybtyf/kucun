import { NextResponse, type NextRequest } from 'next/server';

import { prisma } from '@/lib/db';

/**
 * 搜索客户API
 * 支持按客户名称和电话号码搜索
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    // 构建搜索条件
    const whereCondition = query
      ? {
          OR: [
            {
              name: {
                contains: query,
                mode: 'insensitive' as const,
              },
            },
            {
              phone: {
                contains: query,
                mode: 'insensitive' as const,
              },
            },
          ],
        }
      : {};

    // 查询客户
    const customers = await prisma.customer.findMany({
      where: whereCondition,
      select: {
        id: true,
        name: true,
        phone: true,
        address: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: Math.min(limit, 50), // 最多返回50条记录
    });

    return NextResponse.json({
      success: true,
      data: customers,
      total: customers.length,
    });
  } catch (error) {
    console.error('客户搜索失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '搜索失败',
        message: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}
