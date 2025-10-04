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

import { withAuth } from '@/lib/auth/api-helpers';
import { ApiError } from '@/lib/api/errors';
import { withErrorHandling } from '@/lib/api/middleware';
import { paginationConfig } from '@/lib/env';
import { createCategory, getCategories } from '@/lib/services/category-service';
import {
  CategoryQuerySchema,
  CreateCategorySchema,
} from '@/lib/validations/category';

/**
 * GET /api/categories - 获取分类列表
 */
export const GET = withAuth(
  async (request: NextRequest, { user }) => {
    return withErrorHandling(async request => {
      const { searchParams } = new URL(request.url);

      // 1. 解析查询参数
      const queryParams = {
        page: parseInt(searchParams.get('page') || '1'),
        limit: parseInt(
          searchParams.get('limit') ||
            paginationConfig.defaultPageSize.toString()
        ),
        search: searchParams.get('search') || '',
        sortBy: searchParams.get('sortBy') || 'createdAt',
        sortOrder: searchParams.get('sortOrder') || 'desc',
        parentId: searchParams.get('parentId') || undefined,
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
    })(request, {});
  },
  { permissions: ['categories:view'] }
);

/**
 * POST /api/categories - 创建分类
 */
export const POST = withAuth(
  async (request: NextRequest, { user }) => {
    return withErrorHandling(async request => {
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
    })(request, {});
  },
  { permissions: ['categories:create'] }
);
