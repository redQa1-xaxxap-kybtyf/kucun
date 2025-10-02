/**
 * 单个批次规格参数API路由
 * 提供特定批次规格参数的详情查询、更新和删除操作
 */

import { type NextRequest, NextResponse } from 'next/server';

import {
    deleteBatchSpecification,
    getBatchSpecificationById,
    updateBatchSpecification,
    validateUserSession,
} from '@/lib/api/batch-specification-handlers';
import { ApiError } from '@/lib/api/errors';
import { resolveParams, withErrorHandling } from '@/lib/api/middleware';
import {
    batchSpecificationIdSchema,
    updateBatchSpecificationSchema,
} from '@/lib/validations/batch-specification';

/**
 * GET /api/batch-specifications/[id]
 * 获取批次规格参数详情
 */
export const GET = withErrorHandling(
  async (
    _request: NextRequest,
    context: { params?: Promise<{ id: string }> | { id: string } }
  ) => {
    // 验证用户会话
    const session = await validateUserSession();
    if (!session) {
      throw ApiError.unauthorized();
    }

    // 验证批次规格参数ID
    const { id } = await resolveParams(context.params);
    const validatedId = batchSpecificationIdSchema.parse(id);

    // 获取批次规格参数详情
    const batchSpecification = await getBatchSpecificationById(validatedId);

    return NextResponse.json({
      success: true,
      data: batchSpecification,
    });
  }
);

/**
 * PUT /api/batch-specifications/[id]
 * 更新批次规格参数
 */
export const PUT = withErrorHandling(
  async (
    request: NextRequest,
    context: { params?: Promise<{ id: string }> | { id: string } }
  ) => {
    // 验证用户会话
    const session = await validateUserSession();
    if (!session) {
      throw ApiError.unauthorized();
    }

    // 验证批次规格参数ID
    const { id } = await resolveParams(context.params);
    const validatedId = batchSpecificationIdSchema.parse(id);

    // 解析请求体
    const body = await request.json();

    // 验证更新数据
    const validatedData = updateBatchSpecificationSchema.parse(body);

    // 更新批次规格参数
    const updatedBatchSpecification = await updateBatchSpecification(
      validatedId,
      validatedData
    );

    return NextResponse.json({
      success: true,
      data: updatedBatchSpecification,
      message: '批次规格参数更新成功',
    });
  }
);

/**
 * DELETE /api/batch-specifications/[id]
 * 删除批次规格参数
 */
export const DELETE = withErrorHandling(
  async (
    _request: NextRequest,
    context: { params?: Promise<{ id: string }> | { id: string } }
  ) => {
    // 验证用户会话
    const session = await validateUserSession();
    if (!session) {
      throw ApiError.unauthorized();
    }

    // 验证批次规格参数ID
    const { id } = await resolveParams(context.params);
    const validatedId = batchSpecificationIdSchema.parse(id);

    // 删除批次规格参数
    await deleteBatchSpecification(validatedId);

    return NextResponse.json({
      success: true,
      message: '批次规格参数删除成功',
    });
  }
);

/**
 * PATCH /api/batch-specifications/[id]
 * 部分更新批次规格参数
 */
export const PATCH = withErrorHandling(
  async (
    request: NextRequest,
    context: { params?: Promise<{ id: string }> | { id: string } }
  ) => {
    // 验证用户会话
    const session = await validateUserSession();
    if (!session) {
      throw ApiError.unauthorized();
    }

    // 验证批次规格参数ID
    const { id } = await resolveParams(context.params);
    const validatedId = batchSpecificationIdSchema.parse(id);

    // 解析请求体
    const body = await request.json();

    // 验证部分更新数据
    const validatedData = updateBatchSpecificationSchema.partial().parse(body);

    // 检查是否有有效的更新字段
    const hasValidFields = Object.keys(validatedData).some(
      key => validatedData[key as keyof typeof validatedData] !== undefined
    );

    if (!hasValidFields) {
      throw ApiError.badRequest('请提供要更新的字段');
    }

    // 更新批次规格参数
    const updatedBatchSpecification = await updateBatchSpecification(
      validatedId,
      validatedData
    );

    return NextResponse.json({
      success: true,
      data: updatedBatchSpecification,
      message: '批次规格参数部分更新成功',
    });
  }
);
