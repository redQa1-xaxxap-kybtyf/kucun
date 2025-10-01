import { NextResponse, type NextRequest } from 'next/server';

import {
  createCustomer,
  getCustomerList,
  validateUserSession,
} from '@/lib/api/customer-handlers';
import { withErrorHandling } from '@/lib/api/middleware';
import { paginationValidations } from '@/lib/validations/base';
import { customerCreateSchema } from '@/lib/validations/customer';

/**
 * 获取客户列表
 */
export const GET = withErrorHandling(async (request: NextRequest) => {
  // 验证用户会话
  await validateUserSession();

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
  const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc';
  const parentCustomerId = searchParams.get('parentCustomerId') || undefined;

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
});

/**
 * 创建客户
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  // 验证用户会话
  await validateUserSession();

  const body = await request.json();

  // 验证输入数据
  const validatedData = customerCreateSchema.parse(body);

  // 创建客户
  const customer = await createCustomer(validatedData);

  return NextResponse.json({
    success: true,
    data: customer,
  });
});
