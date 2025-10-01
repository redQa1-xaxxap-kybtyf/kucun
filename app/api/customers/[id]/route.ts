import { NextResponse, type NextRequest } from 'next/server';

import {
  deleteCustomer,
  getCustomerDetail,
  updateCustomer,
  validateUserSession,
} from '@/lib/api/customer-handlers';
import { withErrorHandling } from '@/lib/api/middleware';
import { customerUpdateSchema } from '@/lib/validations/customer';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * 获取单个客户信息
 */
export const GET = withErrorHandling(
  async (request: NextRequest, { params }: RouteContext) => {
    // 验证用户会话
    await validateUserSession();

    // 获取客户详情
    const { id } = await params;
    const customer = await getCustomerDetail(id);

    return NextResponse.json({
      success: true,
      data: customer,
    });
  }
);

/**
 * 更新客户信息
 */
export const PUT = withErrorHandling(
  async (request: NextRequest, { params }: RouteContext) => {
    // 验证用户会话
    await validateUserSession();

    const body = await request.json();

    // 获取参数
    const { id } = await params;

    // 验证输入数据
    const validatedData = customerUpdateSchema.parse({
      id,
      ...body,
    });

    // 更新客户
    const customer = await updateCustomer(id, validatedData);

    return NextResponse.json({
      success: true,
      data: customer,
    });
  }
);

/**
 * 删除客户
 */
export const DELETE = withErrorHandling(
  async (request: NextRequest, { params }: RouteContext) => {
    // 验证用户会话
    await validateUserSession();

    // 获取参数并删除客户
    const { id } = await params;
    await deleteCustomer(id);

    return NextResponse.json({
      success: true,
      message: '客户删除成功',
    });
  }
);
