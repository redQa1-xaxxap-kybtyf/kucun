/**
 * 价格历史类型定义
 * 从 hooks/use-price-history.ts 导出类型,提供统一的类型导入入口
 */

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

// 价格历史数据响应类型
export interface PriceHistoryData {
  success: boolean;
  data: CustomerProductPrice[];
}

// 供应商价格历史数据响应类型
export interface SupplierPriceHistoryData {
  success: boolean;
  data: SupplierProductPrice[];
}

