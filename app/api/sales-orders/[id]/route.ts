import {
  getSalesOrderRoute,
  putSalesOrderRoute,
  patchSalesOrderRoute,
  deleteSalesOrderRoute,
} from '@/lib/api/routes/sales-orders-id';
import { withAuth } from '@/lib/auth/api-helpers';

// 将复杂实现下沉至 lib 层，保持路由文件精简
export const GET = withAuth(getSalesOrderRoute);
export const PUT = withAuth(putSalesOrderRoute, {
  permissions: ['orders:edit'],
});
export const PATCH = withAuth(patchSalesOrderRoute, {
  permissions: ['orders:edit'],
});
export const DELETE = withAuth(deleteSalesOrderRoute, {
  permissions: ['orders:edit'],
});
