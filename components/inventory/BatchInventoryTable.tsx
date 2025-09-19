'use client';

import { ChevronDown, ChevronRight, Package } from 'lucide-react';
import React, { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { Inventory } from '@/lib/types/inventory';
import { formatInventoryQuantity } from '@/lib/utils/piece-calculation';

interface BatchInventoryTableProps {
  inventoryData: Inventory[];
  groupByVariant?: boolean;
  showVariantInfo?: boolean;
  onRowClick?: (inventory: Inventory) => void;
}

interface GroupedInventory {
  variant: {
    id: string;
    sku: string;
  };
  product: {
    id: string;
    code: string;
    name: string;
  };
  totalQuantity: number;
  totalReserved: number;
  totalAvailable: number;
  batches: Inventory[];
}

export function BatchInventoryTable({
  inventoryData,
  groupByVariant = false,
  showVariantInfo = true,
  onRowClick,
}: BatchInventoryTableProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // 按变体分组数据
  const groupedData = React.useMemo(() => {
    if (!groupByVariant) return null;

    const groups = new Map<string, GroupedInventory>();

    inventoryData.forEach(inventory => {
      const variantKey =
        inventory.variantId || `${inventory.productId}-${inventory.id}`;

      if (!groups.has(variantKey)) {
        groups.set(variantKey, {
          variant: {
            id: inventory.variantId || '',
            sku: inventory.variant?.sku || inventory.product?.code || '',
          },
          product: {
            id: inventory.productId,
            code: inventory.product?.code || '',
            name: inventory.product?.name || '',
          },
          totalQuantity: 0,
          totalReserved: 0,
          totalAvailable: 0,
          batches: [],
        });
      }

      const group = groups.get(variantKey);
      if (group) {
        group.totalQuantity += inventory.quantity;
        group.totalReserved += inventory.reservedQuantity;
        group.totalAvailable += inventory.quantity - inventory.reservedQuantity;
        group.batches.push(inventory);
      }
    });

    return Array.from(groups.values());
  }, [inventoryData, groupByVariant]);

  const toggleGroup = (variantKey: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(variantKey)) {
      newExpanded.delete(variantKey);
    } else {
      newExpanded.add(variantKey);
    }
    setExpandedGroups(newExpanded);
  };

  const getStockStatusBadge = (available: number, total: number) => {
    if (total === 0) {
      return <Badge variant="destructive">缺货</Badge>;
    }
    if (available <= total * 0.1) {
      return <Badge variant="destructive">库存极低</Badge>;
    }
    if (available <= total * 0.3) {
      return <Badge variant="secondary">库存偏低</Badge>;
    }
    return <Badge variant="default">库存充足</Badge>;
  };

  if (groupByVariant && groupedData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            按变体分组的库存明细
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {groupedData.map(group => {
              const variantKey =
                group.variant.id || `${group.product.id}-${group.variant.sku}`;
              const isExpanded = expandedGroups.has(variantKey);

              return (
                <div key={variantKey} className="rounded-lg border">
                  {/* 分组头部 */}
                  <div
                    className="flex cursor-pointer items-center justify-between p-4 hover:bg-muted/50"
                    onClick={() => toggleGroup(variantKey)}
                  >
                    <div className="flex items-center gap-4">
                      <Button variant="ghost" size="sm" className="h-auto p-0">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>

                      <div>
                        <div className="font-medium">{group.product.name}</div>
                        <div className="text-sm text-muted-foreground">
                          SKU: {group.variant.sku} | {group.batches.length}{' '}
                          个批次
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="font-medium">
                          总库存:{' '}
                          {group.batches[0]?.product?.piecesPerUnit
                            ? formatInventoryQuantity(
                                group.totalQuantity,
                                group.batches[0].product,
                                true
                              )
                            : group.totalQuantity}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          可用:{' '}
                          {group.batches[0]?.product?.piecesPerUnit
                            ? formatInventoryQuantity(
                                group.totalAvailable,
                                group.batches[0].product,
                                false
                              )
                            : group.totalAvailable}{' '}
                          | 预留: {group.totalReserved}
                        </div>
                      </div>
                      {getStockStatusBadge(
                        group.totalAvailable,
                        group.totalQuantity
                      )}
                    </div>
                  </div>

                  {/* 展开的批次详情 */}
                  {isExpanded && (
                    <div className="border-t bg-muted/20">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>批次号</TableHead>
                            <TableHead className="text-right">
                              库存数量
                            </TableHead>
                            <TableHead className="text-right">
                              预留数量
                            </TableHead>
                            <TableHead className="text-right">
                              可用数量
                            </TableHead>
                            <TableHead>状态</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {group.batches.map(batch => (
                            <TableRow
                              key={batch.id}
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => onRowClick?.(batch)}
                            >
                              <TableCell>{batch.batchNumber || '-'}</TableCell>
                              <TableCell className="text-right font-medium">
                                {batch.product?.piecesPerUnit
                                  ? formatInventoryQuantity(
                                      batch.quantity,
                                      batch.product,
                                      true
                                    )
                                  : batch.quantity}
                              </TableCell>
                              <TableCell className="text-right text-orange-600">
                                {batch.reservedQuantity}
                              </TableCell>
                              <TableCell className="text-right text-green-600">
                                {batch.quantity - batch.reservedQuantity}
                              </TableCell>
                              <TableCell>
                                {getStockStatusBadge(
                                  batch.quantity - batch.reservedQuantity,
                                  batch.quantity
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    );
  }

  // 普通表格视图
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          库存明细
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              {showVariantInfo && <TableHead>产品变体</TableHead>}
              <TableHead>批次号</TableHead>
              <TableHead className="text-right">库存数量</TableHead>
              <TableHead className="text-right">预留数量</TableHead>
              <TableHead className="text-right">可用数量</TableHead>
              <TableHead>状态</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {inventoryData.map(inventory => (
              <TableRow
                key={inventory.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => onRowClick?.(inventory)}
              >
                {showVariantInfo && (
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div>
                        <div className="font-medium">
                          {inventory.product?.name}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {inventory.variant?.sku || inventory.product?.code}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                )}
                <TableCell>{inventory.batchNumber || '-'}</TableCell>
                <TableCell className="text-right font-medium">
                  {inventory.product?.piecesPerUnit
                    ? formatInventoryQuantity(
                        inventory.quantity,
                        inventory.product,
                        true
                      )
                    : inventory.quantity}
                </TableCell>
                <TableCell className="text-right text-orange-600">
                  {inventory.reservedQuantity}
                </TableCell>
                <TableCell className="text-right text-green-600">
                  {inventory.quantity - inventory.reservedQuantity}
                </TableCell>
                <TableCell>
                  {getStockStatusBadge(
                    inventory.quantity - inventory.reservedQuantity,
                    inventory.quantity
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
