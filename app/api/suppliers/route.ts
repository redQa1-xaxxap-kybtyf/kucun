/**
 * 供应商管理 API 路由
 * 职责:
 * - 身份认证和授权检查（使用新的声明式权限系统）
 * - 请求参数验证
 * - 调用服务层业务逻辑
 * - 数据序列化和 HTTP 响应格式化
 * - 错误处理和统一响应格式
 */

import { NextResponse, type NextRequest } from 'next/server';

import { ApiError } from '@/lib/api/errors';
import { withErrorHandling } from '@/lib/api/middleware';
import { successResponse, withAuth } from '@/lib/auth/api-helpers';
import { createSupplier, getSuppliers } from '@/lib/services/supplier-service';
import {
  CreateSupplierSchema,
  SupplierQuerySchema,
} from '@/lib/validations/supplier';

/**
 * GET /api/suppliers - 获取供应商列表
 */
export const GET = withAuth(
  withErrorHandling(async (request: NextRequest) => {
    // 解析查询参数
    const { searchParams } = new URL(request.url);
    const queryParams = Object.fromEntries(searchParams.entries());

    // 验证参数
    const validatedParams = SupplierQuerySchema.parse(queryParams);

    // 调用服务层
    const result = await getSuppliers(validatedParams);

    // 返回响应
    return NextResponse.json({
      success: true,
      data: result.suppliers,
      pagination: result.pagination,
    });
  }),
  { permissions: ['suppliers:view'] }
);

/**
 * POST /api/suppliers - 创建新供应商
 */
export const POST = withAuth(
  withErrorHandling(async (request: NextRequest) => {
    // 解析请求体
    const body = await request.json();

    // 验证数据
    const validatedData = CreateSupplierSchema.parse(body);

    // 调用服务层
    try {
      const supplier = await createSupplier(validatedData);

      // 返回响应
      return NextResponse.json({
        success: true,
        data: supplier,
        message: '供应商创建成功',
      });
    } catch (error) {
      // 将服务层错误转换为 API 错误
      if (error instanceof Error) {
        throw ApiError.badRequest(error.message);
      }
      throw error;
    }
  }),
  { permissions: ['suppliers:create'] }
);
