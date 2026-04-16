'use client';

import { useQuery } from '@tanstack/react-query';
import { ChevronDown, Package, Plus, Search, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useSalesOrderReturnableItems } from '@/lib/api/return-orders';
import { getSalesOrders, salesOrderQueryKeys } from '@/lib/api/sales-orders';
import type { ReturnableItem } from '@/lib/services/sales-order-service';
import type { ReturnOrderItem } from '@/lib/types/return-order';
import type { SalesOrder } from '@/lib/types/sales-order';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/utils/datetime';
import { formatDetailedPieceSummary } from '@/lib/utils/piece-calculation';

interface MultiOrderItemSelectorProps {
  customerId: string;
  onItemSelect: (
    item: Pick<
      ReturnOrderItem,
      | 'salesOrderItemId'
      | 'productId'
      | 'colorCode'
      | 'productionDate'
      | 'returnQuantity'
      | 'originalQuantity'
      | 'unitPrice'
      | 'subtotal'
      | 'reason'
      | 'condition'
    > & {
      productInfo: {
        name: string;
        code: string;
        unit: string;
        specification: string | null;
        batchNumber?: string | null;
      };
      salesOrderNumber: string;
    }
  ) => void;
  selectedItems: string[];
}

export function MultiOrderItemSelector({
  customerId,
  onItemSelect,
  selectedItems,
}: MultiOrderItemSelectorProps) {
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [globalSearch, setGlobalSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // 防抖处理搜索词（300ms）
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(globalSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [globalSearch]);

  // 使用防抖后的搜索词调用后端API
  const { data: salesOrdersData, isLoading: isLoadingOrders } = useQuery({
    queryKey: salesOrderQueryKeys.list({
      page: 1,
      limit: 50, // 减少每次加载数量
      customerId,
      search: debouncedSearch || undefined, // 传递搜索词给后端
    }),
    queryFn: () =>
      getSalesOrders({
        page: 1,
        limit: 50,
        customerId,
        search: debouncedSearch || undefined,
      }),
    enabled: Boolean(customerId),
  });

  const salesOrders = Array.isArray(salesOrdersData?.data)
    ? salesOrdersData.data
    : [];

  // 生成匹配高亮信息（后端已过滤，这里只做高亮标记）
  const matchingOrderIds = useMemo(() => {
    if (!debouncedSearch.trim()) {
      return new Set<string>();
    }

    const search = debouncedSearch.toLowerCase().trim();
    const matchingIds = new Set<string>();

    salesOrders.forEach(order => {
      // 检查订单号是否匹配
      if (order.orderNumber.toLowerCase().includes(search)) {
        matchingIds.add(order.id);
        return;
      }

      // 检查订单明细中是否有匹配的产品
      if (order.items && order.items.length > 0) {
        const hasMatch = order.items.some(item => {
          const code = item.product?.code?.toLowerCase() || '';
          const name = item.product?.name?.toLowerCase() || '';
          const batchNumber = item.batchNumber?.toLowerCase() || '';
          return (
            code.includes(search) ||
            name.includes(search) ||
            batchNumber.includes(search)
          );
        });
        if (hasMatch) {
          matchingIds.add(order.id);
        }
      }
    });

    return matchingIds;
  }, [salesOrders, debouncedSearch]);

  // 当搜索结果变化时，自动展开匹配的订单
  useEffect(() => {
    if (debouncedSearch.trim() && matchingOrderIds.size > 0) {
      setExpandedOrders(new Set(matchingOrderIds));
    }
  }, [debouncedSearch, matchingOrderIds]);

  const toggleOrder = (orderId: string) => {
    setExpandedOrders(prev => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  };

  const clearSearch = () => {
    setGlobalSearch('');
    setDebouncedSearch('');
    setExpandedOrders(new Set());
  };

  if (isLoadingOrders && !salesOrders.length) {
    return (
      <div className="flex items-center justify-center gap-2 py-8">
        <div className="border-primary h-4 w-4 animate-spin rounded-full border-2 border-t-transparent" />
        <span className="text-muted-foreground text-xs">加载销售订单...</span>
      </div>
    );
  }

  if (salesOrders.length === 0 && !globalSearch) {
    return (
      <div className="text-muted-foreground py-8 text-center text-xs">
        该客户暂无可退货的销售订单
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* 全局搜索框 */}
      <div className="relative">
        <Search className="text-muted-foreground absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2" />
        <Input
          placeholder="输入产品编码、批次号或名称快速定位..."
          value={globalSearch}
          onChange={e => setGlobalSearch(e.target.value)}
          className="h-9 pr-8 pl-8"
        />
        {globalSearch && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute top-1/2 right-1 h-6 w-6 -translate-y-1/2 p-0"
            onClick={clearSearch}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* 搜索结果提示 */}
      {globalSearch && (
        <div className="text-muted-foreground flex items-center gap-2 text-xs">
          {isLoadingOrders ? (
            <>
              <div className="border-primary h-3 w-3 animate-spin rounded-full border-2 border-t-transparent" />
              <span>搜索中...</span>
            </>
          ) : salesOrders.length > 0 ? (
            <span>
              找到{' '}
              <span className="text-foreground font-medium">
                {salesOrders.length}
              </span>{' '}
              个匹配的订单
            </span>
          ) : (
            <span className="text-destructive">未找到匹配的产品</span>
          )}
        </div>
      )}

      {/* 订单列表 */}
      <div className="bg-muted/5 max-h-80 space-y-2 overflow-y-auto rounded-md border p-2">
        {salesOrders.length === 0 ? (
          <div className="text-muted-foreground py-8 text-center text-xs">
            {globalSearch
              ? '未找到匹配的销售订单'
              : '该客户暂无可退货的销售订单'}
          </div>
        ) : (
          salesOrders.map(order => (
            <SalesOrderSection
              key={order.id}
              order={order}
              isExpanded={expandedOrders.has(order.id)}
              onToggle={() => toggleOrder(order.id)}
              onItemSelect={onItemSelect}
              selectedItems={selectedItems}
              globalSearch={debouncedSearch}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface SalesOrderSectionProps {
  order: SalesOrder;
  isExpanded: boolean;
  onToggle: () => void;
  onItemSelect: MultiOrderItemSelectorProps['onItemSelect'];
  selectedItems: string[];
  globalSearch?: string; // 全局搜索词，用于高亮匹配产品
}

// 单位标签规范化：将英文单位转换为中文标签（件 / 片）
function normalizeUnitLabel(unit?: string | null): string {
  if (!unit) return '片';
  const trimmed = unit.trim();
  if (!trimmed) return '片';
  if (trimmed === '件' || trimmed === '片') return trimmed;

  const lower = trimmed.toLowerCase();
  if (['piece', 'pieces', 'sheet', 'sheets', 'pc', 'pcs'].includes(lower)) {
    return '片';
  }
  if (['box', 'boxes', 'pack', 'package', 'unit', 'units'].includes(lower)) {
    return '件';
  }

  return trimmed;
}

function SalesOrderSection({
  order,
  isExpanded,
  onToggle,
  onItemSelect,
  selectedItems,
  globalSearch = '',
}: SalesOrderSectionProps) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const { data: returnableItemsData, isLoading: isLoadingItems } =
    useSalesOrderReturnableItems(order.id, {
      enabled: isExpanded,
    });

  const returnableItems = returnableItemsData?.data?.returnableItems ?? [];

  // 检查产品是否匹配搜索词（编码、名称或批次号）
  const isItemMatched = (item: ReturnableItem): boolean => {
    if (!globalSearch.trim()) return false;
    const search = globalSearch.toLowerCase().trim();
    const code = item.product?.code?.toLowerCase() || '';
    const name = item.product?.name?.toLowerCase() || '';
    const batchNumber = item.batchNumber?.toLowerCase() || '';
    return (
      code.includes(search) ||
      name.includes(search) ||
      batchNumber.includes(search)
    );
  };

  // 格式化“可退数量”，支持按件/片显示，例如：3件+2片（共32片）
  const formatAvailableQuantity = (item: ReturnableItem): string => {
    const qty = Math.floor(item.availableQuantity || 0);
    if (!Number.isFinite(qty) || qty <= 0) {
      return '0';
    }

    const piecesPerUnit =
      typeof item.piecesPerUnit === 'number' && item.piecesPerUnit > 0
        ? item.piecesPerUnit
        : undefined;

    const unitLabel = normalizeUnitLabel(item.displayUnit ?? item.product.unit);

    if (piecesPerUnit && piecesPerUnit > 1 && unitLabel === '件') {
      return formatDetailedPieceSummary(qty, piecesPerUnit);
    }

    // 默认：数量 + 单位（通常是片）
    return `${qty}${unitLabel}`;
  };

  const handleSelectItem = (item: ReturnableItem) => {
    const quantity = quantities[item.salesOrderItemId] || 1;
    const subtotal = quantity * item.unitPrice;

    onItemSelect({
      salesOrderItemId: item.salesOrderItemId,
      productId: item.productId,
      colorCode: item.colorCode ?? undefined,
      productionDate: item.productionDate ?? undefined,
      returnQuantity: quantity,
      // originalQuantity 始终使用销售订单行原始数量（系统按片存储），避免因为多次退货看起来“变小”
      originalQuantity: item.originalQuantity,
      unitPrice: item.unitPrice,
      subtotal,
      reason: '',
      condition: 'good',
      productInfo: {
        name: item.product.name,
        code: item.product.code,
        // 单位优先使用销售订单上的 displayUnit，其次回退到产品单位
        unit: item.displayUnit ?? item.product.unit,
        specification: item.product.specification ?? null,
        batchNumber: item.batchNumber ?? null,
      },
      salesOrderNumber: order.orderNumber,
    });
  };

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <div className="rounded-md border">
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="hover:bg-muted/50 w-full justify-between px-3 py-2 text-xs"
          >
            <div className="flex items-center gap-2">
              <ChevronDown
                className={`h-4 w-4 transition-transform ${
                  isExpanded ? 'rotate-180' : ''
                }`}
              />
              <span className="font-mono font-medium text-[hsl(var(--color-primary))]">
                {order.orderNumber}
              </span>
              <span className="text-muted-foreground">
                订单日期: {formatDate(order.createdAt)}
              </span>
              <span className="text-muted-foreground">
                总金额: ￥{order.totalAmount.toFixed(2)}
              </span>
            </div>
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t p-2">
            {isLoadingItems ? (
              <div className="flex items-center justify-center gap-2 py-4">
                <div className="border-primary h-4 w-4 animate-spin rounded-full border-2 border-t-transparent" />
                <span className="text-muted-foreground text-xs">
                  加载产品明细...
                </span>
              </div>
            ) : returnableItems.length === 0 ? (
              <div className="text-muted-foreground py-4 text-center text-xs">
                该订单暂无可退货产品
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="text-xs">
                    <TableHead className="h-8 px-2">产品</TableHead>
                    <TableHead className="h-8 px-2">可退数量</TableHead>
                    <TableHead className="h-8 px-2">退货单价</TableHead>
                    <TableHead className="h-8 px-2">退货数量</TableHead>
                    <TableHead className="h-8 px-2 text-center">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {returnableItems.map(item => {
                    const isSelected = selectedItems.includes(
                      item.salesOrderItemId
                    );
                    const isMatched = isItemMatched(item);
                    return (
                      <TableRow
                        key={item.salesOrderItemId}
                        className={cn(
                          'text-xs',
                          isMatched && 'bg-yellow-50 dark:bg-yellow-900/20'
                        )}
                      >
                        <TableCell className="h-8 px-2">
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-1">
                              {isMatched && (
                                <span className="text-yellow-600 dark:text-yellow-400">
                                  ✨
                                </span>
                              )}
                              <Package className="text-muted-foreground h-3 w-3" />
                              <span
                                className={cn(
                                  'font-medium',
                                  isMatched &&
                                    'text-yellow-700 dark:text-yellow-300'
                                )}
                              >
                                {item.product.name}
                              </span>
                            </div>
                            <div className="text-muted-foreground flex flex-wrap gap-x-2 gap-y-0.5 text-xs">
                              <span
                                className={cn(
                                  isMatched &&
                                    'font-medium text-yellow-600 dark:text-yellow-400'
                                )}
                              >
                                {item.product.code}
                              </span>
                              {item.batchNumber && (
                                <span
                                  className={cn(
                                    isMatched &&
                                      globalSearch
                                        .toLowerCase()
                                        .includes(
                                          item.batchNumber.toLowerCase()
                                        ) &&
                                      'font-medium text-yellow-600 dark:text-yellow-400'
                                  )}
                                >
                                  批次: {item.batchNumber}
                                </span>
                              )}
                              {item.product.specification && (
                                <span>{item.product.specification}</span>
                              )}
                              {item.colorCode && (
                                <span>颜色: {item.colorCode}</span>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="h-8 px-2">
                          {formatAvailableQuantity(item)}
                        </TableCell>
                        <TableCell className="h-8 px-2">
                          ￥{item.unitPrice.toFixed(2)}
                        </TableCell>
                        <TableCell className="h-8 px-2">
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              min="1"
                              max={item.availableQuantity}
                              value={quantities[item.salesOrderItemId] || 1}
                              onChange={e => {
                                const parsed = Number(e.target.value);
                                const safeValue = Number.isFinite(parsed)
                                  ? Math.min(
                                      Math.max(1, parsed),
                                      item.availableQuantity
                                    )
                                  : 1;
                                setQuantities(prev => ({
                                  ...prev,
                                  [item.salesOrderItemId]: safeValue,
                                }));
                              }}
                              className="h-6 w-16 text-right text-xs"
                              disabled={isSelected}
                            />
                            <span className="text-muted-foreground text-[10px]">
                              片
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="h-8 px-2 text-center">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2"
                            onClick={() => handleSelectItem(item)}
                            disabled={isSelected}
                          >
                            <Plus className="mr-1 h-3 w-3" />
                            {isSelected ? '已添加' : '添加'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
