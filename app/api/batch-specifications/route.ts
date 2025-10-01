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
import { ApiError } from '@/lib/api/errors';
import { withErrorHandling } from '@/lib/api/middleware';
import {
  batchSpecificationQuerySchema,
  createBatchSpecificationSchema,
} from '@/lib/validations/batch-specification';

/**
 * 解析查询参数
 */
function parseQueryParams(url: string) {
  const { searchParams } = new URL(url);
  return {
    page: parseInt(searchParams.get('page') || '1', 10),
    limit: parseInt(searchParams.get('limit') || '20', 10),
    search: searchParams.get('search') || undefined,
    productId: searchParams.get('productId') || undefined,
    batchNumber: searchParams.get('batchNumber') || undefined,
    sortBy: searchParams.get('sortBy') || 'createdAt',
    sortOrder: (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc',
  };
}

/**
 * GET /api/batch-specifications
 * 获取批次规格参数列表
 */
export const GET = withErrorHandling(async (request: NextRequest) => {
  // 验证用户会话
  const session = await validateUserSession();
  if (!session) {
    throw ApiError.unauthorized();
  }

  // 解析查询参数
  const queryData = parseQueryParams(request.url);

  // 验证查询参数
  const validatedQuery = batchSpecificationQuerySchema.parse(queryData);

  // 获取批次规格参数列表
  const result = await getBatchSpecifications(validatedQuery);

  return NextResponse.json(result);
});

/**
 * POST /api/batch-specifications
 * 创建或更新批次规格参数
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  // 验证用户会话
  const session = await validateUserSession();
  if (!session) {
    throw ApiError.unauthorized();
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
});

/**
 * 批量处理批次规格参数
 */
async function processBatchSpecifications(specifications: unknown[]) {
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
  return results;
}

/**
 * PUT /api/batch-specifications
 * 批量更新批次规格参数
 */
export const PUT = withErrorHandling(async (request: NextRequest) => {
  // 验证用户会话
  const session = await validateUserSession();
  if (!session) {
    throw ApiError.unauthorized();
  }

  // 解析请求体
  const body = await request.json();
  const { specifications } = body;

  if (!Array.isArray(specifications) || specifications.length === 0) {
    throw ApiError.badRequest('请提供要更新的批次规格参数列表');
  }

  // 批量处理批次规格参数
  const results = await processBatchSpecifications(specifications);

  return NextResponse.json({
    success: true,
    data: results,
    message: `成功处理 ${results.length} 个批次规格参数`,
  });
});

/**
 * 批量删除批次规格参数
 */
async function deleteBatchSpecifications(ids: string[]) {
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

  return { deletedCount, errors };
}

/**
 * DELETE /api/batch-specifications
 * 批量删除批次规格参数
 */
export const DELETE = withErrorHandling(async (request: NextRequest) => {
  // 验证用户会话
  const session = await validateUserSession();
  if (!session) {
    throw ApiError.unauthorized();
  }

  // 解析请求体
  const body = await request.json();
  const { ids } = body;

  if (!Array.isArray(ids) || ids.length === 0) {
    throw ApiError.badRequest('请提供要删除的批次规格参数ID列表');
  }

  // 批量删除批次规格参数
  const { deletedCount, errors } = await deleteBatchSpecifications(ids);

  return NextResponse.json({
    success: true,
    message: `成功删除 ${deletedCount} 个批次规格参数`,
    details: {
      deleted: deletedCount,
      errors: errors.length > 0 ? errors : undefined,
    },
  });
});
