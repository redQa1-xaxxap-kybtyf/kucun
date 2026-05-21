/**
 * 性能测试API端点 - 临时使用
 * 用于性能测试，需通过分类权限校验
 */

import { NextResponse, type NextRequest } from 'next/server';

import { withAuth } from '@/lib/auth/api-helpers';
import { prisma } from '@/lib/db';

/**
 * GET /api/performance/categories - 性能测试专用分类列表
 */
export const GET = withAuth(
  async (request: NextRequest) => {
    try {
      const { searchParams } = request.nextUrl;

      // 解析查询参数
      const queryParams = {
        page: parseInt(searchParams.get('page') || '1'),
        limit: parseInt(searchParams.get('limit') || '20'),
        search: searchParams.get('search') || '',
        sortBy: searchParams.get('sortBy') || 'createdAt',
        sortOrder: searchParams.get('sortOrder') || 'desc',
        parentId: searchParams.get('parentId') || undefined,
        status: searchParams.get('status') || undefined,
      };

      // 构建查询条件
      const where: any = {};

      if (queryParams.status && queryParams.status !== 'all') {
        where.status = queryParams.status;
      }

      if (queryParams.search) {
        where.OR = [
          { name: { contains: queryParams.search } },
          { code: { contains: queryParams.search } },
        ];
      }

      if (queryParams.parentId) {
        where.parentId = queryParams.parentId;
      }

      // 计算偏移量
      const skip = (queryParams.page - 1) * queryParams.limit;

      // 执行查询
      const [categories, total] = await Promise.all([
        prisma.category.findMany({
          where,
          skip,
          take: queryParams.limit,
          orderBy: {
            [queryParams.sortBy]: queryParams.sortOrder,
          },
          select: {
            id: true,
            name: true,
            code: true,
            description: true,
            parentId: true,
            sortOrder: true,
            status: true,
            createdAt: true,
            updatedAt: true,
            parent: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
            _count: {
              select: {
                products: true,
              },
            },
          },
        }),
        prisma.category.count({ where }),
      ]);

      // 计算分页信息
      const totalPages = Math.ceil(total / queryParams.limit);

      return NextResponse.json({
        success: true,
        data: categories,
        pagination: {
          page: queryParams.page,
          limit: queryParams.limit,
          total,
          totalPages,
        },
        performance: {
          queryTime: Date.now(),
          recordCount: categories.length,
          totalRecords: total,
        },
      });
    } catch (error) {
      console.error('Performance test API error:', error);
      return NextResponse.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    }
  },
  { permissions: ['categories:view'] }
);

/**
 * POST /api/performance/categories - 性能测试专用创建分类
 */
export const POST = withAuth(
  async (request: NextRequest) => {
    try {
      const body = await request.json();

      // 简单的数据验证
      if (!body.name) {
        return NextResponse.json(
          {
            success: false,
            error: 'Name is required',
          },
          { status: 400 }
        );
      }

      // 生成唯一编码
      const code =
        body.code ||
        `PERF_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // 检查编码唯一性
      const existingCategory = await prisma.category.findUnique({
        where: { code },
      });

      if (existingCategory) {
        return NextResponse.json(
          {
            success: false,
            error: '分类编码已存在',
          },
          { status: 400 }
        );
      }

      // 创建分类
      const category = await prisma.category.create({
        data: {
          name: body.name,
          code,
          description: body.description || null,
          parentId: body.parentId || null,
          sortOrder: body.sortOrder || 0,
          status: body.status || 'active',
        },
        include: {
          parent: true,
          children: true,
          _count: {
            select: {
              products: true,
            },
          },
        },
      });

      return NextResponse.json(
        {
          success: true,
          data: category,
          performance: {
            createdTime: Date.now(),
            operation: 'create',
          },
        },
        { status: 201 }
      );
    } catch (error) {
      console.error('Performance test POST error:', error);
      return NextResponse.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    }
  },
  { permissions: ['categories:create'] }
);
