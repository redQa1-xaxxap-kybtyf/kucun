/**
 * 分类管理 API 路由
 * 职责:
 * - 身份认证和授权检查
 * - 请求参数验证
 * - 调用服务层业务逻辑
 * - 数据序列化和 HTTP 响应格式化
 * - 错误处理和统一响应格式
 */

import { NextResponse, type NextRequest } from 'next/server';

import { ApiError } from '@/lib/api/errors';
import { withErrorHandling } from '@/lib/api/middleware';
import { withAuth } from '@/lib/auth/api-helpers';
import { paginationConfig } from '@/lib/env';
import { createCategory, getCategories } from '@/lib/services/category-service';
import {
  CategoryQuerySchema,
  CreateCategorySchema,
} from '@/lib/validations/category';

/**
 * 实际处理分类列表查询的函数（不做认证）
 */
async function handleGetCategories(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  // 1. 解析查询参数
  const queryParams = {
    page: parseInt(searchParams.get('page') || '1'),
    limit: parseInt(
      searchParams.get('limit') || paginationConfig.defaultPageSize.toString()
    ),
    search: searchParams.get('search') || '',
    sortBy: searchParams.get('sortBy') || 'createdAt',
    sortOrder: searchParams.get('sortOrder') || 'desc',
    parentId: searchParams.get('parentId') || undefined,
    status: searchParams.get('status') || undefined,
  };

  // 2. 验证查询参数（Zod 错误会自动处理）
  const validatedParams = CategoryQuerySchema.parse(queryParams);

  // 3. 调用服务层
  const result = await getCategories(validatedParams);

  // 4. 返回响应
  return NextResponse.json({
    success: true,
    data: result.categories,
    pagination: result.pagination,
  });
}

/**
 * GET /api/categories - 获取分类列表
 *
 * - 小程序游客（x-client-from=mini-program）直接访问
 * - 其他客户端仍需 categories:view 权限
 */
export const GET = async (request: NextRequest) => {
  const clientFrom = request.headers.get('x-client-from');

  if (clientFrom === 'mini-program') {
    return withErrorHandling(handleGetCategories)(request, {});
  }

  const authedGet = withAuth(
    async (req: NextRequest) => withErrorHandling(handleGetCategories)(req, {}),
    { permissions: ['categories:view'] }
  );

  return authedGet(request);
};

/**
 * POST /api/categories - 创建分类
 */
export const POST = withAuth(
  async (request: NextRequest) =>
    withErrorHandling(async request => {
      // 1. 解析请求体
      const body = await request.json();

      // 2. 验证请求数据（Zod 错误会自动处理）
      const validatedData = CreateCategorySchema.parse(body);

      // 3. 调用服务层
      try {
        const category = await createCategory(validatedData);

        // 4. 返回响应（201 Created）
        return NextResponse.json(
          {
            success: true,
            data: category,
          },
          { status: 201 }
        );
      } catch (error) {
        // 将服务层错误转换为 API 错误
        if (error instanceof Error) {
          throw ApiError.badRequest(error.message);
        }
        throw error;
      }
    })(request, {}),
  { permissions: ['categories:create'] }
);
