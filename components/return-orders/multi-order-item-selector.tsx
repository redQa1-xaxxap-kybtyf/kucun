'use client';

import { useQuery } from '@tanstack/react-query';
import { ChevronDown, Package, Plus } from 'lucide-react';
import { useState } from 'react';

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

  const { data: salesOrdersData, isLoading: isLoadingOrders } = useQuery({
    queryKey: salesOrderQueryKeys.list({
      page: 1,
      limit: 100,
      customerId,
    }),
    queryFn: () =>
      getSalesOrders({
        page: 1,
        limit: 100,
        customerId,
      }),
    enabled: Boolean(customerId),
  });

  const salesOrders = Array.isArray(salesOrdersData?.data)
    ? salesOrdersData.data
    : [];

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

  if (isLoadingOrders) {
    return (
      <div className="flex items-center justify-center gap-2 py-8">
        <div className="border-primary h-4 w-4 animate-spin rounded-full border-2 border-t-transparent" />
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
    <div className="bg-muted/5 max-h-96 space-y-2 overflow-y-auto rounded-md border p-2">
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
  onItemSelect: MultiOrderItemSelectorProps['onItemSelect'];
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

  const { data: returnableItemsData, isLoading: isLoadingItems } =
    useSalesOrderReturnableItems(order.id, {
      enabled: isExpanded,
    });

  const returnableItems = returnableItemsData?.data?.returnableItems ?? [];

  const handleSelectItem = (item: ReturnableItem) => {
    const quantity = quantities[item.salesOrderItemId] || 1;
    const subtotal = quantity * item.unitPrice;

    onItemSelect({
      salesOrderItemId: item.salesOrderItemId,
      productId: item.productId,
      colorCode: item.colorCode ?? undefined,
      productionDate: item.productionDate ?? undefined,
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
            className="hover:bg-muted/50 w-full justify-between px-3 py-2 text-xs"
          >
            <div className="flex items-center gap-2">
              <ChevronDown
                className={`h-4 w-4 transition-transform ${
                  isExpanded ? 'rotate-180' : ''
                }`}
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
                          ￥{item.unitPrice.toFixed(2)}
                        </TableCell>
                        <TableCell className="h-8 px-2">
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
