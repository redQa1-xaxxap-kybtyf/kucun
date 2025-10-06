/**
 * 库存调整记录表格组件
 * 使用ERP风格的紧凑布局，符合中国用户习惯
 */

'use client';

import { Eye, Package, User } from 'lucide-react';

import { ContentLoading } from '@/components/common/loading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
    if (!dateString) {
      return null;
    }
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

  // 格式化产品规格显示（限制11个字符，避免JSON字符串显示）
  const formatSpecification = (specification?: string) => {
    if (!specification) {
      return null;
    }

    // 如果是JSON字符串，尝试解析并提取关键信息
    if (specification.startsWith('{') && specification.endsWith('}')) {
      try {
        const parsed = JSON.parse(specification);
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
        return specification.length > 11
          ? `${specification.slice(0, 11)}...`
          : specification;
      }
    }

    // 普通字符串，直接截断
    return specification.length > 11
      ? `${specification.slice(0, 11)}...`
      : specification;
  };

  if (isLoading) {
    return <ContentLoading text="加载调整记录..." />;
  }

  return (
    <div className="bg-card rounded border">
      <div className="bg-muted/30 border-b px-3 py-2">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4" />
          <span className="text-sm font-medium">
            调整记录 ({adjustments.length} 条)
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="h-9 text-xs">产品编码</TableHead>
              <TableHead className="h-9 text-xs">产品名称</TableHead>
              <TableHead className="h-9 text-xs">规格</TableHead>
              <TableHead className="h-9 text-xs">批次号</TableHead>
              <TableHead className="h-9 text-xs">调整数量</TableHead>
              <TableHead className="h-9 text-xs">调整原因</TableHead>
              <TableHead className="h-9 text-xs">操作时间</TableHead>
              <TableHead className="h-9 text-xs">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {adjustments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center">
                  <div className="text-muted-foreground flex flex-col items-center gap-2">
                    <Package className="h-8 w-8" />
                    <span className="text-sm">暂无调整记录</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              adjustments.map(adjustment => (
                <TableRow key={adjustment.id} className="h-10">
                  <TableCell className="text-xs font-medium">
                    {adjustment.product?.code || '-'}
                  </TableCell>
                  <TableCell className="text-xs">
                    {adjustment.product?.name || '未知产品'}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {formatSpecification(adjustment.product?.specification) ||
                      '-'}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {adjustment.batchNumber || '-'}
                  </TableCell>
                  <TableCell className="text-xs">
                    <div className="flex flex-col gap-0.5">
                      {formatAdjustQuantity(adjustment.adjustQuantity)}
                      <span className="text-muted-foreground text-xs">
                        {adjustment.beforeQuantity} → {adjustment.afterQuantity}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs">
                    <Badge variant="outline" className="text-xs">
                      {ADJUSTMENT_REASON_LABELS[
                        adjustment.reason as keyof typeof ADJUSTMENT_REASON_LABELS
                      ] || adjustment.reason}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    <div className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {formatDate(adjustment.createdAt)}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs">
                    {onViewDetail && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onViewDetail(adjustment)}
                        className="h-7 w-7 p-0"
                      >
                        <Eye className="h-3 w-3" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
