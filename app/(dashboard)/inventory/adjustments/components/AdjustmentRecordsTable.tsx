/**
 * 库存调整记录表格组件
 * 显示库存调整的历史记录
 */

import { Eye } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ADJUSTMENT_REASON_LABELS,
  ADJUSTMENT_STATUS_VARIANTS,
  type InventoryAdjustment,
} from '@/lib/types/inventory';
import { formatDateTimeCN } from '@/lib/utils/datetime';

interface AdjustmentRecordsTableProps {
  adjustments: InventoryAdjustment[];
  isLoading: boolean;
  onViewDetail?: (adjustment: InventoryAdjustment) => void;
}

export function AdjustmentRecordsTable({
  adjustments,
  isLoading,
  onViewDetail,
}: AdjustmentRecordsTableProps) {
  // 格式化日期
  const formatDate = (dateString: string | Date) => {
    if (!dateString) return null;
    return formatDateTimeCN(dateString);
  };

  // 格式化调整数量显示
  const formatAdjustQuantity = (quantity: number) => {
    if (quantity > 0) {
      return <span className="font-medium text-green-600">+{quantity}</span>;
    } else {
      return <span className="font-medium text-red-600">{quantity}</span>;
    }
  };

  // 格式化产品规格显示（限制11个字符）
  const formatSpecification = (specification?: string) => {
    if (!specification) return null;
    return specification.length > 11
      ? `${specification.slice(0, 11)}...`
      : specification;
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

  if (!adjustments || adjustments.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">暂无调整记录</div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>调整单号</TableHead>
          <TableHead>产品信息</TableHead>
          <TableHead>批次号</TableHead>
          <TableHead>调整数量</TableHead>
          <TableHead>调整原因</TableHead>
          <TableHead>操作人员</TableHead>
          <TableHead>调整时间</TableHead>
          <TableHead>操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {(adjustments || []).map(adjustment => (
          <TableRow key={adjustment.id}>
            <TableCell>
              <div className="flex flex-col">
                <span className="text-sm font-medium">
                  {adjustment.adjustmentNumber}
                </span>
                <Badge
                  variant={ADJUSTMENT_STATUS_VARIANTS[adjustment.status]}
                  className="mt-1 w-fit text-xs"
                >
                  {adjustment.status === 'approved'
                    ? '已审批'
                    : adjustment.status === 'pending'
                      ? '待审批'
                      : adjustment.status === 'rejected'
                        ? '已拒绝'
                        : '草稿'}
                </Badge>
              </div>
            </TableCell>
            <TableCell>
              <div className="flex flex-col">
                <span className="font-medium">
                  {adjustment.product?.name || '未知产品'}
                </span>
                {adjustment.product?.code && (
                  <span className="text-sm text-muted-foreground">
                    编码: {adjustment.product.code}
                  </span>
                )}
                {adjustment.product?.specification && (
                  <span className="text-sm text-muted-foreground">
                    规格:{' '}
                    {formatSpecification(adjustment.product.specification)}
                  </span>
                )}
                {adjustment.variant?.sku && (
                  <span className="text-sm text-muted-foreground">
                    SKU: {adjustment.variant.sku}
                  </span>
                )}
              </div>
            </TableCell>
            <TableCell>
              {adjustment.batchNumber || (
                <span className="text-muted-foreground">无批次</span>
              )}
            </TableCell>
            <TableCell>
              <div className="flex flex-col">
                <div className="flex items-center space-x-2">
                  {formatAdjustQuantity(adjustment.adjustQuantity)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {adjustment.beforeQuantity} → {adjustment.afterQuantity}
                </div>
              </div>
            </TableCell>
            <TableCell>
              <Badge variant="outline" className="text-xs">
                {ADJUSTMENT_REASON_LABELS[
                  adjustment.reason as keyof typeof ADJUSTMENT_REASON_LABELS
                ] || adjustment.reason}
              </Badge>
            </TableCell>
            <TableCell>
              <div className="flex flex-col">
                <span className="text-sm">
                  {adjustment.operator?.name || '未知操作员'}
                </span>
                {adjustment.approver && (
                  <span className="text-xs text-muted-foreground">
                    审批: {adjustment.approver.name}
                  </span>
                )}
              </div>
            </TableCell>
            <TableCell>
              <div className="text-sm">{formatDate(adjustment.createdAt)}</div>
            </TableCell>
            <TableCell>
              {onViewDetail && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onViewDetail(adjustment)}
                >
                  <Eye className="h-4 w-4" />
                </Button>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
