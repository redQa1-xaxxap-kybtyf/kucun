'use client';

import * as React from 'react';

import { useBusinessOverview, useSalesTrend } from '@/lib/api/dashboard';
import type {
    BusinessOverview,
    DashboardData,
    DashboardFactoryShipmentSummary,
    DashboardSalesOrderStatus,
    DashboardSalesOrderSummary,
    SalesTrendData,
    TimeRange,
} from '@/lib/types/dashboard';
import type { FactoryShipmentStatus } from '@/lib/types/factory-shipment';
import { logger } from '@/lib/utils/console-logger';

type UnknownRecord = Record<string, unknown>;

interface DashboardStats {
  totalProducts: number;
  totalOrders: number;
  totalCustomers: number;
  totalRevenue: number;
  totalReturns: number;
  lowStockItems: number;
  pendingOrders: number;
}

const normalizeDate = (value: unknown): string => {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }
  return new Date().toISOString();
};

const asNumber = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const DASHBOARD_ORDER_STATUSES: readonly DashboardSalesOrderStatus[] = [
  'draft',
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'completed',
  'cancelled',
] as const;

const toDashboardOrderStatus = (status: unknown): DashboardSalesOrderStatus =>
  DASHBOARD_ORDER_STATUSES.includes(status as DashboardSalesOrderStatus)
    ? (status as DashboardSalesOrderStatus)
    : 'draft';

const FACTORY_SHIPMENT_STATUSES = new Set<FactoryShipmentStatus>([
  'draft',
  'confirmed',
  'pending_shipment',
  'shipped',
  'in_transit',
  'arrived',
  'cancelled',
]);

const toFactoryShipmentStatus = (status: unknown): FactoryShipmentStatus =>
  FACTORY_SHIPMENT_STATUSES.has(status as FactoryShipmentStatus)
    ? (status as FactoryShipmentStatus)
    : 'draft';

const extractCustomer = (
  value: unknown
): DashboardSalesOrderSummary['customer'] => {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const record = value as UnknownRecord;
  const id = record.id;
  const name = record.name;
  return {
    id: id === undefined ? '' : String(id),
    name:
      name === undefined || name === null
        ? null
        : typeof name === 'string'
          ? name
          : String(name),
  };
};

const mapSalesOrderSummaries = (
  orders: unknown
): DashboardSalesOrderSummary[] => {
  if (!Array.isArray(orders)) {
    return [];
  }

  return orders.reduce<DashboardSalesOrderSummary[]>((result, item) => {
    if (!item || typeof item !== 'object') {
      return result;
    }

    const record = item as UnknownRecord;
    const id = record.id;
    const orderNumber = record.orderNumber;

    if (id === undefined || orderNumber === undefined) {
      return result;
    }

    result.push({
      id: String(id),
      orderNumber: String(orderNumber),
      totalAmount: asNumber(record.totalAmount),
      status: toDashboardOrderStatus(record.status),
      createdAt: normalizeDate(record.createdAt),
      customer: extractCustomer(record.customer),
    });

    return result;
  }, []);
};

const mapFactoryShipmentSummaries = (
  orders: unknown
): DashboardFactoryShipmentSummary[] => {
  if (!Array.isArray(orders)) {
    return [];
  }

  return orders.reduce<DashboardFactoryShipmentSummary[]>((result, item) => {
    if (!item || typeof item !== 'object') {
      return result;
    }

    const record = item as UnknownRecord;
    const id = record.id;
    const orderNumber = record.orderNumber;

    if (id === undefined || orderNumber === undefined) {
      return result;
    }

    result.push({
      id: String(id),
      orderNumber: String(orderNumber),
      status: toFactoryShipmentStatus(record.status),
      totalAmount: asNumber(record.totalAmount),
      createdAt: normalizeDate(record.createdAt),
      customer: extractCustomer(record.customer),
    });

    return result;
  }, []);
};

const mapPeriodToTimeRange = (period: string): TimeRange => {
  switch (period) {
    case 'today':
    case '1d':
      return '1d';
    case 'week':
    case '7d':
      return '7d';
    case 'month':
    case '30d':
      return '30d';
    case 'quarter':
    case '90d':
      return '90d';
    case '1y':
      return '1y';
    case 'all':
      return 'all';
    default:
      return '7d';
  }
};

interface UseErpDashboardDataParams {
  initialData?: DashboardData | null;
  initialTimeRange?: string;
  initialOrders?: {
    recent: DashboardSalesOrderSummary[];
    pending: DashboardSalesOrderSummary[];
    shipments: DashboardFactoryShipmentSummary[];
  };
}

interface UseErpDashboardDataResult {
  dashboardData: DashboardStats | null;
  dashboardApiData: BusinessOverview | undefined;
  salesTrend: SalesTrendData | undefined;
  isApiLoading: boolean;

  selectedPeriod: string;
  setSelectedPeriod: (value: string) => void;

  recentOrders: DashboardSalesOrderSummary[];
  pendingOrders: DashboardSalesOrderSummary[];
  factoryShipments: DashboardFactoryShipmentSummary[];
  isLoadingOrders: boolean;

