'use client';

import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import * as React from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { PRODUCT_UNIT_LABELS } from '@/lib/config/product';
import type { Product } from '@/lib/types/product';
import { cn } from '@/lib/utils';
import { getProductAvailableQuantity } from '@/lib/utils/product-inventory';

interface InventoryItem {
  productId: string;
  quantity: number;
  batchNumber?: string;
}

interface InventoryCheckResult {
  productId: string;
  product?: Product;
  batchNumber?: string;
  requestedQuantity: number;
  availableQuantity: number;
  isAvailable: boolean;
  isLowStock: boolean;
  message: string;
  severity: 'success' | 'warning' | 'error';
}

interface InventoryCheckerProps {
  items: InventoryItem[];
  products: Product[];
  onInventoryCheck?: (results: InventoryCheckResult[]) => void;
  className?: string;
}

/**
 * 库存检查组件
 * 实时检查订单项的库存可用性
 */
export function InventoryChecker({
  items,
  products,
  onInventoryCheck,
  className,
}: InventoryCheckerProps) {
  const [checkResults, setCheckResults] = React.useState<
    InventoryCheckResult[]
  >([]);

  const normalizedItems = React.useMemo(
    () =>
      items.filter(item => item.productId?.trim() && (item.quantity ?? 0) > 0),
    [items]
  );

  // 执行库存检查
  const performInventoryCheck = React.useCallback(() => {
    if (normalizedItems.length === 0) {
      setCheckResults([]);
      onInventoryCheck?.([]);
      return;
    }

    const results = normalizedItems
      .map(item => {
        const requestedQuantity =
          typeof item.quantity === 'number'
            ? item.quantity
            : Number(item.quantity);

        if (!Number.isFinite(requestedQuantity) || requestedQuantity <= 0) {
          return null;
        }

        const product = products.find(p => p.id === item.productId);

        if (!product) {
          return {
            productId: item.productId,
            product: undefined,
            batchNumber: item.batchNumber,
            requestedQuantity,
            availableQuantity: 0,
            isAvailable: false,
            isLowStock: false,
            message: '产品不存在',
            severity: 'error' as const,
          };
        }

        const rawAvailable = getProductAvailableQuantity(
          product,
          item.batchNumber
        );
        if (rawAvailable === undefined || rawAvailable === null) {
          return null;
        }

        const availableQuantity = Number(rawAvailable);
        if (!Number.isFinite(availableQuantity)) {
          return null;
        }

        const isAvailable = availableQuantity >= requestedQuantity;
        const isLowStock = availableQuantity > 0 && availableQuantity <= 10;

        let message = '';
        let severity: 'success' | 'warning' | 'error' = 'success';

        // 系统内部统一使用"片"作为单位，避免单位混淆
        const unitLabel = '片';
        const batchLabel = item.batchNumber?.trim();

        if (!isAvailable) {
          message = batchLabel
            ? `批次 ${batchLabel} 库存不足！需要 ${requestedQuantity}${unitLabel}，可用 ${availableQuantity}${unitLabel}`
            : `库存不足！需要 ${requestedQuantity}${unitLabel}，可用 ${availableQuantity}${unitLabel}`;
          severity = 'error';
        } else if (isLowStock) {
          message = batchLabel
            ? `批次 ${batchLabel} 库存预警！剩余 ${availableQuantity}${unitLabel}`
            : `库存预警！剩余 ${availableQuantity}${unitLabel}`;
          severity = 'warning';
        } else {
          message = batchLabel
            ? `批次 ${batchLabel} 库存充足，剩余 ${availableQuantity}${unitLabel}`
            : `库存充足，剩余 ${availableQuantity}${unitLabel}`;
        }

        return {
          productId: item.productId,
          product,
          batchNumber: item.batchNumber,
          requestedQuantity,
          availableQuantity,
          isAvailable,
          isLowStock,
          message,
          severity,
        };
      })
      .filter(result => result !== null) as InventoryCheckResult[];

    setCheckResults(results);
    onInventoryCheck?.(results);
  }, [normalizedItems, products, onInventoryCheck]);

  // 当订单项或产品列表变化时重新检查
  React.useEffect(() => {
    if (normalizedItems.length > 0 && products.length > 0) {
      performInventoryCheck();
    } else if (normalizedItems.length === 0) {
      setCheckResults([]);
      onInventoryCheck?.([]);
    }
  }, [normalizedItems, products, performInventoryCheck, onInventoryCheck]);

  // 统计信息
  const stats = React.useMemo(() => {
    const total = checkResults.length;
    const available = checkResults.filter(r => r.isAvailable).length;
    const warnings = checkResults.filter(r => r.severity === 'warning').length;
    const errors = checkResults.filter(r => r.severity === 'error').length;

    return { total, available, warnings, errors };
  }, [checkResults]);

  if (normalizedItems.length === 0) {
    return null;
  }

  // 如果所有产品库存都充足，完全隐藏库存检查组件
  if (stats.errors === 0 && stats.warnings === 0) {
    return null;
  }

  // 显示详细的库存不足信息
  const errorItems = checkResults.filter(r => r.severity === 'error');
  const warningItems = checkResults.filter(r => r.severity === 'warning');

  return (
    <Alert
      variant={stats.errors > 0 ? 'destructive' : 'default'}
      className={className}
    >
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription>
        {stats.errors > 0 && (
          <div className="space-y-1">
            {errorItems.length === 1 ? (
              <div>
                产品 [{errorItems[0].product?.code || '未知编码'}]{' '}
                {errorItems[0].product?.name || '未知产品'}
                {errorItems[0].batchNumber
                  ? ` / 批次 ${errorItems[0].batchNumber}`
                  : ''}{' '}
                库存不足，当前库存：
                {errorItems[0].availableQuantity}片，需要：
                {errorItems[0].requestedQuantity}片，缺少：
                {errorItems[0].requestedQuantity -
                  errorItems[0].availableQuantity}
                片
              </div>
            ) : (
              <div>
                <div className="mb-1">
                  以下 {errorItems.length} 个产品库存不足：
                </div>
                <div className="space-y-0.5 text-sm">
                  {errorItems.map((item, index) => (
                    <div key={index}>
                      - [{item.product?.code || '未知编码'}]{' '}
                      {item.product?.name || '未知产品'}
                      {item.batchNumber ? ` / 批次 ${item.batchNumber}` : ''}：
                      当前库存 {item.availableQuantity}片，需要{' '}
                      {item.requestedQuantity}
                      片，缺少 {item.requestedQuantity - item.availableQuantity}
                      片
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        {stats.errors === 0 && stats.warnings > 0 && (
          <div className="space-y-1">
            {warningItems.length === 1 ? (
              <div>
                产品 [{warningItems[0].product?.code || '未知编码'}]{' '}
                {warningItems[0].product?.name || '未知产品'}
                {warningItems[0].batchNumber
                  ? ` / 批次 ${warningItems[0].batchNumber}`
                  : ''}{' '}
                库存偏低，当前库存：
                {warningItems[0].availableQuantity}
                {warningItems[0].product?.unit
                  ? PRODUCT_UNIT_LABELS[
                      warningItems[0].product
                        .unit as keyof typeof PRODUCT_UNIT_LABELS
                    ] || warningItems[0].product.unit
                  : '片'}
                ，建议及时补货
              </div>
            ) : (
              <div>
                <div className="mb-1">
                  以下 {warningItems.length} 个产品库存偏低，建议及时补货：
                </div>
                <div className="space-y-0.5 text-sm">
                  {warningItems.map((item, index) => (
                    <div key={index}>
                      - [{item.product?.code || '未知编码'}]{' '}
                      {item.product?.name || '未知产品'}
                      {item.batchNumber ? ` / 批次 ${item.batchNumber}` : ''}：
                      当前库存 {item.availableQuantity}
                      {item.product?.unit
                        ? PRODUCT_UNIT_LABELS[
                            item.product
                              .unit as keyof typeof PRODUCT_UNIT_LABELS
                          ] || item.product.unit
                        : '片'}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
}

/**
 * 单个库存检查项组件
 */
interface InventoryCheckItemProps {
  result: InventoryCheckResult;
}

function _InventoryCheckItem({ result }: InventoryCheckItemProps) {
  const getIcon = () => {
    switch (result.severity) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-orange-600" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-600" />;
    }
  };

  const _getProgressColor = () => {
    if (result.availableQuantity === 0) {
      return 'bg-red-500';
    }
    if (result.availableQuantity <= 10) {
      return 'bg-orange-500';
    }
    return 'bg-green-500';
  };

  const progressValue = result.product
    ? Math.min(
        (result.availableQuantity /
          Math.max(result.requestedQuantity, result.availableQuantity)) *
          100,
        100
      )
    : 0;

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg border p-3',
        result.severity === 'error' && 'border-red-200 bg-red-50',
        result.severity === 'warning' && 'border-orange-200 bg-orange-50',
        result.severity === 'success' && 'border-green-200 bg-green-50'
      )}
    >
      {getIcon()}

      <div className="flex-1 space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">
            {result.product?.name || '未知产品'}
          </span>
          <Badge variant="outline" className="text-xs">
            {result.product?.code}
          </Badge>
        </div>

        <div className="text-muted-foreground text-xs">
          需要: {result.requestedQuantity}
          {result.product?.unit} | 可用: {result.availableQuantity}
          {result.product?.unit}
        </div>

        {result.product && (
          <div className="flex items-center gap-2">
            <Progress value={progressValue} className="h-2 flex-1" />
            <span className="text-xs font-medium">
              {progressValue.toFixed(0)}%
            </span>
          </div>
        )}

        <div
          className={cn(
            'text-xs',
            result.severity === 'error' && 'text-red-700',
            result.severity === 'warning' && 'text-orange-700',
            result.severity === 'success' && 'text-green-700'
          )}
        >
          {result.message}
        </div>
      </div>
    </div>
  );
}

/**
 * 简化的库存状态指示器
 */
interface InventoryStatusProps {
  product: Product;
  requestedQuantity: number;
  batchNumber?: string;
  className?: string;
}

export function InventoryStatus({
  product,
  requestedQuantity,
  batchNumber,
  className,
}: InventoryStatusProps) {
  const availableQuantity =
    getProductAvailableQuantity(product, batchNumber) ?? 0;
  const isAvailable = availableQuantity >= requestedQuantity;
  const isLowStock = availableQuantity > 0 && availableQuantity <= 10;

  if (!isAvailable) {
    return (
      <Badge variant="destructive" className={className}>
        库存不足
      </Badge>
    );
  }

  if (isLowStock) {
    return (
      <Badge
        variant="secondary"
        className={cn('text-[hsl(var(--color-warning))]', className)}
      >
        库存预警
      </Badge>
    );
  }

  return (
    <Badge
      className={cn(
        'bg-[hsl(var(--color-success-light))] text-[hsl(var(--color-success))]',
        className
      )}
    >
      库存充足
    </Badge>
  );
}
