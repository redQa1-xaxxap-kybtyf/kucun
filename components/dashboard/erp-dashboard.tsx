'use client';

import { Package, RefreshCw, ShoppingCart, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

import { DashboardTodoBar } from '@/components/dashboard/dashboard-todo-bar';
import { DashboardTrendChart } from '@/components/dashboard/dashboard-trend-chart';
import { ProductRanking } from '@/components/dashboard/product-ranking';
import { StatCardsGrid } from '@/components/dashboard/stat-cards-enhanced';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useProductRanking } from '@/lib/api/dashboard';
import { useErpDashboardData } from '@/lib/hooks/useDashboardData';
import type {
  DashboardData,
  DashboardFactoryShipmentSummary,
  DashboardSalesOrderSummary,
  TimeRange,
} from '@/lib/types/dashboard';
import { cn } from '@/lib/utils';

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
    recent: DashboardSalesOrderSummary[];
    pending: DashboardSalesOrderSummary[];
    shipments: DashboardFactoryShipmentSummary[];
  };
}

export function ERPDashboard({
  initialData,
  initialTimeRange = '7d',
  initialOrders,
}: ERPDashboardProps) {
  const { data: session } = useSession();
  const router = useRouter();

  const {
    dashboardData,
    dashboardApiData,
    salesTrend,
    selectedPeriod,
    setSelectedPeriod,
    recentOrders: _recentOrders,
    pendingOrders,
    factoryShipments: _factoryShipments,
    isLoadingOrders: _isLoadingOrders,
    isRefreshing,
    refreshData,
  } = useErpDashboardData({
    initialData,
    initialTimeRange,
    initialOrders,
  });

  // 获取产品排名数据
  const {
    data: productRankingData,
    isLoading: isLoadingRanking,
  } = useProductRanking(selectedPeriod as TimeRange, 10);

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
        <DashboardHeader
          userName={session?.user?.name}
          selectedPeriod={selectedPeriod}
          onPeriodChange={setSelectedPeriod}
          isRefreshing={isRefreshing}
          onRefresh={refreshData}
          onCreateProduct={() => router.push('/products/create')}
          onCreateOrder={() => router.push('/sales-orders/create')}
          onCreateCustomer={() => router.push('/customers/create')}
          onManageInventory={() => router.push('/inventory')}
        />

        {/* 待办事项栏 (TodoBar) */}
        <DashboardTodoBar
          lowStockItems={dashboardData.lowStockItems}
          pendingOrderCount={pendingOrders.length}
          onViewInventory={() => router.push('/inventory')}
          onViewOrders={() => router.push('/sales-orders')}
        />

        {/* 核心指标卡片 */}
        {dashboardApiData && (
          <StatCardsGrid overview={dashboardApiData} loading={false} />
        )}

        {/* 销售趋势图 */}
        {salesTrend && <DashboardTrendChart data={salesTrend} />}

        {/* 产品销售排行 */}
        <ProductRanking
          warehouse={productRankingData?.warehouse || []}
          factory={productRankingData?.factory || []}
          loading={isLoadingRanking}
        />
      </div>
    </div>
  );
}

interface DashboardHeaderProps {
  userName?: string | null;
  selectedPeriod: string;
  onPeriodChange: (value: string) => void;
  isRefreshing: boolean;
  onRefresh: () => void;
  onCreateProduct: () => void;
  onCreateOrder: () => void;
  onCreateCustomer: () => void;
  onManageInventory: () => void;
}

function DashboardHeader({
  userName,
  selectedPeriod,
  onPeriodChange,
  isRefreshing,
  onRefresh,
  onCreateProduct,
  onCreateOrder,
  onCreateCustomer,
  onManageInventory: _onManageInventory,
}: DashboardHeaderProps) {
  const quickActions = [
    { label: '新建订单', action: onCreateOrder, icon: ShoppingCart },
    { label: '新建产品', action: onCreateProduct, icon: Package },
    { label: '新建客户', action: onCreateCustomer, icon: Users },
  ];

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">业务概览</h2>
        <p className="text-muted-foreground text-sm">
          欢迎回来，{userName || '用户'}。这是您今天的业务动态。
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {/* 快捷操作按钮组 */}
        <div className="flex items-center gap-2">
          {quickActions.map(({ label, action, icon: Icon }) => (
            <Button
              key={label}
              size="sm"
              variant="outline"
              className="h-9"
              onClick={action}
            >
              <Icon className="mr-2 h-4 w-4" />
              {label}
            </Button>
          ))}
        </div>

        <div className="bg-border h-6 w-px" />

        <div className="flex items-center gap-2">
          <Select value={selectedPeriod} onValueChange={onPeriodChange}>
            <SelectTrigger className="h-9 w-[110px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1d">今天</SelectItem>
              <SelectItem value="7d">最近7天</SelectItem>
              <SelectItem value="30d">最近30天</SelectItem>
              <SelectItem value="90d">最近90天</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={onRefresh}
            disabled={isRefreshing}
            title="刷新数据"
          >
            <RefreshCw
              className={cn('h-4 w-4', isRefreshing && 'animate-spin')}
            />
          </Button>
        </div>
      </div>
    </div>
  );
}