  isRefreshing: boolean;
  refreshData: () => Promise<void>;
}

const transformDashboardData = (apiData: BusinessOverview): DashboardStats => ({
  totalProducts: apiData.inventory.totalProducts,
  totalOrders: apiData.sales.totalOrders,
  totalCustomers: apiData.customers.totalCustomers,
  totalRevenue: apiData.sales.totalRevenue,
  totalReturns: apiData.returns.totalReturns,
  lowStockItems: apiData.inventory.lowStockCount,
  pendingOrders: apiData.sales.monthlyOrders,
});

export function useErpDashboardData(
  params: UseErpDashboardDataParams
): UseErpDashboardDataResult {
  const { initialData, initialTimeRange = '7d', initialOrders } = params;

  const getInitialDashboardData = React.useCallback(() => {
    if (initialData?.overview) {
      return transformDashboardData(initialData.overview);
    }
    return null;
  }, [initialData]);

  const [dashboardData, setDashboardData] =
    React.useState<DashboardStats | null>(getInitialDashboardData);
  const [selectedPeriod, setSelectedPeriod] =
    React.useState<string>(initialTimeRange);
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const [recentOrders, setRecentOrders] = React.useState<
    DashboardSalesOrderSummary[]
  >(initialOrders?.recent || []);
  const [pendingOrders, setPendingOrders] = React.useState<
    DashboardSalesOrderSummary[]
  >(initialOrders?.pending || []);
  const [factoryShipments, setFactoryShipments] = React.useState<
    DashboardFactoryShipmentSummary[]
  >(initialOrders?.shipments || []);
  const [isLoadingOrders, setIsLoadingOrders] = React.useState(!initialOrders);

  const timeRange = mapPeriodToTimeRange(selectedPeriod);

  const {
    data: dashboardApiData,
    isLoading: isApiLoading,
    refetch: refetchOverview,
  } = useBusinessOverview(timeRange, {
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const { data: salesTrend, refetch: refetchSalesTrend } = useSalesTrend(
    timeRange
  );

  const loadDashboardData = React.useCallback(
    async (source?: BusinessOverview | null) => {
      try {
        const data = source ?? dashboardApiData;

        if (data) {
          const transformedData = transformDashboardData(data);
          setDashboardData(transformedData);
        } else {
          logger.warn('dashboard:erp', '仪表盘API数据不可用');
          setDashboardData(null);
        }
      } catch (error) {
        logger.error('dashboard:erp', '加载仪表盘数据失败', error, {
          action: 'loadDashboardData',
        });
        setDashboardData(null);
      }
    },
    [dashboardApiData]
  );

  const loadOrdersData = React.useCallback(async () => {
    setIsLoadingOrders(true);
    try {
      const recentResponse = await fetch(
        '/api/sales-orders?page=1&limit=10&sortBy=createdAt&sortOrder=desc'
      );
      if (recentResponse.ok) {
        const recentData = await recentResponse.json();
        setRecentOrders(mapSalesOrderSummaries(recentData.data?.salesOrders));
      }

      const pendingResponse = await fetch(
        '/api/sales-orders?page=1&limit=10&status=draft&sortBy=createdAt&sortOrder=asc'
      );
      if (pendingResponse.ok) {
        const pendingData = await pendingResponse.json();
        setPendingOrders(mapSalesOrderSummaries(pendingData.data?.salesOrders));
      }

      const shipmentsResponse = await fetch(
        '/api/factory-shipments?page=1&limit=8&sortBy=createdAt&sortOrder=desc'
      );
      if (shipmentsResponse.ok) {
        const shipmentsData = await shipmentsResponse.json();
        setFactoryShipments(
          mapFactoryShipmentSummaries(shipmentsData.data?.factoryShipmentOrders)
        );
      }
    } catch (error) {
      logger.error('dashboard:erp', '加载订单数据失败', error, {
        action: 'loadSalesOrderSummary',
      });
    } finally {
      setIsLoadingOrders(false);
    }
  }, []);

  const refreshData = React.useCallback(async () => {
    setIsRefreshing(true);
    try {
      const [overviewResult] = await Promise.all([
        refetchOverview(),
        refetchSalesTrend(),
      ]);
      await loadDashboardData(overviewResult.data ?? null);
      await loadOrdersData();
    } catch (error) {
      logger.error('dashboard:erp', '刷新仪表盘数据失败', error, {
        action: 'refreshDashboard',
      });
    } finally {
      setIsRefreshing(false);
    }
  }, [loadDashboardData, loadOrdersData, refetchOverview, refetchSalesTrend]);

  React.useEffect(() => {
    if (!isApiLoading && !initialData && !dashboardData) {
      void loadDashboardData();
    }
  }, [loadDashboardData, isApiLoading, initialData, dashboardData]);

  return {
    dashboardData,
    dashboardApiData,
    salesTrend: salesTrend ?? initialData?.salesTrend,
    isApiLoading,
    selectedPeriod,
    setSelectedPeriod,
    recentOrders,
    pendingOrders,
    factoryShipments,
    isLoadingOrders,
    isRefreshing,
    refreshData,
  };
}
