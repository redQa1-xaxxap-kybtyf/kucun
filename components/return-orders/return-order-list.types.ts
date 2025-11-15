import type {
  ReturnOrder,
  ReturnOrderStatus,
  ReturnOrderType,
} from '@/lib/types/return-order';

export interface ReturnOrderListViewProps {
  searchValue: string;
  statusFilter: ReturnOrderStatus | 'all';
  typeFilter: ReturnOrderType | 'all';
  dateRange: { startDate?: string; endDate?: string };
  isSearching: boolean;
  onSearch: (value: string) => void;
  onStatusChange: (value: ReturnOrderStatus | 'all') => void;
  onTypeChange: (value: ReturnOrderType | 'all') => void;
  onDateRangeChange: (range: { startDate?: string; endDate?: string }) => void;
  onClearFilters: () => void;
  orders: ReturnOrder[];
  isLoading: boolean;
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
