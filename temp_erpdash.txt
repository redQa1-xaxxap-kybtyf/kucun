'use client';

import {
  AlertCircle,
  Calendar,
  Eye,
  Package,
  RefreshCw,
  ShoppingCart,
  Users,
  Zap,
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { FactoryShipments } from '@/components/dashboard/factory-shipments';
import { RecentOrders } from '@/components/dashboard/recent-orders';
import { StatCardsGrid } from '@/components/dashboard/stat-cards';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useBusinessOverview } from '@/lib/api/dashboard';
import type {
  BusinessOverview,
  DashboardData,
  TimeRange,
} from '@/lib/types/dashboard';
import type { FactoryShipmentOrder } from '@/lib/types/factory-shipment';
import type { SalesOrder } from '@/lib/types/sales-order';
import { cn } from '@/lib/utils';

/**
 * 仪表盘数据类型定义
 */
interface DashboardStats {
  totalProducts: number;
  totalOrders: number;
  totalCustomers: number;
  totalRevenue: number;
  totalReturns: number;
  lowStockItems: number;
  pendingOrders: number;
  recentActivities: Activity[];
  salesTrend: SalesTrendData[];
}

interface Activity {
  id: string;
  type: 'order' | 'inventory' | 'customer' | 'payment';
  title: string;
  description: string;
  timestamp: Date;
  status: 'success' | 'warning' | 'error' | 'info';
}

interface SalesTrendData {
  date: string;
  sales: number;
  orders: number;
}

/**
 * ERP风格的仪表盘组件
 * 采用紧凑布局，符合中国ERP系统用户习惯
 *
 * 优化说明：
 * 1. 使用 RSC 预取的 initialData 作为初始状态
 * 2. TanStack Query 配置 initialData + staleTime，避免重复请求
 * 3. 仅在用户主动刷新/切换筛选时才触发客户端请求
 */
interface ERPDashboardProps {
  initialData?: DashboardData | null;
  initialTimeRange?: string;
  initialOrders?: {
    recent: SalesOrder[];
    pending: SalesOrder[];
    shipments: FactoryShipmentOrder[];
  };
}

