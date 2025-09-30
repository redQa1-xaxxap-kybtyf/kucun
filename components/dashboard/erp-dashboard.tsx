'use client';

import {
  AlertCircle,
  Calendar,
  CreditCard,
  Eye,
  Package,
  RefreshCw,
  RotateCcw,
  ShoppingCart,
  Users,
  Zap,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useBusinessOverview } from '@/lib/api/dashboard';
import type { BusinessOverview, TimeRange } from '@/lib/types/dashboard';
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
 */
interface ERPDashboardProps {
  initialData?: DashboardData | null;
  initialTimeRange?: string;
}

export function ERPDashboard({
  initialData,
  initialTimeRange = '7d',
}: ERPDashboardProps) {
  const { data: session } = useSession();
  const router = useRouter();

  // 数据状态 - 延迟初始化以避免函数声明顺序问题
  const [dashboardData, setDashboardData] =
    React.useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = React.useState(!initialData);
  const [selectedPeriod, setSelectedPeriod] = React.useState(initialTimeRange);
  const [isRefreshing, setIsRefreshing] = React.useState(false);

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

  // 使用真实API获取仪表盘数据
  const {
    data: dashboardApiData,
    isLoading: isApiLoading,
    refetch,
  } = useBusinessOverview(mapPeriodToTimeRange(selectedPeriod));

  // 加载数据 - 完全使用真实API数据
  const loadDashboardData = React.useCallback(async () => {
    setIsLoading(true);
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
    } finally {
      setIsLoading(false);
    }
  }, [dashboardApiData]);

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
    } catch (error) {
      console.error('刷新仪表盘数据失败:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // 处理初始数据
  React.useEffect(() => {
    if (initialData?.overview && !dashboardData) {
      const transformedData = transformDashboardData(initialData.overview);
      setDashboardData(transformedData);
      setIsLoading(false);
    }
  }, [initialData, dashboardData]);

  // 初始化加载 - 结合API加载状态
  React.useEffect(() => {
    if (!isApiLoading && !initialData) {
      loadDashboardData();
    }
  }, [loadDashboardData, selectedPeriod, isApiLoading, initialData]);

  // 合并加载状态
  const isLoadingData = isLoading || isApiLoading;

  // 格式化货币
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: 'CNY',
    }).format(amount);

  // 格式化时间
  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));

    if (minutes < 60) {
      return `${minutes}分钟前`;
    } else if (hours < 24) {
      return `${hours}小时前`;
    } else {
      return date.toLocaleDateString('zh-CN');
    }
  };

  // 获取活动图标
  const getActivityIcon = (type: Activity['type']) => {
    switch (type) {
      case 'order':
        return <ShoppingCart className="h-3 w-3" />;
      case 'inventory':
        return <Package className="h-3 w-3" />;
      case 'customer':
        return <Users className="h-3 w-3" />;
      case 'payment':
        return <CreditCard className="h-3 w-3" />;
      default:
        return <AlertCircle className="h-3 w-3" />;
    }
  };

  // 获取状态颜色
  const getStatusColor = (status: Activity['status']) => {
    switch (status) {
      case 'success':
        return 'text-green-600';
      case 'warning':
        return 'text-yellow-600';
      case 'error':
        return 'text-red-600';
      case 'info':
        return 'text-blue-600';
      default:
        return 'text-muted-foreground';
    }
  };

  if (isLoadingData) {
    return (
      <div className="rounded border bg-card">
        <div className="border-b bg-muted/30 px-3 py-2">
          <h3 className="text-sm font-medium">业务概览</h3>
        </div>
        <div className="px-3 py-8">
          <div className="text-center text-xs text-muted-foreground">
            正在加载数据...
          </div>
        </div>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="rounded border bg-card">
        <div className="border-b bg-muted/30 px-3 py-2">
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
    <div className="space-y-4">
      {/* 欢迎信息和操作栏 */}
      <div className="rounded border bg-card">
        <div className="border-b bg-muted/30 px-3 py-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">业务概览</h3>
            <div className="text-xs text-muted-foreground">
              欢迎回来，{session?.user?.name || '用户'}
            </div>
          </div>
        </div>
        <div className="border-b bg-muted/10 px-3 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">数据周期</span>
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger className="h-6 w-20 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1d">今天</SelectItem>
                  <SelectItem value="7d">7天</SelectItem>
                  <SelectItem value="30d">30天</SelectItem>
                  <SelectItem value="90d">90天</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-6"
                onClick={refreshData}
                disabled={isRefreshing}
              >
                <RefreshCw
                  className={cn('mr-1 h-3 w-3', isRefreshing && 'animate-spin')}
                />
                刷新
              </Button>
            </div>
          </div>
        </div>

        {/* 统计数据 */}
        <div className="border-b bg-muted/5 px-3 py-1">
          <div className="text-xs text-muted-foreground">核心指标</div>
        </div>
        <div className="px-3 py-3">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                <ShoppingCart className="h-3 w-3" />
                销售单总数
              </div>
              <div className="mt-1 text-lg font-bold">
                {dashboardData.totalOrders}
              </div>
              {dashboardApiData?.sales?.ordersGrowth !== undefined && (
                <div
                  className={cn(
                    'text-xs',
                    dashboardApiData.sales.ordersGrowth >= 0
                      ? 'text-green-600'
                      : 'text-red-600'
                  )}
                >
                  {dashboardApiData.sales.ordersGrowth >= 0 ? '+' : ''}
                  {dashboardApiData.sales.ordersGrowth.toFixed(1)}%
                </div>
              )}
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                <Package className="h-3 w-3" />
                产品总数
              </div>
              <div className="mt-1 text-lg font-bold">
                {dashboardData.totalProducts}
              </div>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                <RotateCcw className="h-3 w-3" />
                退货订单
              </div>
              <div className="mt-1 text-lg font-bold">
                {dashboardData.totalReturns}
              </div>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                <Users className="h-3 w-3" />
                客户总数
              </div>
              <div className="mt-1 text-lg font-bold">
                {dashboardData.totalCustomers}
              </div>
              {dashboardApiData?.customers?.customerGrowth !== undefined && (
                <div
                  className={cn(
                    'text-xs',
                    dashboardApiData.customers.customerGrowth >= 0
                      ? 'text-green-600'
                      : 'text-red-600'
                  )}
                >
                  {dashboardApiData.customers.customerGrowth >= 0 ? '+' : ''}
                  {dashboardApiData.customers.customerGrowth.toFixed(1)}%
                </div>
              )}
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                <CreditCard className="h-3 w-3" />
                总收入
              </div>
              <div className="mt-1 text-lg font-bold">
                {formatCurrency(dashboardData.totalRevenue)}
              </div>
              {dashboardApiData?.sales?.revenueGrowth !== undefined && (
                <div
                  className={cn(
                    'text-xs',
                    dashboardApiData.sales.revenueGrowth >= 0
                      ? 'text-green-600'
                      : 'text-red-600'
                  )}
                >
                  {dashboardApiData.sales.revenueGrowth >= 0 ? '+' : ''}
                  {dashboardApiData.sales.revenueGrowth.toFixed(1)}%
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 快速操作和警告信息 */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* 快速操作 */}
        <div className="rounded border bg-card">
          <div className="border-b bg-muted/30 px-3 py-2">
            <h3 className="text-sm font-medium">快速操作</h3>
          </div>
          <div className="px-3 py-3">
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-12 flex-col gap-1"
                onClick={() => router.push('/products/create')}
              >
                <Package className="h-4 w-4" />
                <span className="text-xs">新建产品</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-12 flex-col gap-1"
                onClick={() => router.push('/sales-orders/create')}
              >
                <ShoppingCart className="h-4 w-4" />
                <span className="text-xs">新建订单</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-12 flex-col gap-1"
                onClick={() => router.push('/customers/create')}
              >
                <Users className="h-4 w-4" />
                <span className="text-xs">新建客户</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-12 flex-col gap-1"
                onClick={() => router.push('/inventory')}
              >
                <Zap className="h-4 w-4" />
                <span className="text-xs">库存管理</span>
              </Button>
            </div>
          </div>
        </div>

        {/* 需要关注 */}
        <div className="rounded border bg-card">
          <div className="border-b bg-muted/30 px-3 py-2">
            <div className="flex items-center gap-1">
              <AlertCircle className="h-3 w-3 text-yellow-600" />
              <h3 className="text-sm font-medium">需要关注</h3>
            </div>
          </div>
          <div className="px-3 py-3">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-medium">库存不足</div>
                  <div className="text-xs text-muted-foreground">
                    {dashboardData.lowStockItems} 个产品库存不足
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6"
                  onClick={() => router.push('/inventory')}
                >
                  <Eye className="mr-1 h-3 w-3" />
                  查看
                </Button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-medium">待处理订单</div>
                  <div className="text-xs text-muted-foreground">
                    {dashboardData.pendingOrders} 个订单待处理
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6"
                  onClick={() => router.push('/sales-orders')}
                >
                  <Eye className="mr-1 h-3 w-3" />
                  查看
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 最近活动 */}
      <div className="rounded border bg-card">
        <div className="border-b bg-muted/30 px-3 py-2">
          <h3 className="text-sm font-medium">最近活动</h3>
        </div>
        <div className="border-b bg-muted/5 px-3 py-1">
          <div className="text-xs text-muted-foreground">系统动态</div>
        </div>
        <div className="px-3 py-3">
          <div className="space-y-2">
            {dashboardData.recentActivities.map(activity => (
              <div key={activity.id} className="flex items-start gap-2 text-xs">
                <div className={cn('mt-0.5', getStatusColor(activity.status))}>
                  {getActivityIcon(activity.type)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{activity.title}</div>
                  <div className="text-muted-foreground">
                    {activity.description}
                  </div>
                  <div className="mt-1 text-muted-foreground">
                    {formatTime(activity.timestamp)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
