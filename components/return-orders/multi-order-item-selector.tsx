'use client';

import { useQuery } from '@tanstack/react-query';
import { ChevronDown, Package, Plus } from 'lucide-react';
import { useState } from 'react';

import { getSalesOrders, salesOrderQueryKeys } from '@/lib/api/sales-orders';
import { useSalesOrderReturnableItems } from '@/lib/api/return-orders';
import type { ReturnableItem } from '@/lib/services/sales-order-service';
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
import { type SalesOrder } from '@/lib/types/sales-order';

interface MultiOrderItemSelectorProps {
  customerId: string;
  onItemSelect: (item: {
    salesOrderItemId: string;
    productId: string;
    colorCode?: string;
    productionDate?: string;
    returnQuantity: number;
    originalQuantity: number;
    unitPrice: number;
    subtotal: number;
    reason?: string;
    condition: 'good' | 'damaged' | 'defective';
    productInfo: {
      name: string;
      code: string;
      unit: string;
      specification: string | null;
    };
    salesOrderNumber: string;
  }) => void;
  selectedItems: string[]; // 已选择的 salesOrderItemId 列表
}

/**
 * 多订单退货商品选择器
 * 显示客户的所有可退货销售订单，并允许从中选择商品
 */
export function MultiOrderItemSelector({
  customerId,
  onItemSelect,
  selectedItems,
}: MultiOrderItemSelectorProps) {
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());

  // 获取客户的所有销售订单
  const { data: salesOrdersData, isLoading: isLoadingOrders } = useQuery({
    queryKey: salesOrderQueryKeys.list({
      page: 1,
      limit: 100,
      customerId,
      // 只获取已发货和已完成的订单，这些订单才能退货
      status: undefined,
    }),
    queryFn: () =>
      getSalesOrders({
        page: 1,
        limit: 100,
        customerId,
      }),
    enabled: !!customerId,
  });

  const salesOrders = Array.isArray(salesOrdersData?.data)
    ? salesOrdersData.data
    : [];

  // 切换订单展开/折叠
  const toggleOrder = (orderId: string) => {
    const newExpanded = new Set(expandedOrders);
    if (newExpanded.has(orderId)) {
      newExpanded.delete(orderId);
    } else {
      newExpanded.add(orderId);
    }
    setExpandedOrders(newExpanded);
  };

  if (isLoadingOrders) {
    return (
      <div className="flex items-center justify-center gap-2 py-8">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <span className="text-muted-foreground text-xs">加载销售订单...</span>
      </div>
    );
  }

  if (salesOrders.length === 0) {
    return (
      <div className="text-muted-foreground py-8 text-center text-xs">
        该客户暂无可退货的销售订单
      </div>
    );
  }

  return (
    <div className="max-h-96 space-y-2 overflow-y-auto rounded-md border bg-muted/5 p-2">
      {salesOrders.map(order => (
        <SalesOrderSection
          key={order.id}
          order={order}
          isExpanded={expandedOrders.has(order.id)}
          onToggle={() => toggleOrder(order.id)}
          onItemSelect={onItemSelect}
          selectedItems={selectedItems}
        />
      ))}
    </div>
  );
}

interface SalesOrderSectionProps {
  order: SalesOrder;
  isExpanded: boolean;
  onToggle: () => void;
  onItemSelect: (item: {
    salesOrderItemId: string;
    productId: string;
    colorCode?: string;
    productionDate?: string;
    returnQuantity: number;
    originalQuantity: number;
    unitPrice: number;
    subtotal: number;
    reason?: string;
    condition: 'good' | 'damaged' | 'defective';
    productInfo: {
      name: string;
      code: string;
      unit: string;
      specification: string | null;
    };
    salesOrderNumber: string;
  }) => void;
  selectedItems: string[];
}

function SalesOrderSection({
  order,
  isExpanded,
  onToggle,
  onItemSelect,
  selectedItems,
}: SalesOrderSectionProps) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  // 获取订单的可退货明细
  const { data: returnableItemsData, isLoading: isLoadingItems } =
    useSalesOrderReturnableItems(order.id, {
      enabled: isExpanded,
    });

  const returnableItems =
    returnableItemsData?.data?.returnableItems || [];

  // 处理选择商品
  const handleSelectItem = (item: ReturnableItem) => {
    const quantity = quantities[item.salesOrderItemId] || 1;
    const subtotal = quantity * item.unitPrice;

    onItemSelect({
      salesOrderItemId: item.salesOrderItemId,
      productId: item.productId,
      colorCode: item.colorCode || undefined,
      productionDate: item.productionDate || undefined,
      returnQuantity: quantity,
      originalQuantity: item.availableQuantity,
      unitPrice: item.unitPrice,
      subtotal,
      reason: '',
      condition: 'good',
      productInfo: item.product,
      salesOrderNumber: order.orderNumber,
    });
  };

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <div className="rounded-md border">
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full justify-between px-3 py-2 text-xs hover:bg-muted/50"
          >
            <div className="flex items-center gap-2">
              <ChevronDown
                className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              />
              <span className="font-mono font-medium text-blue-600">
                {order.orderNumber}
              </span>
              <span className="text-muted-foreground">
                订单日期:{' '}
                {new Date(order.createdAt).toLocaleDateString('zh-CN', {
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit',
                })}
              </span>
              <span className="text-muted-foreground">
                总金额: ¥{order.totalAmount.toFixed(2)}
              </span>
            </div>
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t p-2">
            {isLoadingItems ? (
              <div className="flex items-center justify-center gap-2 py-4">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <span className="text-muted-foreground text-xs">
                  加载商品明细...
                </span>
              </div>
            ) : returnableItems.length === 0 ? (
              <div className="text-muted-foreground py-4 text-center text-xs">
                该订单暂无可退货商品
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="text-xs">
                    <TableHead className="h-8 px-2">产品</TableHead>
                    <TableHead className="h-8 px-2">可退数量</TableHead>
                    <TableHead className="h-8 px-2">单价</TableHead>
                    <TableHead className="h-8 px-2">退货数量</TableHead>
                    <TableHead className="h-8 px-2 text-center">
                      操作
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {returnableItems.map(item => {
                    const isSelected = selectedItems.includes(
                      item.salesOrderItemId
                    );
                    return (
                      <TableRow key={item.salesOrderItemId} className="text-xs">
                        <TableCell className="h-8 px-2">
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-1">
                              <Package className="text-muted-foreground h-3 w-3" />
                              <span className="font-medium">
                                {item.product.name}
                              </span>
                            </div>
                            <div className="text-muted-foreground flex gap-2 text-xs">
                              <span>{item.product.code}</span>
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
                          {item.availableQuantity}
                        </TableCell>
                        <TableCell className="h-8 px-2">
                          ¥{item.unitPrice.toFixed(2)}
                        </TableCell>
                        <TableCell className="h-8 px-2">
                          <Input
                            type="number"
                            min="1"
                            max={item.availableQuantity}
                            value={quantities[item.salesOrderItemId] || 1}
                            onChange={e => {
                              const value = Math.min(
                                Math.max(1, Number(e.target.value)),
                                item.availableQuantity
                              );
                              setQuantities(prev => ({
                                ...prev,
                                [item.salesOrderItemId]: value,
                              }));
                            }}
                            className="h-6 w-16 text-xs"
                            disabled={isSelected}
                          />
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
