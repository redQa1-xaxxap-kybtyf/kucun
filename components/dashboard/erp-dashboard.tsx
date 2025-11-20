'use client';

import {
  AlertCircle,
  Calendar,
  Eye,
  Package,
  Plus,
  RefreshCw,
  ShoppingCart,
  Users,
  Zap,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

import { FactoryShipments } from '@/components/dashboard/factory-shipments';
import { RecentOrders } from '@/components/dashboard/recent-orders';
import { StatCardsGrid } from '@/components/dashboard/stat-cards-enhanced';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useErpDashboardData } from '@/lib/hooks/useDashboardData';
import type {
  DashboardData,
  DashboardFactoryShipmentSummary,
  DashboardSalesOrderSummary,
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
    selectedPeriod,
    setSelectedPeriod,
    recentOrders,
    pendingOrders,
    factoryShipments,
    isLoadingOrders,
    isRefreshing,
    refreshData,
  } = useErpDashboardData({
    initialData,
    initialTimeRange,
    initialOrders,
  });

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

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* 左侧主内容区 */}
          <div className="space-y-6 lg:col-span-2">
            {/* 核心指标卡片 */}
            {dashboardApiData && (
              <StatCardsGrid overview={dashboardApiData} loading={false} />
            )}
            <DashboardOrdersSection
              recentOrders={recentOrders}
              factoryShipments={factoryShipments}
              isLoadingOrders={isLoadingOrders}
            />
          </div>

          {/* 右侧边栏 */}
          <div className="space-y-6 lg:col-span-1">
            <DashboardAttentionPanel
              lowStockItems={dashboardData.lowStockItems}
              pendingOrderCount={pendingOrders.length}
              onViewInventory={() => router.push('/inventory')}
              onViewOrders={() => router.push('/sales-orders')}
            />
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
  onManageInventory,
}: DashboardHeaderProps) {
  const quickActions = [
    { label: '新建订单', action: onCreateOrder, icon: ShoppingCart },
    { label: '新建产品', action: onCreateProduct, icon: Package },
    { label: '新建客户', action: onCreateCustomer, icon: Users },
    { label: '库存管理', action: onManageInventory, icon: Zap },
  ];

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">业务概览</h2>
        <p className="text-muted-foreground text-sm">
          欢迎回来，{userName || '用户'}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Calendar className="text-muted-foreground h-4 w-4" />
          <Select value={selectedPeriod} onValueChange={onPeriodChange}>
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
          onClick={onRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw
            className={cn('mr-2 h-4 w-4', isRefreshing && 'animate-spin')}
          />
          刷新
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              新建
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {quickActions.map(({ label, action, icon: Icon }) => (
              <DropdownMenuItem key={label} onClick={action}>
                <Icon className="mr-2 h-4 w-4" />
                {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

interface DashboardAttentionPanelProps {
  lowStockItems: number;
  pendingOrderCount: number;
  onViewInventory: () => void;
  onViewOrders: () => void;
}

function DashboardAttentionPanel({
  lowStockItems,
  pendingOrderCount,
  onViewInventory,
  onViewOrders,
}: DashboardAttentionPanelProps) {
  const attentionItems = [
    {
      title: '库存不足',
      value: `${lowStockItems} 个产品`,
      icon: Package,
      action: onViewInventory,
      color: 'text-warning',
      bgColor: 'bg-warning/10',
    },
    {
      title: '待处理订单',
      value: `${pendingOrderCount} 个订单`,
      icon: ShoppingCart,
      action: onViewOrders,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertCircle className="text-warning h-4 w-4" />
          <span>需要关注</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {attentionItems.map((item, index) => (
            <div
              key={index}
              className={cn(
                'flex items-center justify-between rounded-lg p-3',
                item.bgColor
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn('flex-shrink-0', item.color)}>
                  <item.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className={cn('text-sm font-semibold', item.color)}>
                    {item.title}
                  </p>
                  <p className="text-muted-foreground text-xs">{item.value}</p>
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className={cn('h-8', item.color)}
                onClick={item.action}
              >
                <Eye className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

interface DashboardOrdersSectionProps {
  recentOrders: DashboardSalesOrderSummary[];
  factoryShipments: DashboardFactoryShipmentSummary[];
  isLoadingOrders: boolean;
}

function DashboardOrdersSection({
  recentOrders,
  factoryShipments,
  isLoadingOrders,
}: DashboardOrdersSectionProps) {
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <RecentOrders
        orders={recentOrders.slice(0, 8)}
        loading={isLoadingOrders}
      />
      <FactoryShipments orders={factoryShipments} loading={isLoadingOrders} />
    </div>
  );
}
