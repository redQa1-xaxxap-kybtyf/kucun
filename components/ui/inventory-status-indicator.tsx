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
        in_stock:
          'border border-[hsl(var(--color-success))] bg-[hsl(var(--color-success-light))] text-[hsl(var(--color-success))]',
        low_stock:
          'border border-[hsl(var(--color-warning))] bg-[hsl(var(--color-warning-light))] text-[hsl(var(--color-warning))]',
        out_of_stock:
          'border border-[hsl(var(--color-error))] bg-[hsl(var(--color-error-light))] text-[hsl(var(--color-error))]',
        overstock:
          'border border-[hsl(var(--color-info))] bg-[hsl(var(--color-info-light))] text-[hsl(var(--color-info))]',
        reserved:
          'border border-[hsl(var(--color-purple))] bg-[hsl(var(--color-purple-light))] text-[hsl(var(--color-purple))]',
        damaged:
          'border border-[hsl(var(--color-error))] bg-[hsl(var(--color-error-light))] text-[hsl(var(--color-error))]',
        expired:
          'border border-[hsl(var(--color-border-secondary))] bg-[hsl(var(--color-bg-tertiary))] text-[hsl(var(--color-text-secondary))]',
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

const STATUS_PROGRESS_INDICATOR_CLASSES: Record<InventoryStatus, string> = {
  in_stock: 'bg-[hsl(var(--color-success))]',
  low_stock: 'bg-[hsl(var(--color-warning))]',
  out_of_stock: 'bg-[hsl(var(--color-error))]',
  overstock: 'bg-[hsl(var(--color-info))]',
  reserved: 'bg-[hsl(var(--color-purple))]',
  damaged: 'bg-[hsl(var(--color-error-hover))]',
  expired: 'bg-[hsl(var(--color-border-strong))]',
};

// 预警级别颜色映射
const ALERT_LEVEL_COLORS: Record<AlertLevel, string> = {
  safe: 'text-[hsl(var(--color-success))]',
  warning: 'text-[hsl(var(--color-warning))]',
  danger: 'text-[hsl(var(--color-error-hover))]',
  critical: 'text-[hsl(var(--color-error))]',
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
      if (!currentStock || !maxStock) {
        return 0;
      }
      return Math.min((currentStock / maxStock) * 100, 100);
    }, [currentStock, maxStock]);

    // 自动计算预警级别
    const _calculatedAlertLevel = React.useMemo((): AlertLevel => {
      if (alertLevel) {
        return alertLevel;
      }

      if (!currentStock || !safetyStock) {
        return status === 'out_of_stock' ? 'critical' : 'safe';
      }

      const ratio = currentStock / safetyStock;
      if (ratio <= 0) {
        return 'critical';
      }
      if (ratio <= 0.5) {
        return 'danger';
      }
      if (ratio <= 1) {
        return 'warning';
      }
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
            <div className="text-muted-foreground flex justify-between text-xs">
              <span>库存量</span>
              <span>
                {currentStock} / {maxStock}
              </span>
            </div>
            <Progress
              value={stockPercentage}
              className="h-2"
              indicatorClassName={STATUS_PROGRESS_INDICATOR_CLASSES[status]}
            />
            {safetyStock && (
              <div className="text-muted-foreground text-xs">
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

    const healthScoreColorClass =
      healthStats.healthScore >= 80
        ? 'text-[hsl(var(--color-success))]'
        : healthStats.healthScore >= 60
          ? 'text-[hsl(var(--color-warning))]'
          : 'text-[hsl(var(--color-error))]';

    return (
      <div className={cn('space-y-4', className)} ref={ref} {...props}>
        {/* 健康度总览 */}
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">库存健康度</h3>
          <div className="flex items-center gap-2">
            <div className={cn('text-2xl font-bold', healthScoreColorClass)}>
              {healthStats.healthScore}%
            </div>
            {healthStats.healthScore >= 80 ? (
              <CheckCircle className={cn('h-5 w-5', healthScoreColorClass)} />
            ) : healthStats.healthScore >= 60 ? (
              <AlertTriangle className={cn('h-5 w-5', healthScoreColorClass)} />
            ) : (
              <XCircle className={cn('h-5 w-5', healthScoreColorClass)} />
            )}
          </div>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-lg border border-[hsl(var(--color-success))] bg-[hsl(var(--color-success-light))] p-3">
            <div className="mb-1 flex items-center gap-2 text-[hsl(var(--color-success))]">
              <CheckCircle className="h-4 w-4" />
              <span className="text-xs font-medium">正常</span>
            </div>
            <div className="text-lg font-bold text-[hsl(var(--color-success))]">
              {healthStats.safe}
            </div>
          </div>

          <div className="rounded-lg border border-[hsl(var(--color-warning))] bg-[hsl(var(--color-warning-light))] p-3">
            <div className="mb-1 flex items-center gap-2 text-[hsl(var(--color-warning))]">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-xs font-medium">预警</span>
            </div>
            <div className="text-lg font-bold text-[hsl(var(--color-warning))]">
              {healthStats.warning}
            </div>
          </div>

          <div className="rounded-lg border border-[hsl(var(--color-error))] bg-[hsl(var(--color-error-light))] p-3">
            <div className="mb-1 flex items-center gap-2 text-[hsl(var(--color-error))]">
              <XCircle className="h-4 w-4" />
              <span className="text-xs font-medium">异常</span>
            </div>
            <div className="text-lg font-bold text-[hsl(var(--color-error))]">
              {healthStats.danger}
            </div>
          </div>

          <div className="rounded-lg border border-[hsl(var(--color-border-secondary))] bg-[hsl(var(--color-bg-tertiary))] p-3">
            <div className="mb-1 flex items-center gap-2 text-[hsl(var(--color-text-secondary))]">
              <Package className="h-4 w-4" />
              <span className="text-xs font-medium">总计</span>
            </div>
            <div className="text-lg font-bold text-[hsl(var(--color-text-primary))]">
              {healthStats.total}
            </div>
          </div>
        </div>

        {/* 健康度进度条 */}
        <div className="space-y-2">
          <div className="text-muted-foreground flex justify-between text-xs">
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
              'focus:ring-ring focus:ring-2 focus:ring-offset-2 focus:outline-hidden',
              isActive
                ? inventoryStatusVariants({ status })
                : 'border-border bg-background border'
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
