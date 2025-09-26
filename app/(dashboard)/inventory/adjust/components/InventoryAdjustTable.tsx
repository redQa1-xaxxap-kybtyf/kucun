/**
 * 库存调整表格组件
 * 显示当前库存状态和相关信息
 */

import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { Inventory } from '@/lib/types/inventory';
import { formatDateTimeCN } from '@/lib/utils/datetime';
import { getStockDisplayData } from '@/lib/utils/inventory-status';

interface InventoryAdjustTableProps {
  inventoryRecords: Inventory[];
  isLoading: boolean;
}

export function InventoryAdjustTable({
  inventoryRecords,
  isLoading,
}: InventoryAdjustTableProps) {
  // 格式化日期
  const formatDate = (dateString: string | Date) => {
    if (!dateString) return null;
    return formatDateTimeCN(dateString);
  };

  // 获取库存数量显示
  const renderStockDisplay = (record: Inventory) => {
    const stockData = getStockDisplayData(record);

    return (
      <div className="flex flex-col">
        <div className="flex items-center space-x-2">
          <span className="font-medium">{stockData.formattedQuantity}</span>
          <Badge variant={stockData.statusColor} className="text-xs">
            {stockData.statusLabel}
          </Badge>
        </div>
        {stockData.reservedQuantity > 0 && (
          <div className="text-sm text-muted-foreground">
            可用: {stockData.formattedAvailable}
          </div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (inventoryRecords.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">暂无库存记录</div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>产品信息</TableHead>
          <TableHead>批次号</TableHead>
          <TableHead>当前库存</TableHead>
          <TableHead>存储位置</TableHead>
          <TableHead>最后更新</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {inventoryRecords.map(record => (
          <TableRow key={record.id}>
            <TableCell>
              <div className="flex flex-col">
                <span className="font-medium">
                  {record.product?.name || '未知产品'}
                </span>
                {record.product?.sku && (
                  <span className="text-sm text-muted-foreground">
                    SKU: {record.product.sku}
                  </span>
                )}
              </div>
            </TableCell>
            <TableCell>
              {record.batchNumber || (
                <span className="text-muted-foreground">无批次</span>
              )}
            </TableCell>
            <TableCell>{renderStockDisplay(record)}</TableCell>
            <TableCell>
              {record.location || (
                <span className="text-muted-foreground">未指定</span>
              )}
            </TableCell>
            <TableCell>
              <div className="text-sm">{formatDate(record.updatedAt)}</div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
