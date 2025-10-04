import { NextResponse, type NextRequest } from 'next/server';

import { createCustomer, getCustomerList } from '@/lib/api/customer-handlers';
import { withAuth } from '@/lib/auth/api-helpers';
import { withErrorHandling } from '@/lib/api/middleware';
import { paginationValidations } from '@/lib/validations/base';
import { customerCreateSchema } from '@/lib/validations/customer';

/**
 * 获取客户列表
 */
export const GET = withAuth(
  async (request: NextRequest, { user }) => {
    return withErrorHandling(async request => {
      const { searchParams } = new URL(request.url);

      // 验证分页参数
      const { page, limit } = paginationValidations.query.parse({
        page: searchParams.get('page'),
        limit: searchParams.get('limit'),
      });

      const search = searchParams.get('search') || '';
      const sortBy = (searchParams.get('sortBy') || 'createdAt') as
        | 'name'
        | 'createdAt'
        | 'updatedAt'
        | 'totalOrders'
        | 'totalAmount'
        | 'transactionCount'
        | 'cooperationDays'
        | 'returnOrderCount';
      const sortOrder = (searchParams.get('sortOrder') || 'desc') as
        | 'asc'
        | 'desc';
      const parentCustomerId =
        searchParams.get('parentCustomerId') || undefined;

      // 构建查询参数
      const queryParams = {
        page,
        limit,
        search,
        sortBy,
        sortOrder,
        parentCustomerId,
      };

      // 获取客户列表
      const result = await getCustomerList(queryParams);

      return NextResponse.json({
        success: true,
        ...result,
      });
    })(request, {});
  },
  { permissions: ['customers:view'] }
);

/**
 * 创建客户
 */
export const POST = withAuth(
  async (request: NextRequest, { user }) => {
    return withErrorHandling(async request => {
      const body = await request.json();

      // 验证输入数据
      const validatedData = customerCreateSchema.parse(body);

      // 创建客户
      const customer = await createCustomer(validatedData);

      return NextResponse.json({
        success: true,
        data: customer,
      });
    })(request, {});
  },
  { permissions: ['customers:create'] }
);
