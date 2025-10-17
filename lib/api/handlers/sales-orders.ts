import type {
  SalesOrderQueryParams as StandardSalesOrderQueryParams,
} from '@/lib/types/sales-order';
import { salesOrderQuerySchema as standardSalesOrderQuerySchema } from '@/lib/validations/sales-order';

export const salesOrderQuerySchema = standardSalesOrderQuerySchema;
export type SalesOrderQueryParams = StandardSalesOrderQueryParams;

export { getSalesOrders } from './sales-orders/list';
export { getSalesOrderById } from './sales-orders/detail';
export { createSalesOrder } from './sales-orders/create';
