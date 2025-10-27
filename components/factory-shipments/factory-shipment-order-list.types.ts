import type {
  FactoryShipmentOrder,
  FactoryShipmentStatus,
} from '@/lib/types/factory-shipment';

export interface FactoryShipmentOrderListViewProps {
  searchValue: string;
  statusFilter: FactoryShipmentStatus | 'all';
  dateRange: { startDate?: string; endDate?: string };
  isSearching: boolean;
  onSearch: (value: string) => void;
  onStatusChange: (value: FactoryShipmentStatus | 'all') => void;
  onDateRangeChange: (range: { startDate?: string; endDate?: string }) => void;
  onClearFilters: () => void;
  orders: FactoryShipmentOrder[];
  isLoading: boolean;
  error: unknown;
  pagination?: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
  };
  onPageChange: (page: number) => void;
  onCancelRequest: (order: FactoryShipmentOrder) => void;
  onDeleteRequest: (order: FactoryShipmentOrder) => void;
  onOrderSelect?: (order: FactoryShipmentOrder) => void;
  onRetry: () => void;
}
