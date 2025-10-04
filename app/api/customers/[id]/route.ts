import { NextResponse, type NextRequest } from 'next/server';

import {
  deleteCustomer,
  getCustomerDetail,
  updateCustomer,
} from '@/lib/api/customer-handlers';
import { resolveParams, withErrorHandling } from '@/lib/api/middleware';
import { withAuth } from '@/lib/auth/api-helpers';
import { customerUpdateSchema } from '@/lib/validations/customer';

/**
 * 获取单个客户信息
 */
export const GET = withAuth(
  withErrorHandling(
    async (
      _request: NextRequest,
      context: {
        params?: Promise<Record<string, string>> | Record<string, string>;
      }
    ) => {
      // 获取客户详情
      const { id } = await resolveParams(context.params);
      const customer = await getCustomerDetail(id);

      return NextResponse.json({
        success: true,
        data: customer,
      });
    }
  ),
  { permissions: ['customers:view'] }
);

/**
 * 更新客户信息
 */
export const PUT = withAuth(
  withErrorHandling(
    async (
      request: NextRequest,
      context: {
        params?: Promise<Record<string, string>> | Record<string, string>;
      }
    ) => {
      const body = await request.json();

      // 获取参数
      const { id } = await resolveParams(context.params);

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
  ),
  { permissions: ['customers:edit'] }
);

/**
 * 删除客户
 */
export const DELETE = withAuth(
  withErrorHandling(
    async (
      _request: NextRequest,
      context: {
        params?: Promise<Record<string, string>> | Record<string, string>;
      }
    ) => {
      // 获取参数并删除客户
      const { id } = await resolveParams(context.params);
      await deleteCustomer(id);

      return NextResponse.json({
        success: true,
        message: '客户删除成功',
      });
    }
  ),
  { permissions: ['customers:delete'] }
);
