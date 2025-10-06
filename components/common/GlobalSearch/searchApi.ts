/**
 * 全局搜索 API 调用函数
 * 遵循全栈项目统一约定规范
 */

import { z } from 'zod';

// ============================================================================
// Zod Schema 定义
// ============================================================================

export const SearchResultSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  type: z.enum(['product', 'order', 'customer', 'document']),
  href: z.string(),
  metadata: z.record(z.unknown()).optional(),
});

export type SearchResultItem = z.infer<typeof SearchResultSchema>;

const SearchParamsSchema = z.object({
  query: z.string().min(1).max(100),
  limit: z.number().int().min(1).max(50).default(5),
});

// ============================================================================
// API 调用函数
// ============================================================================

/**
 * 搜索产品
 */
export async function searchProducts(
  query: string,
  signal?: AbortSignal
): Promise<SearchResultItem[]> {
  try {
    const params = SearchParamsSchema.parse({ query, limit: 5 });

    const response = await fetch(
      `/api/products/search?search=${encodeURIComponent(params.query)}&limit=${params.limit}`,
      { signal }
    );

    if (!response.ok) {
      throw new Error(`产品搜索失败: ${response.statusText}`);
    }

    const data = await response.json();

    return data.map(
      (product: {
        id: string;
        name: string;
        code: string;
        specification?: string;
        unit: string;
        inventory?: Array<{ quantity: number }>;
      }) => ({
        id: product.id,
        title: `${product.name} ${product.code}`,
        description: `规格: ${product.specification || '无'}, 库存: ${
          product.inventory?.reduce((sum, inv) => sum + inv.quantity, 0) || 0
        }${product.unit}`,
        type: 'product' as const,
        href: `/products/${product.id}`,
        metadata: {
          stock:
            product.inventory?.reduce((sum, inv) => sum + inv.quantity, 0) || 0,
        },
      })
    );
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return []; // 请求被取消,返回空数组
    }
    console.error('产品搜索失败:', error);
    throw error; // 抛出错误,由 TanStack Query 处理
  }
}

/**
 * 搜索订单
 */
export async function searchOrders(
  query: string,
  signal?: AbortSignal
): Promise<SearchResultItem[]> {
  try {
    const params = SearchParamsSchema.parse({ query, limit: 5 });

    const response = await fetch(
      `/api/sales-orders?search=${encodeURIComponent(params.query)}&limit=${params.limit}`,
      { signal }
    );

    if (!response.ok) {
      throw new Error(`订单搜索失败: ${response.statusText}`);
    }

    const data = await response.json();

    return (data.orders || []).map(
      (order: {
        id: string;
        orderNumber: string;
        customer: { name: string };
        totalAmount: number;
        status: string;
      }) => ({
        id: order.id,
        title: `销售订单 #${order.orderNumber}`,
        description: `客户: ${order.customer?.name || '未知'}, 金额: ¥${
          order.totalAmount?.toLocaleString() || '0'
        }`,
        type: 'order' as const,
        href: `/sales-orders/${order.id}`,
        metadata: { amount: order.totalAmount, status: order.status },
      })
    );
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return [];
    }
    console.error('订单搜索失败:', error);
    throw error;
  }
}

/**
 * 搜索客户
 */
export async function searchCustomers(
  query: string,
  signal?: AbortSignal
): Promise<SearchResultItem[]> {
  try {
    const params = SearchParamsSchema.parse({ query, limit: 5 });

    const response = await fetch(
      `/api/customers/search?q=${encodeURIComponent(params.query)}&limit=${params.limit}`,
      { signal }
    );

    if (!response.ok) {
      throw new Error(`客户搜索失败: ${response.statusText}`);
    }

    const data = await response.json();

    return data.map(
      (customer: {
        id: string;
        name: string;
        code: string;
        phone?: string;
        email?: string;
      }) => ({
        id: customer.id,
        title: customer.name,
        description: `联系人: ${customer.name}, 电话: ${customer.phone || '未提供'}`,
        type: 'customer' as const,
        href: `/customers/${customer.id}`,
        metadata: { phone: customer.phone },
      })
    );
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return [];
    }
    console.error('客户搜索失败:', error);
    throw error;
  }
}

/**
 * 并行搜索所有数据源
 */
export async function searchAll(
  query: string,
  signal?: AbortSignal
): Promise<SearchResultItem[]> {
  const [productResults, orderResults, customerResults] = await Promise.all([
    searchProducts(query, signal),
    searchOrders(query, signal),
    searchCustomers(query, signal),
  ]);

  return [...productResults, ...orderResults, ...customerResults];
}
