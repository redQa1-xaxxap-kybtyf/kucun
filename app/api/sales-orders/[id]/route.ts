import { withErrorHandling } from '@/lib/api/middleware';
import {
  getSalesOrderRoute,
  patchSalesOrderRoute,
  putSalesOrderRoute,
  deleteSalesOrderRoute,
} from '@/lib/api/routes/sales-orders-id';
import { withAuth } from '@/lib/auth/api-helpers';
import { RateLimitType, withRateLimit } from '@/lib/rate-limit';

// 单个销售订单详情
const getHandler = withErrorHandling(
  withAuth(getSalesOrderRoute, { permissions: ['sales:view'] })
);
export const GET = withRateLimit(RateLimitType.READ)(getHandler);

// 更新订单状态（确认、发货、完成、取消）
const putHandler = withErrorHandling(
  withAuth(putSalesOrderRoute, { permissions: ['sales:manage'] })
);
export const PUT = withRateLimit(RateLimitType.WRITE)(putHandler);

// 更新草稿订单
const patchHandler = withErrorHandling(
  withAuth(patchSalesOrderRoute, { permissions: ['sales:manage'] })
);
export const PATCH = withRateLimit(RateLimitType.WRITE)(patchHandler);

// 删除订单
const deleteHandler = withErrorHandling(
  withAuth(deleteSalesOrderRoute, { permissions: ['sales:manage'] })
);
export const DELETE = withRateLimit(RateLimitType.WRITE)(deleteHandler);
