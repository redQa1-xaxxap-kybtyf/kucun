import type {
  ReturnOrder,
  ReturnOrderType,
  ReturnProcessType,
  ReturnOrderUiStatus,
} from '@/lib/types/return-order';

export interface ReturnOrderListViewProps {
  searchValue: string;
  statusFilter: ReturnOrderUiStatus | 'all';
  typeFilter: ReturnOrderType | 'all';
  processTypeFilter: ReturnProcessType | 'all';
  includeTest?: boolean;
  includeVoided?: boolean;
  dateRange: { startDate?: string; endDate?: string };
  isSearching: boolean;
  onSearch: (value: string) => void;
  onStatusChange: (value: ReturnOrderUiStatus | 'all') => void;
  onTypeChange: (value: ReturnOrderType | 'all') => void;
  onProcessTypeChange: (value: ReturnProcessType | 'all') => void;
  onIncludeVoidedToggle: () => void;
  onDateRangeChange: (range: { startDate?: string; endDate?: string }) => void;
  onClearFilters: () => void;
  orders: ReturnOrder[];
  isLoading: boolean;
  isRefreshing?: boolean;
  error: unknown;
  pagination?: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
  };
  onPageChange: (page: number) => void;
  onDeleteRequest: (order: ReturnOrder) => void;
  onOrderSelect?: (order: ReturnOrder) => void;
  onRetry: () => void;
}
