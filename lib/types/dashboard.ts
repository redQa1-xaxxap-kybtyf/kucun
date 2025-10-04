// 仪表盘数据类型定义
// 定义仪表盘所需的所有数据结构和接口

// 业务概览数据
export interface BusinessOverview {
  // 销售数据
  sales: {
    totalRevenue: number; // 总收入
    monthlyRevenue: number; // 月收入
    totalOrders: number; // 总订单数
    monthlyOrders: number; // 月订单数
    averageOrderValue: number; // 平均订单价值
    revenueGrowth: number; // 收入增长率 (%)
    ordersGrowth: number; // 订单增长率 (%)
  };

  // 库存数据
  inventory: {
    totalProducts: number; // 总产品数
    totalStock: number; // 总库存数量
    lowStockCount: number; // 库存不足数量
    outOfStockCount: number; // 缺货数量
    inventoryValue: number; // 库存价值
    turnoverRate: number; // 库存周转率
    stockHealth: number; // 库存健康度 (0-100)
    productGrowth: number; // 产品增长率 (%)
  };

  // 退货数据
  returns: {
    totalReturns: number; // 总退货数
    monthlyReturns: number; // 月退货数
    returnRate: number; // 退货率 (%)
    returnValue: number; // 退货金额
    pendingReturns: number; // 待处理退货数
  };

  // 客户数据
  customers: {
    totalCustomers: number; // 总客户数
    activeCustomers: number; // 活跃客户数
    newCustomers: number; // 新客户数
    customerGrowth: number; // 客户增长率 (%)
  };
}

// 库存预警数据
export interface InventoryAlert {
  id: string;
  productId: string;
  productName: string;
  productCode: string;
  colorCode?: string;
  currentStock: number;
  safetyStock: number;
  alertLevel: 'warning' | 'danger' | 'critical';
  alertType: 'low_stock' | 'out_of_stock' | 'overstock' | 'expired';
  lastUpdated: string;
  daysUntilStockout?: number; // 预计缺货天数
  suggestedAction: string; // 建议操作
}

// 待办事项数据
export interface TodoItem {
  id: string;
  type:
    | 'sales_order'
    | 'return_order'
    | 'inventory_alert'
    | 'customer_follow_up';
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dueDate?: string;
  relatedId?: string; // 关联的业务对象ID
  status: 'pending' | 'in_progress' | 'completed';
  createdAt: string;
  assignedTo?: string; // 分配给的用户ID
}

// 图表数据点
export interface ChartDataPoint {
  date: string;
  value: number;
  label?: string;
  category?: string;
}

// 销售趋势数据
export interface SalesTrendData {
  daily: ChartDataPoint[]; // 日销售数据
  weekly: ChartDataPoint[]; // 周销售数据
  monthly: ChartDataPoint[]; // 月销售数据
  yearly: ChartDataPoint[]; // 年销售数据
}

// 库存趋势数据
export interface InventoryTrendData {
  stockLevels: ChartDataPoint[]; // 库存水平变化
  stockMovements: ChartDataPoint[]; // 库存流动
  categoryDistribution: {
    // 分类分布
    category: string;
    value: number;
    percentage: number;
  }[];
}

// 产品销售排行
export interface ProductSalesRanking {
  productId: string;
  productName: string;
  productCode: string;
  colorCode?: string;
  salesQuantity: number;
  salesValue: number;
  rank: number;
  growth: number; // 增长率
}

// 客户销售排行
export interface CustomerSalesRanking {
  customerId: string;
  customerName: string;
  salesValue: number;
  orderCount: number;
  rank: number;
  lastOrderDate: string;
}

// 快速操作项
export interface QuickAction {
  id: string;
  title: string;
  description: string;
  icon: string; // 图标名称
  href: string; // 跳转链接
  color:
    | 'blue'
    | 'green'
    | 'yellow'
    | 'red'
    | 'purple'
    | 'gray'
    | 'orange'
    | 'indigo';
  requiresPermission?: string; // 需要的权限
  badge?: {
    // 徽章显示
    text: string;
    variant: 'default' | 'secondary' | 'destructive' | 'outline';
  };
}

// 仪表盘配置
export interface DashboardConfig {
  refreshInterval: number; // 刷新间隔（秒）
  showAlerts: boolean; // 是否显示预警
  showTodos: boolean; // 是否显示待办事项
  showCharts: boolean; // 是否显示图表
  showQuickActions: boolean; // 是否显示快速操作
  layout: 'grid' | 'list'; // 布局方式
  theme: 'light' | 'dark'; // 主题
}

// 仪表盘完整数据
export interface DashboardData {
  overview: BusinessOverview;
  alerts: InventoryAlert[];
  todos: TodoItem[];
  salesTrend: SalesTrendData;
  inventoryTrend: InventoryTrendData;
  productRanking: ProductSalesRanking[];
  customerRanking: CustomerSalesRanking[];
  quickActions: QuickAction[];
  config: DashboardConfig;
  lastUpdated: string;
}

// API响应类型
export interface DashboardApiResponse {
  success: boolean;
  data: DashboardData;
  error?: string;
}

// 仪表盘统计卡片数据
export interface StatCard {
  title: string;
  value: string | number;
  change?: {
    value: number;
    type: 'increase' | 'decrease' | 'neutral';
    period: string;
  };
  icon: string;
  color:
    | 'blue'
    | 'green'
    | 'yellow'
    | 'red'
    | 'purple'
    | 'gray'
    | 'orange'
    | 'indigo';
  href?: string;
}

// 图表配置
export interface ChartConfig {
  type: 'line' | 'bar' | 'pie' | 'doughnut' | 'area';
  title: string;
  data: ChartDataPoint[];
  options?: {
    showLegend?: boolean;
    showGrid?: boolean;
    showTooltip?: boolean;
    height?: number;
    colors?: string[];
  };
}

// 仪表盘小部件
export interface DashboardWidget {
  id: string;
  type: 'stat' | 'chart' | 'list' | 'alert' | 'todo' | 'quick_action';
  title: string;
  size: 'sm' | 'md' | 'lg' | 'xl';
  position: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  config: Record<string, unknown>; // 小部件特定配置
  visible: boolean;
  refreshable: boolean;
}

// 时间范围选择
export type TimeRange = '1d' | '7d' | '30d' | '90d' | '1y' | 'all';

// 仪表盘筛选器
export interface DashboardFilters {
  timeRange: TimeRange;
  productCategory?: string;
  customerType?: string;
  salesChannel?: string;
  region?: string;
}

// 导出类型 - 移除重复导出以避免冲突

// 工具函数类型
export interface DashboardUtils {
  formatCurrency: (amount: number) => string;
  formatNumber: (num: number) => string;
  formatPercentage: (percent: number) => string;
  calculateGrowth: (current: number, previous: number) => number;
  getAlertColor: (level: InventoryAlert['alertLevel']) => string;
  getPriorityColor: (priority: TodoItem['priority']) => string;
  formatTimeAgo: (date: string) => string;
}
