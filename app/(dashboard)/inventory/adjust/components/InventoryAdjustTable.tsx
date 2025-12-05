/**
 * 库存调整表格组件
 * 显示当前库存状态和相关信息
 */

import { ContentLoading } from '@/components/common/loading';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { Inventory } from '@/lib/types/inventory';
import { PRODUCT_UNIT_LABELS } from '@/lib/types/product';
import { formatDateTimeCN } from '@/lib/utils/datetime';
import { getStockDisplayData } from '@/lib/utils/inventory-status';
import { formatPieceSummary } from '@/lib/utils/piece-calculation';

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
    if (!dateString) {
      return null;
    }
    return formatDateTimeCN(dateString);
  };

  // 获取库存数量显示
  const renderStockDisplay = (record: Inventory) => {
    const stockData = getStockDisplayData(record);

    // 与库存总览页保持一致的件/片显示逻辑
    const unitLabel = record.product?.unit
      ? PRODUCT_UNIT_LABELS[
          record.product.unit as keyof typeof PRODUCT_UNIT_LABELS
        ] || record.product.unit
      : '件';

    const packaging =
      record.batchPiecesPerUnit ?? record.product?.piecesPerUnit ?? 0;

    const totalDisplay =
      packaging > 0
        ? formatPieceSummary(record.quantity, packaging, {
            prefix: '总计',
            fallbackUnit: unitLabel,
          })
        : `${record.quantity}${unitLabel}`;

    const availableQuantity = record.quantity - (record.reservedQuantity || 0);

    const availableDisplay =
      availableQuantity > 0
        ? formatPieceSummary(availableQuantity, packaging, {
            fallbackUnit: unitLabel,
            zeroDisplay: '0',
          })
        : '0';

    return (
      <div className="flex flex-col">
        <div className="flex items-center space-x-2">
          <span className="font-medium">{totalDisplay}</span>
          <Badge variant={stockData.statusColor} className="text-xs">
            {stockData.statusLabel}
          </Badge>
        </div>
        <div className="text-muted-foreground text-sm">
          可用: {availableDisplay}
        </div>
      </div>
    );
  };

  if (isLoading) {
    return <ContentLoading text="加载库存调整记录..." />;
  }

  if (inventoryRecords.length === 0) {
    return (
      <div className="text-muted-foreground py-8 text-center">暂无库存记录</div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>产品信息</TableHead>
          <TableHead>批次号</TableHead>
          <TableHead>当前库存</TableHead>
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
                {record.product?.code && (
                  <span className="text-muted-foreground text-sm">
                    编码: {record.product.code}
                  </span>
                )}
                {record.product?.specification && (
                  <span className="text-muted-foreground text-sm">
                    规格:{' '}
                    {(() => {
                      const spec = record.product.specification;
                      // 如果是JSON字符串，尝试解析并提取关键信息
                      if (spec.startsWith('{') && spec.endsWith('}')) {
                        try {
                          const parsed = JSON.parse(spec);
                          // 提取尺寸信息作为主要显示内容
                          if (parsed.size) {
                            return parsed.size.length > 11
                              ? `${parsed.size.slice(0, 11)}...`
                              : parsed.size;
                          }
                          // 如果没有尺寸，显示简化的规格信息
                          return '规格详情...';
                        } catch {
                          // JSON解析失败，截断显示
                          return spec.length > 11
                            ? `${spec.slice(0, 11)}...`
                            : spec;
                        }
                      }
                      // 普通字符串，直接截断
                      return spec.length > 11
                        ? `${spec.slice(0, 11)}...`
                        : spec;
                    })()}
                  </span>
                )}
                {record.variant?.sku && (
                  <span className="text-muted-foreground text-sm">
                    SKU: {record.variant.sku}
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
              <div className="text-sm">{formatDate(record.updatedAt)}</div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
