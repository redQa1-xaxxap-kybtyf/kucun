import { NextResponse, type NextRequest } from 'next/server';

import {
  deleteCustomer,
  getCustomerDetail,
  updateCustomer,
  validateUserSession,
} from '@/lib/api/customer-handlers';
import { customerUpdateSchema } from '@/lib/validations/customer';

/**
 * 获取单个客户信息
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 验证用户会话
    await validateUserSession();

    // 获取客户详情
    const { id } = await params;
    const customer = await getCustomerDetail(id);

    return NextResponse.json({
      success: true,
      data: customer,
    });
  } catch (error) {
    console.error('获取客户详情失败:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : '获取客户详情失败，请稍后重试',
      },
      {
        status:
          error instanceof Error
            ? error.message === '未授权访问'
              ? 401
              : error.message === '客户不存在'
                ? 404
                : 500
            : 500,
      }
    );
  }
}

/**
 * 更新客户信息
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 验证用户会话
    await validateUserSession();

    const body = await request.json();

    // 获取参数
    const { id } = await params;

    // 验证输入数据
    const validationResult = customerUpdateSchema.safeParse({
      id,
      ...body,
    });

    if (!validationResult.success) {
      return NextResponse.json(
        { error: '输入数据无效', details: validationResult.error.errors },
        { status: 400 }
      );
    }

    // 更新客户
    const customer = await updateCustomer(id, validationResult.data);

    return NextResponse.json({
      success: true,
      data: customer,
    });
  } catch (error) {
    console.error('更新客户失败:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : '更新客户失败，请稍后重试',
      },
      {
        status:
          error instanceof Error
            ? error.message === '未授权访问'
              ? 401
              : error.message === '客户不存在'
                ? 404
                : 500
            : 500,
      }
    );
  }
}

/**
 * 删除客户
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 验证用户会话
    await validateUserSession();

    // 获取参数并删除客户
    const { id } = await params;
    await deleteCustomer(id);

    return NextResponse.json({
      success: true,
      message: '客户删除成功',
    });
  } catch (error) {
    console.error('删除客户失败:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : '删除客户失败，请稍后重试',
      },
      {
        status:
          error instanceof Error
            ? error.message === '未授权访问'
              ? 401
              : error.message === '客户不存在'
                ? 404
                : 500
            : 500,
      }
    );
  }
}
