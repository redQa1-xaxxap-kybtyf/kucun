/**
 * 单个批次规格参数API路由
 * 提供特定批次规格参数的详情查询、更新和删除操作
 */

import { type NextRequest, NextResponse } from 'next/server';

import {
  getBatchSpecificationById,
  updateBatchSpecification,
  deleteBatchSpecification,
  validateUserSession,
} from '@/lib/api/batch-specification-handlers';
import {
  updateBatchSpecificationSchema,
  batchSpecificationIdSchema,
} from '@/lib/validations/batch-specification';

/**
 * GET /api/batch-specifications/[id]
 * 获取批次规格参数详情
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 验证用户会话
    const session = await validateUserSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    // 验证批次规格参数ID
    const validatedId = batchSpecificationIdSchema.parse(params.id);

    // 获取批次规格参数详情
    const batchSpecification = await getBatchSpecificationById(validatedId);

    return NextResponse.json({
      success: true,
      data: batchSpecification,
    });
  } catch (error) {
    console.error('获取批次规格参数详情失败:', error);

    if (error instanceof Error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.message.includes('不存在') ? 404 : 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: '获取批次规格参数详情失败' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/batch-specifications/[id]
 * 更新批次规格参数
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 验证用户会话
    const session = await validateUserSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    // 验证批次规格参数ID
    const validatedId = batchSpecificationIdSchema.parse(params.id);

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
  } catch (error) {
    console.error('更新批次规格参数失败:', error);

    if (error instanceof Error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.message.includes('不存在') ? 404 : 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: '更新批次规格参数失败' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/batch-specifications/[id]
 * 删除批次规格参数
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 验证用户会话
    const session = await validateUserSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    // 验证批次规格参数ID
    const validatedId = batchSpecificationIdSchema.parse(params.id);

    // 删除批次规格参数
    await deleteBatchSpecification(validatedId);

    return NextResponse.json({
      success: true,
      message: '批次规格参数删除成功',
    });
  } catch (error) {
    console.error('删除批次规格参数失败:', error);

    if (error instanceof Error) {
      return NextResponse.json(
        { success: false, error: error.message },
        {
          status: error.message.includes('不存在')
            ? 404
            : error.message.includes('已被')
              ? 409
              : 400,
        }
      );
    }

    return NextResponse.json(
      { success: false, error: '删除批次规格参数失败' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/batch-specifications/[id]
 * 部分更新批次规格参数
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 验证用户会话
    const session = await validateUserSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    // 验证批次规格参数ID
    const validatedId = batchSpecificationIdSchema.parse(params.id);

    // 解析请求体
    const body = await request.json();

    // 验证部分更新数据
    const validatedData = updateBatchSpecificationSchema.partial().parse(body);

    // 检查是否有有效的更新字段
    const hasValidFields = Object.keys(validatedData).some(
      key => validatedData[key as keyof typeof validatedData] !== undefined
    );

    if (!hasValidFields) {
      return NextResponse.json(
        { success: false, error: '请提供要更新的字段' },
        { status: 400 }
      );
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
  } catch (error) {
    console.error('部分更新批次规格参数失败:', error);

    if (error instanceof Error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.message.includes('不存在') ? 404 : 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: '部分更新批次规格参数失败' },
      { status: 500 }
    );
  }
}
