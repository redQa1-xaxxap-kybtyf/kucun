/**
 * 应收账款服务对外类型
 * 将公共类型从 service 主文件中拆分，降低 max-lines
 */

export type PaymentStatus = 'unpaid' | 'partial' | 'pending' | 'paid';

export interface ReceivableItem {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  orderDate: string;
  totalAmount: number;
  roundingAdjustment: number;
  paymentRoundingAmount: number;
  pendingRoundingAmount: number;
  paidAmount: number;
  pendingAmount: number;
  remainingAmount: number;
  paymentStatus: PaymentStatus;
  lastPaymentDate?: string;
}

export interface ReceivableSummary {
  totalReceivable: number;
  receivableCount: number;
  paidCount: number;
  unpaidCount: number;
  partialCount: number;
  pendingCount: number;
  collectionRate: number;
  collectionRateChange: number;
}

export interface ReceivablesQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  customerId?: string;
  paymentStatus?: 'unpaid' | 'partial' | 'pending' | 'paid';
  startDate?: string;
  endDate?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ReceivablesResult {
  receivables: ReceivableItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  summary: ReceivableSummary;
}
