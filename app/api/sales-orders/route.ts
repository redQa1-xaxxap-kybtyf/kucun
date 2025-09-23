import {
  createSalesOrder,
  getSalesOrders,
  salesOrderQuerySchema,
} from '@/lib/api/handlers/sales-orders';
import { withAuth, withErrorHandling } from '@/lib/api/middleware';
import { successResponse, validationErrorResponse } from '@/lib/api/response';
import { salesOrderCreateSchema } from '@/lib/validations/sales-order';

/**
 * 获取销售订单列表
 */
export const GET = withErrorHandling(
  withAuth(async (request, _context, _session) => {
    const { searchParams } = new URL(request.url);
    const rawParams = {
      page: searchParams.get('page'),
      limit: searchParams.get('limit'),
      search: searchParams.get('search'),
      sortBy: searchParams.get('sortBy'),
      sortOrder: searchParams.get('sortOrder'),
      status: searchParams.get('status'),
      customerId: searchParams.get('customerId'),
      startDate: searchParams.get('startDate'),
      endDate: searchParams.get('endDate'),
    };

    // 验证查询参数
    const validationResult = salesOrderQuerySchema.safeParse(rawParams);
    if (!validationResult.success) {
      return validationErrorResponse(
        '查询参数格式不正确',
        validationResult.error.errors
      );
    }

    const result = await getSalesOrders(validationResult.data);
    return successResponse(result);
  })
);
/**
 * 创建销售订单
 */
export const POST = withErrorHandling(
  withAuth(async (request, _context, session) => {
    const body = await request.json();

    // 验证请求数据
    const validationResult = salesOrderCreateSchema.safeParse(body);
    if (!validationResult.success) {
      return validationErrorResponse(
        '订单数据格式不正确',
        validationResult.error.errors
      );
    }

    const order = await createSalesOrder(
      validationResult.data,
      session.user.id
    );
    return successResponse(order, 201, '销售订单创建成功');
  })
);
