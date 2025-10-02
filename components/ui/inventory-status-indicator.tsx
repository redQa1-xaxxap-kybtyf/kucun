// 库存状态指示器组件 - 瓷砖行业特色组件
// 用于显示库存状态、预警级别和库存健康度

import { cva, type VariantProps } from 'class-variance-authority';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Package,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import * as React from 'react';

import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

// 库存状态枚举
export type InventoryStatus =
  | 'in_stock' // 有库存
  | 'low_stock' // 库存不足
  | 'out_of_stock' // 缺货
  | 'overstock' // 库存过多
  | 'reserved' // 已预留
  | 'damaged' // 损坏
  | 'expired'; // 过期

// 库存预警级别
export type AlertLevel = 'safe' | 'warning' | 'danger' | 'critical';

// 库存状态指示器变体
const inventoryStatusVariants = cva(
  'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors',
  {
    variants: {
      status: {
        in_stock: 'bg-green-50 text-green-700 border border-green-200',
        low_stock: 'bg-yellow-50 text-yellow-700 border border-yellow-200',
        out_of_stock: 'bg-red-50 text-red-700 border border-red-200',
        overstock: 'bg-blue-50 text-blue-700 border border-blue-200',
        reserved: 'bg-purple-50 text-purple-700 border border-purple-200',
        damaged: 'bg-orange-50 text-orange-700 border border-orange-200',
        expired: 'bg-gray-50 text-gray-700 border border-gray-200',
      },
      size: {
        sm: 'text-xs px-1.5 py-0.5',
        default: 'text-xs px-2 py-1',
        lg: 'text-sm px-2.5 py-1.5',
      },
    },
    defaultVariants: {
      status: 'in_stock',
      size: 'default',
    },
  }
);

// 状态标签映射
const STATUS_LABELS: Record<InventoryStatus, string> = {
  in_stock: '有库存',
  low_stock: '库存不足',
  out_of_stock: '缺货',
  overstock: '库存过多',
  reserved: '已预留',
  damaged: '损坏',
  expired: '过期',
};

// 状态图标映射
const STATUS_ICONS: Record<
  InventoryStatus,
  React.ComponentType<{ className?: string }>
> = {
  in_stock: CheckCircle,
  low_stock: AlertTriangle,
  out_of_stock: XCircle,
  overstock: TrendingUp,
  reserved: Package,
  damaged: AlertCircle,
  expired: XCircle,
};

// 预警级别颜色映射
const ALERT_LEVEL_COLORS: Record<AlertLevel, string> = {
  safe: 'text-green-600',
  warning: 'text-yellow-600',
  danger: 'text-orange-600',
  critical: 'text-red-600',
};

export interface InventoryStatusIndicatorProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof inventoryStatusVariants> {
  status: InventoryStatus;
  currentStock?: number;
  safetyStock?: number;
  maxStock?: number;
  showQuantity?: boolean;
  showProgress?: boolean;
  alertLevel?: AlertLevel;
  customLabel?: string;
}

const InventoryStatusIndicator = React.forwardRef<
  HTMLDivElement,
  InventoryStatusIndicatorProps
