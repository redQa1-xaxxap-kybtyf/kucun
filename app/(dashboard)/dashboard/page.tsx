// 仪表盘主页面
// 基于shadcn/ui组件库的完整仪表盘实现
// 严格遵循全栈开发执行手册和项目统一约定规范

'use client';

import {
  RefreshCw,
  Calendar,
  TrendingUp,
  BarChart3,
  AlertCircle,
  CheckSquare,
  Zap,
  Package,
  ShoppingCart,
  Users,
  CreditCard,
  ArrowUpRight,
  ArrowDownRight,
  Eye,
  Plus,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import * as React from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

/**
 * 仪表盘数据类型定义
 */
interface DashboardStats {
  totalProducts: number;
  totalOrders: number;
  totalCustomers: number;
  totalRevenue: number;
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
 * 仪表盘主页面组件
 * 提供业务概览、统计数据、快速操作等功能
 */
export default function DashboardPage() {
  const { data: session } = useSession();
  const router = useRouter();

  // 数据状态
  const [dashboardData, setDashboardData] =
    React.useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [selectedPeriod, setSelectedPeriod] = React.useState('7d');
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  // 模拟数据
  const mockData: DashboardStats = {
    totalProducts: 156,
    totalOrders: 89,
    totalCustomers: 45,
    totalRevenue: 125600,
    lowStockItems: 8,
    pendingOrders: 12,
    recentActivities: [
      {
        id: '1',
        type: 'order',
        title: '新订单 #SO-2024-001',
        description: '客户张三下单，金额 ¥2,500',
        timestamp: new Date(Date.now() - 1000 * 60 * 30),
        status: 'success',
      },
      {
        id: '2',
        type: 'inventory',
        title: '库存预警',
        description: '白色瓷砖 W001 库存不足',
        timestamp: new Date(Date.now() - 1000 * 60 * 60),
        status: 'warning',
      },
      {
        id: '3',
        type: 'customer',
        title: '新客户注册',
        description: '李四装饰公司完成注册',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
        status: 'info',
      },
    ],
    salesTrend: [
      { date: '2024-01-01', sales: 12500, orders: 15 },
      { date: '2024-01-02', sales: 15600, orders: 18 },
      { date: '2024-01-03', sales: 13200, orders: 16 },
      { date: '2024-01-04', sales: 18900, orders: 22 },
      { date: '2024-01-05', sales: 16700, orders: 19 },
      { date: '2024-01-06', sales: 21300, orders: 25 },
      { date: '2024-01-07', sales: 19800, orders: 23 },
    ],
  };

  // 加载数据
  const loadDashboardData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      // 模拟API调用
      await new Promise(resolve => setTimeout(resolve, 1000));
      setDashboardData(mockData);
    } catch (error) {
      console.error('加载仪表盘数据失败:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 刷新数据
  const refreshData = async () => {
    setIsRefreshing(true);
    await loadDashboardData();
    setIsRefreshing(false);
  };

  // 初始化加载
  React.useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData, selectedPeriod]);

  // 格式化货币
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: 'CNY',
    }).format(amount);

  // 格式化时间
  const formatTime = (date: Date) =>
    new Intl.RelativeTimeFormat('zh-CN', { numeric: 'auto' }).format(
      Math.floor((date.getTime() - Date.now()) / (1000 * 60)),
      'minute'
    );

  // 获取活动图标
  const getActivityIcon = (type: Activity['type']) => {
    switch (type) {
      case 'order':
        return <ShoppingCart className="h-4 w-4" />;
      case 'inventory':
        return <Package className="h-4 w-4" />;
      case 'customer':
        return <Users className="h-4 w-4" />;
      case 'payment':
        return <CreditCard className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
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

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (!dashboardData) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          加载仪表盘数据失败，请刷新页面重试。
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* 页面标题和操作 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">仪表盘</h1>
          <p className="text-muted-foreground">
            欢迎回来，{session?.user?.name || '用户'}！这是您的业务概览。
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1d">今天</SelectItem>
              <SelectItem value="7d">7天</SelectItem>
              <SelectItem value="30d">30天</SelectItem>
              <SelectItem value="90d">90天</SelectItem>
            </SelectContent>
          </Select>

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

      {/* 统计卡片 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总产品数</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dashboardData.totalProducts}
            </div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600">+12%</span> 较上月
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总订单数</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dashboardData.totalOrders}
            </div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600">+8%</span> 较上月
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">客户总数</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dashboardData.totalCustomers}
            </div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600">+15%</span> 较上月
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总收入</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(dashboardData.totalRevenue)}
            </div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600">+23%</span> 较上月
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 主要内容区域 */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* 左侧：图表和趋势 */}
        <div className="space-y-6 lg:col-span-2">
          {/* 销售趋势图 */}
          <Card>
            <CardHeader>
              <CardTitle>销售趋势</CardTitle>
              <CardDescription>过去7天的销售数据和订单趋势</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex h-64 items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <BarChart3 className="mx-auto mb-4 h-12 w-12" />
                  <p>图表组件将在后续集成</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 快速操作 */}
          <Card>
            <CardHeader>
              <CardTitle>快速操作</CardTitle>
              <CardDescription>常用功能的快速入口</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <Button
                  variant="outline"
                  className="h-20 flex-col space-y-2"
                  onClick={() => router.push('/products/create')}
                >
                  <Plus className="h-6 w-6" />
                  <span>新建产品</span>
                </Button>

                <Button
                  variant="outline"
                  className="h-20 flex-col space-y-2"
                  onClick={() => router.push('/sales-orders/create')}
                >
                  <ShoppingCart className="h-6 w-6" />
                  <span>新建订单</span>
                </Button>

                <Button
                  variant="outline"
                  className="h-20 flex-col space-y-2"
                  onClick={() => router.push('/customers/create')}
                >
                  <Users className="h-6 w-6" />
                  <span>新建客户</span>
                </Button>

                <Button
                  variant="outline"
                  className="h-20 flex-col space-y-2"
                  onClick={() => router.push('/inventory')}
                >
                  <Package className="h-6 w-6" />
                  <span>库存管理</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 右侧：活动和警告 */}
        <div className="space-y-6">
          {/* 警告和提醒 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <AlertCircle className="mr-2 h-5 w-5 text-yellow-600" />
                需要关注
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">库存不足</p>
                  <p className="text-sm text-muted-foreground">
                    {dashboardData.lowStockItems} 个产品库存不足
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => router.push('/inventory')}
                >
                  <Eye className="mr-2 h-4 w-4" />
                  查看
                </Button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">待处理订单</p>
                  <p className="text-sm text-muted-foreground">
                    {dashboardData.pendingOrders} 个订单待处理
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => router.push('/sales-orders')}
                >
                  <Eye className="mr-2 h-4 w-4" />
                  查看
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 最近活动 */}
          <Card>
            <CardHeader>
              <CardTitle>最近活动</CardTitle>
              <CardDescription>系统中的最新动态</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {dashboardData.recentActivities.map(activity => (
                  <div key={activity.id} className="flex items-start space-x-3">
                    <div
                      className={cn('mt-1', getStatusColor(activity.status))}
                    >
                      {getActivityIcon(activity.type)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{activity.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {activity.description}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatTime(activity.timestamp)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

/**
 * 仪表盘加载骨架屏
 */
function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="flex space-x-2">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-20" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="mb-2 h-8 w-16" />
              <Skeleton className="h-3 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-4 w-48" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-24" />
            </CardHeader>
            <CardContent className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-start space-x-3">
                  <Skeleton className="mt-1 h-4 w-4" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
