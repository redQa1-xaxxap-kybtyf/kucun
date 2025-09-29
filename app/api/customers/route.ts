import { NextResponse, type NextRequest } from 'next/server';

import {
  createCustomer,
  getCustomerList,
  validateUserSession,
} from '@/lib/api/customer-handlers';
import { paginationValidations } from '@/lib/validations/base';
import { customerCreateSchema } from '@/lib/validations/customer';

/**
 * 获取客户列表
 */
export async function GET(request: NextRequest) {
  try {
    // 验证用户会话
    await validateUserSession();

    const { searchParams } = new URL(request.url);

    // 验证分页参数
    const paginationResult = paginationValidations.query.safeParse({
      page: searchParams.get('page'),
      limit: searchParams.get('limit'),
    });

    if (!paginationResult.success) {
      return NextResponse.json(
        { error: '分页参数无效', details: paginationResult.error.errors },
        { status: 400 }
      );
    }

    const { page, limit } = paginationResult.data;
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
  } catch (error) {
    console.error('获取客户列表失败:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : '获取客户列表失败，请稍后重试',
      },
      {
        status:
          error instanceof Error && error.message === '未授权访问' ? 401 : 500,
      }
    );
  }
}

/**
 * 创建客户
 */
export async function POST(request: NextRequest) {
  try {
    // 验证用户会话
    await validateUserSession();

    const body = await request.json();

    // 验证输入数据
    const validationResult = customerCreateSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: '输入数据无效', details: validationResult.error.errors },
        { status: 400 }
      );
    }

    // 创建客户
    const customer = await createCustomer(validationResult.data);

    return NextResponse.json({
      success: true,
      data: customer,
    });
  } catch (error) {
    console.error('创建客户失败:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : '创建客户失败，请稍后重试',
      },
      {
        status:
          error instanceof Error && error.message === '未授权访问' ? 401 : 500,
      }
    );
  }
}
