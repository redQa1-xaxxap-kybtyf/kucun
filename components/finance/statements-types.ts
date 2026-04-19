export type StatementBadgeType = 'customer' | 'supplier' | 'partner';

export interface AccountStatementItem {
  id: string;
  name: string;
  type: StatementBadgeType;
  partnerRole: 'customer' | 'supplier' | 'both';
  status: 'active' | 'settled' | 'suspended';
  totalOrders: number;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  currentBalance: number;
  lastTransactionDate: string | null;
  lastPaymentDate: string | null;
}

export const TYPE_LABEL_MAP: Record<StatementBadgeType, string> = {
  customer: '客户',
  supplier: '供应商',
  partner: '往来伙伴',
};

export const STATUS_LABEL_MAP: Record<AccountStatementItem['status'], string> =
  {
    active: '进行中',
    settled: '已结清',
    suspended: '已暂停',
  };

export type StatementsFiltersState = {
  search: string;
  type: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  startDate?: string;
  endDate?: string;
};

export interface StatementsSummary {
  totalReceivable: number;
  totalPayable: number;
  totalCustomers: number;
  totalSuppliers: number;
}

export interface StatementsPagination {
  page: number;
  limit: number;
  pageSize?: number;
  total: number;
  totalPages: number;
}

export interface StatementsFilters {
  search?: string;
  searchInput?: string;
  type?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  startDate?: string;
  endDate?: string;
}

export interface StatementsClientInitialParams {
  page: number;
  limit: number;
  search?: string;
  type?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  startDate?: string;
  endDate?: string;
}
