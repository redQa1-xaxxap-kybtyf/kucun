'use client';

import { Package, RefreshCw, ShoppingCart, Users } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { useProductRanking } from '@/lib/api/dashboard';
import { useErpDashboardData } from '@/lib/hooks/useDashboardData';
import type {
  DashboardData,
  DashboardFactoryShipmentSummary,
  DashboardSalesOrderSummary,
  TimeRange,
} from '@/lib/types/dashboard';
import { cn } from '@/lib/utils';

const DashboardTrendChart = dynamic(
  () =>
    import('./dashboard-trend-chart').then(mod => mod.DashboardTrendChart),
  {
    ssr: false,
    loading: () => (
      <div className="h-[480px] w-full animate-pulse rounded-3xl bg-white/40" />
    ),
  }
);

const StatCardsGrid = dynamic(
  () => import('./stat-cards-enhanced').then(mod => mod.StatCardsGrid),
  {
    ssr: false,
    loading: () => (
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div
            key={`stat-skeleton-${idx}`}
            className="h-[160px] animate-pulse rounded-3xl bg-white/40"
          />
        ))}
      </div>
    ),
  }
);

const DashboardTodoBar = dynamic(
  () => import('./dashboard-todo-bar').then(mod => mod.DashboardTodoBar),
  {
    ssr: false,
    loading: () => (
      <div className="grid gap-6 md:grid-cols-2">
        {Array.from({ length: 2 }).map((_, idx) => (
          <div
            key={`todo-skeleton-${idx}`}
            className="h-[92px] animate-pulse rounded-[32px] bg-white/40"
          />
        ))}
      </div>
    ),
  }
);

const ProductRanking = dynamic(
  () => import('./product-ranking').then(mod => mod.ProductRanking),
  {
    ssr: false,
    loading: () => (
      <div className="h-[500px] w-full animate-pulse rounded-3xl bg-white/40" />
    ),
  }
);

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
  userName?: string | null;
  initialData?: DashboardData | null;
  initialTimeRange?: string;
  initialOrders?: {
    recent: DashboardSalesOrderSummary[];
    pending: DashboardSalesOrderSummary[];
    shipments: DashboardFactoryShipmentSummary[];
  };
}

export function ERPDashboard({
  userName,
  initialData,
  initialTimeRange = '7d',
  initialOrders,
}: ERPDashboardProps) {
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

  const { data: productRankingData, isLoading: isLoadingRanking } =
    useProductRanking(selectedPeriod as TimeRange, 10);

  if (!dashboardData) {
    return (
      <div className="flex h-full items-center justify-center p-12">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-50">
            <RefreshCw className="h-6 w-6 text-rose-500" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">数据加载失败</h3>
            <p className="text-sm text-slate-400">
              请检查网络连接或尝试刷新页面
            </p>
          </div>
          <Button
            onClick={() => window.location.reload()}
            variant="outline"
            className="rounded-xl"
          >
            立即刷新
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-slate-50/50 p-4 lg:p-10 xl:p-14">
      <div className="mx-auto w-full max-w-[1680px] space-y-12">
        <DashboardHeader
          userName={userName}
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

        <div className="space-y-10">
          {/* 核心指标卡片 */}
          {dashboardApiData && (
            <StatCardsGrid overview={dashboardApiData} loading={false} />
          )}

          <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1.8fr_1fr]">
            {/* 销售趋势图 */}
            <div className="space-y-10">
              {salesTrend && <DashboardTrendChart data={salesTrend} />}
            </div>

            {/* 产品销售排行 */}
            <div className="space-y-10">
              <ProductRanking
                warehouse={productRankingData?.warehouse || []}
                factory={productRankingData?.factory || []}
                loading={isLoadingRanking}
              />
            </div>
          </div>
        </div>
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
}: DashboardHeaderProps) {
  // 根据时间生成问候语
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 6) return '披星戴月，';
    if (hour < 9) return '早安，';
    if (hour < 12) return '上午好，';
    if (hour < 14) return '午安，';
    if (hour < 18) return '下午好，';
    return '晚安，';
  };

  const quickActions = [
    { label: '新建订单', action: onCreateOrder, icon: ShoppingCart },
    { label: '新建产品', action: onCreateProduct, icon: Package },
    { label: '新建客户', action: onCreateCustomer, icon: Users },
  ];

  return (
    <div className="flex flex-col gap-8 px-2 md:flex-row md:items-end md:justify-between">
      <div className="space-y-2">
        <h2 className="text-3xl font-black tracking-tighter text-slate-900">
          经营看板
        </h2>
        <p className="text-sm font-bold text-slate-400">
          {getGreeting()}{' '}
          <span className="text-slate-900">{userName || '管理员'}</span>
          。这是系统为您汇总的实时业务动态。
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        {/* 快捷操作按钮组 */}
        <div className="flex items-center gap-2 rounded-2xl bg-white p-1.5 shadow-sm ring-1 ring-slate-100">
          {quickActions.map(({ label, action, icon: Icon }) => (
            <Button
              key={label}
              size="sm"
              variant="ghost"
              className="h-10 rounded-xl px-4 font-bold text-slate-500 transition-all hover:bg-slate-900 hover:text-white active:scale-95"
              onClick={action}
            >
              <Icon className="mr-2 h-4 w-4" />
              {label}
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-2 rounded-2xl bg-white p-1.5 shadow-sm ring-1 ring-slate-100">
          <select
            value={selectedPeriod}
            onChange={e => onPeriodChange(e.target.value)}
            className="ring-offset-background focus:ring-slate-900 h-10 w-[120px] rounded-xl border-none bg-transparent px-3 py-2 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-offset-2 focus:outline-hidden"
            aria-label="时间范围"
          >
            <option value="1d">今天</option>
            <option value="7d">最近7天</option>
            <option value="30d">最近30天</option>
            <option value="90d">最近90天</option>
          </select>

          <div className="h-6 w-px bg-slate-100" />

          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-xl text-slate-400 hover:bg-slate-50 hover:text-slate-900"
            onClick={onRefresh}
            disabled={isRefreshing}
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
