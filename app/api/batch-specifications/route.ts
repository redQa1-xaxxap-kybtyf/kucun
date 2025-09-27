/**
 * 批次规格参数API路由
 * 提供批次规格参数的CRUD操作接口
 */

import { type NextRequest, NextResponse } from 'next/server';

import {
  getBatchSpecifications,
  upsertBatchSpecification,
  validateUserSession,
} from '@/lib/api/batch-specification-handlers';
import {
  createBatchSpecificationSchema,
  batchSpecificationQuerySchema,
} from '@/lib/validations/batch-specification';

/**
 * GET /api/batch-specifications
 * 获取批次规格参数列表
 */
export async function GET(request: NextRequest) {
  try {
    // 验证用户会话
    const session = await validateUserSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    // 解析查询参数
    const { searchParams } = new URL(request.url);
    const queryData = {
      page: parseInt(searchParams.get('page') || '1', 10),
      limit: parseInt(searchParams.get('limit') || '20', 10),
      search: searchParams.get('search') || undefined,
      productId: searchParams.get('productId') || undefined,
      batchNumber: searchParams.get('batchNumber') || undefined,
      sortBy: searchParams.get('sortBy') || 'createdAt',
      sortOrder: (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc',
    };

    // 验证查询参数
    const validatedQuery = batchSpecificationQuerySchema.parse(queryData);

    // 获取批次规格参数列表
    const result = await getBatchSpecifications(validatedQuery);

    return NextResponse.json(result);
  } catch (error) {
    console.error('获取批次规格参数列表失败:', error);

    if (error instanceof Error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: '获取批次规格参数列表失败' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/batch-specifications
 * 创建或更新批次规格参数
 */
export async function POST(request: NextRequest) {
  try {
    // 验证用户会话
    const session = await validateUserSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    // 解析请求体
    const body = await request.json();

    // 验证请求数据
    const validatedData = createBatchSpecificationSchema.parse(body);

    // 创建或更新批次规格参数
    const batchSpecification = await upsertBatchSpecification(validatedData);

    return NextResponse.json({
      success: true,
      data: batchSpecification,
      message: '批次规格参数保存成功',
    });
  } catch (error) {
    console.error('创建批次规格参数失败:', error);

    if (error instanceof Error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: '创建批次规格参数失败' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/batch-specifications
 * 批量更新批次规格参数
 */
export async function PUT(request: NextRequest) {
  try {
    // 验证用户会话
    const session = await validateUserSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    // 解析请求体
    const body = await request.json();
    const { specifications } = body;

    if (!Array.isArray(specifications) || specifications.length === 0) {
      return NextResponse.json(
        { success: false, error: '请提供要更新的批次规格参数列表' },
        { status: 400 }
      );
    }

    // 批量处理批次规格参数
    const results = [];
    for (const spec of specifications) {
      try {
        const validatedData = createBatchSpecificationSchema.parse(spec);
        const result = await upsertBatchSpecification(validatedData);
        results.push(result);
      } catch (error) {
        console.error(`处理批次规格参数失败:`, error);
        // 继续处理其他记录，不中断整个批量操作
      }
    }

    return NextResponse.json({
      success: true,
      data: results,
      message: `成功处理 ${results.length} 个批次规格参数`,
    });
  } catch (error) {
    console.error('批量更新批次规格参数失败:', error);

    if (error instanceof Error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: '批量更新批次规格参数失败' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/batch-specifications
 * 批量删除批次规格参数
 */
export async function DELETE(request: NextRequest) {
  try {
    // 验证用户会话
    const session = await validateUserSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    // 解析请求体
    const body = await request.json();
    const { ids } = body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { success: false, error: '请提供要删除的批次规格参数ID列表' },
        { status: 400 }
      );
    }

    // 批量删除批次规格参数
    const { deleteBatchSpecification } = await import(
      '@/lib/api/batch-specification-handlers'
    );

    let deletedCount = 0;
    const errors = [];

    for (const id of ids) {
      try {
        await deleteBatchSpecification(id);
        deletedCount++;
      } catch (error) {
        errors.push({
          id,
          error: error instanceof Error ? error.message : '删除失败',
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `成功删除 ${deletedCount} 个批次规格参数`,
      details: {
        deleted: deletedCount,
        errors: errors.length > 0 ? errors : undefined,
      },
    });
  } catch (error) {
    console.error('批量删除批次规格参数失败:', error);

    if (error instanceof Error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: '批量删除批次规格参数失败' },
      { status: 500 }
    );
  }
}