>(
  (
    {
      className,
      status,
      size,
      currentStock,
      safetyStock,
      maxStock,
      showQuantity = false,
      showProgress = false,
      alertLevel,
      customLabel,
      ...props
    },
    ref
  ) => {
    const StatusIcon = STATUS_ICONS[status];
    const label = customLabel || STATUS_LABELS[status];

    // 计算库存百分比
    const stockPercentage = React.useMemo(() => {
      if (!currentStock || !maxStock) {return 0;}
      return Math.min((currentStock / maxStock) * 100, 100);
    }, [currentStock, maxStock]);

    // 自动计算预警级别
    const _calculatedAlertLevel = React.useMemo((): AlertLevel => {
      if (alertLevel) {return alertLevel;}

      if (!currentStock || !safetyStock) {
        return status === 'out_of_stock' ? 'critical' : 'safe';
      }

      const ratio = currentStock / safetyStock;
      if (ratio <= 0) {return 'critical';}
      if (ratio <= 0.5) {return 'danger';}
      if (ratio <= 1) {return 'warning';}
      return 'safe';
    }, [alertLevel, currentStock, safetyStock, status]);

    return (
      <div className={cn('space-y-2', className)} ref={ref} {...props}>
        {/* 状态标签 */}
        <div className={cn(inventoryStatusVariants({ status, size }))}>
          <StatusIcon className="h-3 w-3" />
          <span>{label}</span>
          {showQuantity && currentStock !== undefined && (
            <span className="font-mono">({currentStock})</span>
          )}
        </div>

        {/* 库存进度条 */}
        {showProgress && maxStock && currentStock !== undefined && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>库存量</span>
              <span>
                {currentStock} / {maxStock}
              </span>
            </div>
            <Progress
              value={stockPercentage}
              className="h-2"
              // 根据库存状态设置进度条颜色
              style={
                {
                  '--progress-background':
                    status === 'out_of_stock'
                      ? '#ef4444'
                      : status === 'low_stock'
                        ? '#f59e0b'
                        : status === 'overstock'
                          ? '#3b82f6'
                          : '#10b981',
                } as React.CSSProperties
              }
            />
            {safetyStock && (
              <div className="text-xs text-muted-foreground">
                安全库存: {safetyStock}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
);

InventoryStatusIndicator.displayName = 'InventoryStatusIndicator';

// 库存健康度组件
export interface InventoryHealthProps {
  items: Array<{
    id: string;
    name: string;
    currentStock: number;
    safetyStock: number;
    maxStock?: number;
    status: InventoryStatus;
  }>;
  className?: string;
}

const InventoryHealth = React.forwardRef<HTMLDivElement, InventoryHealthProps>(
  ({ items, className, ...props }, ref) => {
    // 计算健康度统计
    const healthStats = React.useMemo(() => {
      const total = items.length;
      const safe = items.filter(item => item.status === 'in_stock').length;
      const warning = items.filter(item => item.status === 'low_stock').length;
      const danger = items.filter(item =>
        ['out_of_stock', 'damaged', 'expired'].includes(item.status)
      ).length;

      return {
        total,
        safe,
        warning,
        danger,
        healthScore: total > 0 ? Math.round((safe / total) * 100) : 0,
      };
    }, [items]);

    return (
      <div className={cn('space-y-4', className)} ref={ref} {...props}>
        {/* 健康度总览 */}
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">库存健康度</h3>
          <div className="flex items-center gap-2">
            <div
              className={cn(
                'text-2xl font-bold',
                healthStats.healthScore >= 80
                  ? 'text-green-600'
                  : healthStats.healthScore >= 60
                    ? 'text-yellow-600'
                    : 'text-red-600'
              )}
            >
              {healthStats.healthScore}%
            </div>
            {healthStats.healthScore >= 80 ? (
              <CheckCircle className="h-5 w-5 text-green-600" />
            ) : healthStats.healthScore >= 60 ? (
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
            ) : (
              <XCircle className="h-5 w-5 text-red-600" />
            )}
          </div>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-lg border border-green-200 bg-green-50 p-3">
            <div className="mb-1 flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-xs font-medium text-green-700">正常</span>
            </div>
            <div className="text-lg font-bold text-green-700">
              {healthStats.safe}
            </div>
          </div>

          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3">
            <div className="mb-1 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <span className="text-xs font-medium text-yellow-700">预警</span>
            </div>
            <div className="text-lg font-bold text-yellow-700">
              {healthStats.warning}
            </div>
          </div>

          <div className="rounded-lg border border-red-200 bg-red-50 p-3">
            <div className="mb-1 flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-600" />
              <span className="text-xs font-medium text-red-700">异常</span>
            </div>
            <div className="text-lg font-bold text-red-700">
              {healthStats.danger}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="mb-1 flex items-center gap-2">
              <Package className="h-4 w-4 text-slate-600" />
              <span className="text-xs font-medium text-slate-700">总计</span>
            </div>
            <div className="text-lg font-bold text-slate-700">
              {healthStats.total}
            </div>
          </div>
        </div>

        {/* 健康度进度条 */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>整体健康度</span>
            <span>{healthStats.healthScore}%</span>
          </div>
          <Progress value={healthStats.healthScore} className="h-2" />
        </div>
      </div>
    );
  }
);

InventoryHealth.displayName = 'InventoryHealth';

// 快速状态切换器
export interface QuickStatusToggleProps {
  currentStatus: InventoryStatus;
  onStatusChange: (status: InventoryStatus) => void;
  availableStatuses?: InventoryStatus[];
  className?: string;
}

const QuickStatusToggle = React.forwardRef<
  HTMLDivElement,
  QuickStatusToggleProps
>(
  (
    {
      currentStatus,
      onStatusChange,
      availableStatuses = ['in_stock', 'low_stock', 'out_of_stock', 'reserved'],
      className,
      ...props
    },
    ref
  ) => (
    <div className={cn('flex flex-wrap gap-2', className)} ref={ref} {...props}>
      {availableStatuses.map(status => {
        const StatusIcon = STATUS_ICONS[status];
        const isActive = currentStatus === status;

        return (
          <button
            key={status}
            type="button"
            onClick={() => onStatusChange(status)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors',
              'hover:bg-accent hover:text-accent-foreground',
              'focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2',
              isActive
                ? inventoryStatusVariants({ status })
                : 'border border-border bg-background'
            )}
          >
            <StatusIcon className="h-3 w-3" />
            <span>{STATUS_LABELS[status]}</span>
          </button>
        );
      })}
    </div>
  )
);

QuickStatusToggle.displayName = 'QuickStatusToggle';

export {
  ALERT_LEVEL_COLORS,
  InventoryHealth,
  InventoryStatusIndicator,
  inventoryStatusVariants,
  QuickStatusToggle,
  STATUS_ICONS,
  STATUS_LABELS,
};
