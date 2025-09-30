import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// 价格类型
export type PriceType = 'SALES' | 'FACTORY';
export type OrderType = 'SALES_ORDER' | 'FACTORY_SHIPMENT';

// 客户产品价格历史
export interface CustomerProductPrice {
  id: string;
  customerId: string;
  productId: string;
  priceType: PriceType;
  unitPrice: number;
  orderId?: string;
  orderType?: OrderType;
  createdAt: Date;
  product?: {
    id: string;
    code: string;
    name: string;
    specification?: string;
    unit: string;
  };
}

// 供应商产品价格历史
export interface SupplierProductPrice {
  id: string;
  supplierId: string;
  productId: string;
  unitPrice: number;
  orderId?: string;
  createdAt: Date;
  product?: {
    id: string;
    code: string;
    name: string;
    specification?: string;
    unit: string;
  };
}

/**
 * 获取客户产品历史价格
 */
export function useCustomerPriceHistory(params: {
  customerId?: string;
  productId?: string;
  priceType?: PriceType;
}) {
  return useQuery({
    queryKey: ['customer-price-history', params],
    queryFn: async () => {
      if (!params.customerId) {
        return { success: true, data: [] };
      }

      const searchParams = new URLSearchParams();
      searchParams.set('customerId', params.customerId);
      if (params.productId) {
        searchParams.set('productId', params.productId);
      }
      if (params.priceType) {
        searchParams.set('priceType', params.priceType);
      }

      const response = await fetch(
        `/api/price-history/customer?${searchParams.toString()}`
      );

      if (!response.ok) {
        throw new Error('获取客户价格历史失败');
      }

      return response.json() as Promise<{
        success: boolean;
        data: CustomerProductPrice[];
      }>;
    },
    enabled: !!params.customerId,
    staleTime: 5 * 60 * 1000, // 5分钟缓存
  });
}

/**
 * 获取供应商产品历史价格
 */
export function useSupplierPriceHistory(params: {
  supplierId?: string;
  productId?: string;
}) {
  return useQuery({
    queryKey: ['supplier-price-history', params],
    queryFn: async () => {
      if (!params.supplierId) {
        return { success: true, data: [] };
      }

      const searchParams = new URLSearchParams();
      searchParams.set('supplierId', params.supplierId);
      if (params.productId) {
        searchParams.set('productId', params.productId);
      }

      const response = await fetch(
        `/api/price-history/supplier?${searchParams.toString()}`
      );

      if (!response.ok) {
        throw new Error('获取供应商价格历史失败');
      }

      return response.json() as Promise<{
        success: boolean;
        data: SupplierProductPrice[];
      }>;
    },
    enabled: !!params.supplierId,
    staleTime: 5 * 60 * 1000, // 5分钟缓存
  });
}

/**
 * 记录客户产品价格历史
 */
export function useRecordCustomerPrice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      customerId: string;
      productId: string;
      priceType: PriceType;
      unitPrice: number;
      orderId?: string;
      orderType?: OrderType;
    }) => {
      const response = await fetch('/api/price-history/customer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('记录客户价格历史失败');
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      // 刷新相关的价格历史查询
      queryClient.invalidateQueries({
        queryKey: [
          'customer-price-history',
          { customerId: variables.customerId },
        ],
      });
    },
  });
}

/**
 * 记录供应商产品价格历史
 */
export function useRecordSupplierPrice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      supplierId: string;
      productId: string;
      unitPrice: number;
      orderId?: string;
    }) => {
      const response = await fetch('/api/price-history/supplier', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('记录供应商价格历史失败');
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      // 刷新相关的价格历史查询
      queryClient.invalidateQueries({
        queryKey: [
          'supplier-price-history',
          { supplierId: variables.supplierId },
        ],
      });
    },
  });
}

/**
 * 获取产品的最新价格（用于自动填充）
 * @param prices 价格历史列表
 * @param productId 产品ID
 * @param priceType 价格类型（可选）
 * @returns 最新价格，如果没有则返回 undefined
 */
export function getLatestPrice(
  prices: CustomerProductPrice[] | undefined,
  productId: string,
  priceType?: PriceType
): number | undefined {
  if (!prices || prices.length === 0) {
    return undefined;
  }

  // 过滤出指定产品和价格类型的价格
  const filteredPrices = prices.filter(
    p =>
      p.productId === productId && (!priceType || p.priceType === priceType)
  );

  if (filteredPrices.length === 0) {
    return undefined;
  }

  // 返回最新的价格（已经按创建时间降序排列）
  return filteredPrices[0].unitPrice;
}

/**
 * 获取供应商产品的最新价格（用于自动填充）
 */
export function getLatestSupplierPrice(
  prices: SupplierProductPrice[] | undefined,
  productId: string
): number | undefined {
  if (!prices || prices.length === 0) {
    return undefined;
  }

  // 过滤出指定产品的价格
  const filteredPrices = prices.filter(p => p.productId === productId);

  if (filteredPrices.length === 0) {
    return undefined;
  }

  // 返回最新的价格（已经按创建时间降序排列）
  return filteredPrices[0].unitPrice;
}