export function ERPDashboard({
  initialData,
  initialTimeRange = '7d',
  initialOrders,
}: ERPDashboardProps) {
  const { data: session } = useSession();
  const router = useRouter();

  // 转换初始数据的辅助函数
  const getInitialDashboardData = React.useCallback(() => {
    if (initialData?.overview) {
      return {
        totalProducts: initialData.overview.inventory.totalProducts,
        totalOrders: initialData.overview.sales.totalOrders,
        totalCustomers: initialData.overview.customers.totalCustomers,
        totalRevenue: initialData.overview.sales.totalRevenue,
        totalReturns: initialData.overview.returns.totalReturns,
        lowStockItems: initialData.overview.inventory.lowStockCount,
        pendingOrders: initialData.overview.sales.monthlyOrders,
        recentActivities: [],
        salesTrend: [],
      };
    }
    return null;
  }, [initialData]);

  // 数据状态 - 使用 RSC 预取的数据作为初始状态
  const [dashboardData, setDashboardData] =
    React.useState<DashboardStats | null>(getInitialDashboardData);
  const [selectedPeriod, setSelectedPeriod] = React.useState(initialTimeRange);
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  // 订单数据状态 - 使用 RSC 预取的数据作为初始状态
  const [recentOrders, setRecentOrders] = React.useState<SalesOrder[]>(
    initialOrders?.recent || []
  );
  const [pendingOrders, setPendingOrders] = React.useState<SalesOrder[]>(
    initialOrders?.pending || []
  );
  const [factoryShipments, setFactoryShipments] = React.useState<
    FactoryShipmentOrder[]
  >(initialOrders?.shipments || []);
  const [isLoadingOrders, setIsLoadingOrders] = React.useState(!initialOrders);

  // 移除mockData，完全依赖真实API数据

  // 映射时间周期到API格式
  const mapPeriodToTimeRange = (period: string): TimeRange => {
    switch (period) {
      case 'today':
        return '1d';
      case 'week':
        return '7d';
      case 'month':
        return '30d';
      case 'quarter':
        return '90d';
      default:
        return '1d';
    }
  };

  // 转换API数据到组件数据格式
  const transformDashboardData = (
    apiData: BusinessOverview
  ): DashboardStats => ({
    totalProducts: apiData.inventory.totalProducts,
    totalOrders: apiData.sales.totalOrders,
    totalCustomers: apiData.customers.totalCustomers,
    totalRevenue: apiData.sales.totalRevenue,
    totalReturns: apiData.returns.totalReturns,
    lowStockItems: apiData.inventory.lowStockCount,
    pendingOrders: apiData.sales.monthlyOrders, // 使用月订单数作为待处理订单
    recentActivities: [], // 暂时为空，后续可以从API获取
    salesTrend: [], // 暂时为空，后续可以从API获取
  });

  // 🚀 使用 TanStack Query 获取仪表盘数据
  // ✅ Next.js 15.4 + TanStack Query v5 最佳实践：配置 staleTime=Infinity 避免重复请求
  const {
    data: dashboardApiData,
    isLoading: isApiLoading,
    refetch,
  } = useBusinessOverview(mapPeriodToTimeRange(selectedPeriod), {
    // ✅ 服务端预取的数据永不过期（除非手动刷新或切换时间范围）
    staleTime: Infinity,
    // 仅在组件挂载时获取一次，后续切换标签页不会重新请求
    refetchOnWindowFocus: false,
    // ✅ 防止客户端重复请求服务端已预取的数据
    refetchOnMount: false,
  });

  // 加载数据 - 完全使用真实API数据
  const loadDashboardData = React.useCallback(async () => {
    try {
      if (dashboardApiData) {
        // 转换API数据格式
        const transformedData = transformDashboardData(dashboardApiData);
        setDashboardData(transformedData);
      } else {
        // 如果API数据不可用，设置为null，显示加载状态
        console.warn('仪表盘API数据不可用');
        setDashboardData(null);
      }
    } catch (error) {
      console.error('加载仪表盘数据失败:', error);
      // 错误时设置为null，显示错误状态
      setDashboardData(null);
    }
  }, [dashboardApiData]);

  // 刷新订单数据（仅在用户主动刷新时调用）
  const loadOrdersData = React.useCallback(async () => {
    setIsLoadingOrders(true);
    try {
      // 获取最近订单（最新的10条）
      const recentResponse = await fetch(
        '/api/sales-orders?page=1&limit=10&sortBy=createdAt&sortOrder=desc'
      );
      if (recentResponse.ok) {
        const recentData = await recentResponse.json();
        setRecentOrders(recentData.data?.salesOrders || []);
      }

      // 获取待处理订单（草稿状态）
      const pendingResponse = await fetch(
        '/api/sales-orders?page=1&limit=10&status=draft&sortBy=createdAt&sortOrder=asc'
      );
      if (pendingResponse.ok) {
        const pendingData = await pendingResponse.json();
        setPendingOrders(pendingData.data?.salesOrders || []);
      }

      // 获取厂家发货订单（最新的8条）
      const shipmentsResponse = await fetch(
        '/api/factory-shipments?page=1&limit=8&sortBy=createdAt&sortOrder=desc'
      );
      if (shipmentsResponse.ok) {
        const shipmentsData = await shipmentsResponse.json();
        setFactoryShipments(shipmentsData.data?.factoryShipmentOrders || []);
      }
    } catch (error) {
      console.error('加载订单数据失败:', error);
    } finally {
      setIsLoadingOrders(false);
    }
  }, []);

  // 刷新数据
  const refreshData = async () => {
    setIsRefreshing(true);
    try {
      // 使用API的refetch方法刷新数据
      if (refetch) {
        await refetch();
      } else {
        await loadDashboardData();
      }
      // 同时刷新订单数据
      await loadOrdersData();
    } catch (error) {
      console.error('刷新仪表盘数据失败:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // 注意：订单数据和仪表盘数据已通过 state 初始化使用 RSC 的预取数据
  // 无需额外的 useEffect 处理初始数据

  // 仅在没有初始数据且API加载完成时加载数据
  React.useEffect(() => {
    if (!isApiLoading && !initialData && !dashboardData) {
      loadDashboardData();
    }
  }, [loadDashboardData, isApiLoading, initialData, dashboardData]);

  if (!dashboardData) {
    return (
      <div className="bg-card rounded border">
        <div className="bg-muted/30 border-b px-3 py-2">
          <h3 className="text-sm font-medium">业务概览</h3>
        </div>
        <div className="px-3 py-8">
          <div className="text-center text-xs text-red-600">
            加载数据失败，请刷新重试
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-auto p-6">
      <div className="space-y-6">
        {/* 页面标题和操作栏 */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">业务概览</h2>
            <p className="text-muted-foreground text-sm">
              欢迎回来，{session?.user?.name || '用户'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="text-muted-foreground h-4 w-4" />
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger className="h-9 w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1d">今天</SelectItem>
                  <SelectItem value="7d">最近7天</SelectItem>
                  <SelectItem value="30d">最近30天</SelectItem>
                  <SelectItem value="90d">最近90天</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={refreshData}
              disabled={isRefreshing}
            >
              <RefreshCw
                className={cn('mr-2 h-4 w-4', isRefreshing && 'animate-spin')}
              />
              刷新
            </Button>
          </div>
        </div>

        {/* 核心指标卡片 */}
        {dashboardApiData && (
          <StatCardsGrid overview={dashboardApiData} loading={false} />
        )}

        {/* 快速操作和需要关注 - 紧凑布局 */}
        <div className="grid gap-4 lg:grid-cols-2">
          {/* 快速操作 - 紧凑版 */}
          <div className="overflow-hidden rounded-lg border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-secondary))] shadow-[var(--shadow-light)]">
            <div className="border-b border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-primary-light))] px-4 py-3">
              <h3 className="font-semibold text-[hsl(var(--color-text-primary))]">
                快速操作
              </h3>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-16 flex-col gap-1.5 text-[hsl(var(--color-text-primary))] transition-all hover:border-[hsl(var(--color-primary))] hover:bg-[hsl(var(--color-primary-light))] hover:text-[hsl(var(--color-primary))]"
                  onClick={() => router.push('/products/create')}
                >
                  <Package className="h-4 w-4 text-[hsl(var(--color-primary))]" />
                  <span className="text-xs font-medium">新建产品</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-16 flex-col gap-1.5 text-[hsl(var(--color-text-primary))] transition-all hover:border-[hsl(var(--color-success))] hover:bg-[hsl(var(--color-success-light))] hover:text-[hsl(var(--color-success))]"
                  onClick={() => router.push('/sales-orders/create')}
                >
                  <ShoppingCart className="h-4 w-4 text-[hsl(var(--color-success))]" />
                  <span className="text-xs font-medium">新建订单</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-16 flex-col gap-1.5 text-[hsl(var(--color-text-primary))] transition-all hover:border-[hsl(var(--color-purple))] hover:bg-[hsl(var(--color-purple-light))] hover:text-[hsl(var(--color-purple))]"
                  onClick={() => router.push('/customers/create')}
                >
                  <Users className="h-4 w-4 text-[hsl(var(--color-purple))]" />
                  <span className="text-xs font-medium">新建客户</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-16 flex-col gap-1.5 text-[hsl(var(--color-text-primary))] transition-all hover:border-[hsl(var(--color-warning))] hover:bg-[hsl(var(--color-warning-light))] hover:text-[hsl(var(--color-warning))]"
                  onClick={() => router.push('/inventory')}
                >
                  <Zap className="h-4 w-4 text-[hsl(var(--color-warning))]" />
                  <span className="text-xs font-medium">库存管理</span>
                </Button>
              </div>
            </div>
          </div>

          {/* 需要关注 - 紧凑版 */}
          <div className="overflow-hidden rounded-lg border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-secondary))] shadow-[var(--shadow-light)]">
            <div className="border-b border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-warning-light))] px-4 py-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-[hsl(var(--color-warning))]" />
                <h3 className="font-semibold text-[hsl(var(--color-text-primary))]">
                  需要关注
                </h3>
              </div>
            </div>
            <div className="p-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between rounded-lg border border-[hsl(var(--color-warning))] bg-[hsl(var(--color-warning-light))] p-3 transition-all hover:shadow-[var(--shadow-light)]">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--color-warning-light))] text-[hsl(var(--color-warning))]">
                      <Package className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-[hsl(var(--color-warning))]">
                        库存不足
                      </div>
                      <div className="text-xs text-[hsl(var(--color-warning-hover))]">
                        {dashboardData.lowStockItems} 个产品
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-[hsl(var(--color-warning))] hover:bg-[hsl(var(--color-warning-light))]"
                    onClick={() => router.push('/inventory')}
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-[hsl(var(--color-primary))] bg-[hsl(var(--color-primary-light))] p-3 transition-all hover:shadow-[var(--shadow-light)]">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--color-primary-light))] text-[hsl(var(--color-primary))]">
                      <ShoppingCart className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-[hsl(var(--color-primary))]">
                        待处理订单
                      </div>
                      <div className="text-xs text-[hsl(var(--color-text-secondary))]">
                        {pendingOrders.length} 个订单
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-[hsl(var(--color-primary))] hover:bg-[hsl(var(--color-primary-light))]"
                    onClick={() => router.push('/sales-orders')}
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 订单动态区域 - 主要内容区 */}
        <div className="grid gap-6 xl:grid-cols-2">
          {/* 实时订单动态 */}
          <RecentOrders
            orders={recentOrders.slice(0, 8)}
            loading={isLoadingOrders}
          />

          {/* 厂家发货订单列表 */}
          <FactoryShipments
            orders={factoryShipments}
            loading={isLoadingOrders}
          />
        </div>
      </div>
    </div>
  );
}
