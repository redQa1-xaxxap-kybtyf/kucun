'use client';

import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { Package, User } from 'lucide-react';

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
import type { InboundRecord as BaseInboundRecord } from '@/lib/types/inbound';

// 入库原因标签映射
const INBOUND_REASON_LABELS = {
  purchase: '采购入库',
  return: '退货入库',
  transfer: '调拨入库',
  surplus: '盘盈入库',
  other: '其他',
} as const;

interface InboundRecordWithProduct extends Omit<BaseInboundRecord, 'product'> {
  product?: {
    code: string;
    name: string;
    specification?: string;
  };
}

interface InboundRecordsTableProps {
  records: InboundRecordWithProduct[];
  isLoading: boolean;
}

// 格式化日期
const formatDate = (dateString: string) =>
  format(new Date(dateString), 'yyyy年MM月dd日 HH:mm', { locale: zhCN });

// 格式化操作类型
const getOperationTypeLabel = (reason: string) =>
  INBOUND_REASON_LABELS[reason as keyof typeof INBOUND_REASON_LABELS] || reason;

// 获取操作类型样式
const getOperationTypeVariant = (reason: string) => {
  const variants: Record<string, 'success' | 'warning' | 'info' | 'secondary'> =
    {
      purchase: 'success',
      return: 'warning',
      transfer: 'info',
      surplus: 'success',
      other: 'secondary',
    };
  return variants[reason] || 'secondary';
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

/**
 * 入库记录表格组件
 * ✅ 符合产品模块UI风格规范
 */
export function InboundRecordsTable({
  records,
  isLoading,
}: InboundRecordsTableProps) {
  if (isLoading) {
    return <ContentLoading text="加载入库记录..." />;
  }

  return (
    <div
      className="overflow-hidden rounded-lg border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-card))]"
      style={{ boxShadow: 'var(--shadow-medium)' }}
    >
      <div className="border-b border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-secondary))] px-4 py-3">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-[hsl(var(--color-primary))]" />
          <span className="text-sm font-medium text-[hsl(var(--color-text-primary))]">
            入库记录 ({records.length} 条)
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader style={{ boxShadow: 'var(--shadow-light)' }}>
            <TableRow>
              <TableHead>
                产品编码
              </TableHead>
              <TableHead>
                产品名称
              </TableHead>
              <TableHead>
                规格
              </TableHead>
              <TableHead>
                入库数量
              </TableHead>
              <TableHead>
                操作类型
              </TableHead>
              <TableHead>
                批次号
              </TableHead>
              <TableHead>
                操作时间
              </TableHead>
              <TableHead>
                备注
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center">
                  <div className="text-muted-foreground flex flex-col items-center gap-2">
                    <Package className="h-8 w-8" />
                    <span className="text-sm">暂无入库记录</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              records.map(record => (
                <TableRow
                  key={record.id}
                  className="h-12 border-b border-[hsl(var(--color-border-primary))] transition-colors hover:bg-[hsl(var(--color-primary-light))]"
                >
                  <TableCell className="text-xs font-medium text-[hsl(var(--color-primary))]">
                    {record.product?.code || record.productId}
                  </TableCell>
                  <TableCell className="text-xs font-medium text-[hsl(var(--color-text-primary))]">
                    {record.product?.name || '未知产品'}
                  </TableCell>
                  <TableCell className="text-xs text-[hsl(var(--color-text-secondary))]">
                    {formatSpecification(record.product?.specification) || '-'}
                  </TableCell>
                  <TableCell className="text-xs text-[hsl(var(--color-text-primary))]">
                    <span className="font-medium">{record.quantity}</span>{' '}
                    片
                  </TableCell>
                  <TableCell className="text-xs text-[hsl(var(--color-text-primary))]">
                    <Badge
                      variant={getOperationTypeVariant(record.reason)}
                      className="text-xs font-medium"
                    >
                      {getOperationTypeLabel(record.reason)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-[hsl(var(--color-text-secondary))]">
                    {record.batchNumber || '-'}
                  </TableCell>
                  <TableCell className="text-xs text-[hsl(var(--color-text-secondary))]">
                    <div className="flex items-center gap-1 text-[hsl(var(--color-text-secondary))]">
                      <User className="h-3 w-3" />
                      {formatDate(record.createdAt)}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-[hsl(var(--color-text-secondary))]">
                    {record.remarks || '-'}
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
