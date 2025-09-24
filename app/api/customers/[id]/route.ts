import { getServerSession } from 'next-auth';
import { NextResponse, type NextRequest } from 'next/server';

import {
  deleteCustomer,
  getCustomerDetail,
  updateCustomer,
  validateUserSession,
} from '@/lib/api/customer-handlers';
import { authOptions } from '@/lib/auth';
import { extractRequestInfo } from '@/lib/logger';
import { customerUpdateSchema } from '@/lib/validations/customer';

/**
 * 获取单个客户信息
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 验证用户会话
    await validateUserSession();

    // 获取客户详情
    const customer = await getCustomerDetail(params.id);

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
          error instanceof Error &&
          (error.message === '未授权访问'
            ? 401
            : error.message === '客户不存在'
              ? 404
              : 500),
      }
    );
  }
}

/**
 * 更新客户信息
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 验证用户会话
    await validateUserSession();

    const body = await request.json();

    // 验证输入数据
    const validationResult = customerUpdateSchema.safeParse({
      id: params.id,
      ...body,
    });

    if (!validationResult.success) {
      return NextResponse.json(
        { error: '输入数据无效', details: validationResult.error.errors },
        { status: 400 }
      );
    }

    // 获取用户会话信息
    const session = await getServerSession(authOptions);
    const requestInfo = extractRequestInfo(request);

    // 更新客户
    const customer = await updateCustomer(
      params.id,
      validationResult.data,
      session?.user?.id,
      requestInfo.ipAddress,
      requestInfo.userAgent
    );

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
          error instanceof Error &&
          (error.message === '未授权访问'
            ? 401
            : error.message === '客户不存在'
              ? 404
              : 500),
      }
    );
  }
}

/**
 * 删除客户
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 验证用户会话
    await validateUserSession();

    // 获取用户会话信息
    const session = await getServerSession(authOptions);
    const requestInfo = extractRequestInfo(request);

    // 删除客户
    await deleteCustomer(
      params.id,
      session?.user?.id,
      requestInfo.ipAddress,
      requestInfo.userAgent
    );

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
          error instanceof Error &&
          (error.message === '未授权访问'
            ? 401
            : error.message === '客户不存在'
              ? 404
              : 500),
      }
    );
  }
}
