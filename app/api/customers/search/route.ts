import { NextResponse, type NextRequest } from 'next/server';

import { withAuth } from '@/lib/auth/api-helpers';
import { prisma } from '@/lib/db';
import { customerSearchQuerySchema } from '@/lib/validations/customer';

/**
 * 搜索客户API
 * 支持按客户名称和电话号码搜索
 * 使用 Zod schema 进行参数验证，遵循"唯一真理源"规范
 */
export const GET = withAuth(
  async (request: NextRequest) => {
    // 解析并验证查询参数
    const { searchParams } = new URL(request.url);
    const queryParams = {
      q: searchParams.get('q') || undefined,
      limit: searchParams.get('limit')
        ? parseInt(searchParams.get('limit')!, 10)
        : undefined,
    };

    // 使用 Zod schema 验证
    const validationResult = customerSearchQuerySchema.safeParse(queryParams);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: '查询参数验证失败',
          details: validationResult.error.issues,
        },
        { status: 400 }
      );
    }

    const { q: query = '', limit = 10 } = validationResult.data;

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
      take: limit,
    });

    return NextResponse.json({
      success: true,
      data: customers,
      total: customers.length,
    });
  },
  { permissions: ['customers:view'] }
);
