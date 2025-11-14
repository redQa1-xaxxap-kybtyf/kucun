'use client';

import { Package, User } from 'lucide-react';

import { EmptyState } from '@/components/common/empty-state';
import { ContentLoading } from '@/components/common/loading';
import { Badge } from '@/components/ui/badge';
import { Pagination } from '@/components/ui/pagination';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { InboundRecord as BaseInboundRecord } from '@/lib/types/inbound';
import { formatDateTime } from '@/lib/utils/datetime';

// 入库原因标签映射
const INBOUND_REASON_LABELS = {
  purchase: '采购入库',
  return: '退货入库',
  transfer: '调拨入库',
  surplus: '盘盈入库',
  other: '其他',
} as const;

interface InboundRecordWithProduct
  extends Omit<BaseInboundRecord, 'product' | 'batchSpecification'> {
  product?: {
    code: string;
    name: string;
    specification?: string;
    piecesPerUnit: number;
    weight?: number | null;
  };
  batchSpecification?: {
    id: string;
    batchNumber?: string | null;
    piecesPerUnit: number;
    weight?: number | null;
    thickness?: number | null;
  };
}

interface InboundRecordsTableProps {
  records: InboundRecordWithProduct[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  isLoading: boolean;
  onPageChange?: (page: number) => void;
}

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

// 格式化数量显示（X件Y片（共XX片））
const formatQuantity = (quantity: number, piecesPerUnit: number) => {
  // 数据验证
  if (!quantity || !piecesPerUnit || piecesPerUnit <= 0) {
    return `${quantity || 0}片`;
  }

  const units = Math.floor(quantity / piecesPerUnit);
  const pieces = quantity % piecesPerUnit;

  if (units === 0) {
    return `${pieces}片`;
  }

  if (pieces === 0) {
    return `${units}件（共${quantity}片）`;
  }

  return `${units}件${pieces}片（共${quantity}片）`;
};

// 获取记录实际使用的每件片数（优先使用批次规格参数）
const getActualPiecesPerUnit = (record: InboundRecordWithProduct) =>
  record.batchSpecification?.piecesPerUnit ??
  record.product?.piecesPerUnit ??
  1;

// 获取记录的重量（优先使用批次规格参数）
const getActualWeight = (record: InboundRecordWithProduct) => {
  const weight =
    record.batchSpecification?.weight ?? record.product?.weight ?? null;
  return weight ? `${weight.toFixed(2)}kg` : '-';
};

/**
 * 入库记录表格组件
 * ✅ 符合产品模块UI风格规范
 */
export function InboundRecordsTable({
  records,
  pagination,
  isLoading,
  onPageChange,
}: InboundRecordsTableProps) {
  if (isLoading) {
    return <ContentLoading text="加载入库记录..." />;
  }

  return (
    <div
      className="overflow-hidden rounded-lg border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-card))]"
      style={{ boxShadow: 'var(--shadow-medium)' }}
    >
      <TableHeading count={records.length} />
      <div className="overflow-x-auto">
        <RecordsTable records={records} />
      </div>

      {/* 分页器 */}
      {pagination && onPageChange && (
        <div className="border-t border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-tertiary))] px-4 py-3">
          <Pagination
            pagination={pagination}
            onPageChange={onPageChange}
            showRange
            showTotal
            disabled={isLoading}
          />
        </div>
      )}
    </div>
  );
}

function TableHeading({ count }: { count: number }) {
  return (
    <div className="border-b border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-secondary))] px-4 py-3">
      <div className="flex items-center gap-2">
        <Package className="h-4 w-4 text-[hsl(var(--color-primary))]" />
        <span className="text-sm font-medium text-[hsl(var(--color-text-primary))]">
          入库记录 ({count} 条)
        </span>
      </div>
    </div>
  );
}

function RecordsTable({ records }: { records: InboundRecordWithProduct[] }) {
  return (
    <Table>
      <TableHeader style={{ boxShadow: 'var(--shadow-light)' }}>
        <TableRow>
          <TableHead>产品编码</TableHead>
          <TableHead>产品名称</TableHead>
          <TableHead>规格</TableHead>
          <TableHead>每件片数</TableHead>
          <TableHead>重量</TableHead>
          <TableHead>入库数量</TableHead>
          <TableHead>操作类型</TableHead>
          <TableHead>批次号</TableHead>
          <TableHead>操作时间</TableHead>
          <TableHead>备注</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {records.length === 0 ? (
          <TableRow>
            <TableCell colSpan={10} className="p-8">
              <EmptyState
                title="暂无入库记录"
                icon={<Package className="text-muted-foreground h-6 w-6" />}
                compact
              />
            </TableCell>
          </TableRow>
        ) : (
          records.map(record => (
            <InboundRecordRow key={record.id} record={record} />
          ))
        )}
      </TableBody>
    </Table>
  );
}

function InboundRecordRow({ record }: { record: InboundRecordWithProduct }) {
  const piecesPerUnit = getActualPiecesPerUnit(record);

  return (
    <TableRow className="h-12 border-b border-[hsl(var(--color-border-primary))] transition-colors hover:bg-[hsl(var(--color-primary-light))]">
      <TableCell className="text-xs font-medium text-[hsl(var(--color-primary))]">
        {record.product?.code || record.productId}
      </TableCell>
      <TableCell className="text-xs font-medium text-[hsl(var(--color-text-primary))]">
        {record.product?.name || '未知产品'}
      </TableCell>
      <TableCell className="text-xs text-[hsl(var(--color-text-secondary))]">
        {formatSpecification(record.product?.specification) || '-'}
      </TableCell>
      <TableCell className="text-xs text-[hsl(var(--color-text-secondary))]">
        {piecesPerUnit || '-'}
      </TableCell>
      <TableCell className="text-xs text-[hsl(var(--color-text-secondary))]">
        {getActualWeight(record)}
      </TableCell>
      <TableCell className="text-xs text-[hsl(var(--color-text-primary))]">
        <span className="font-medium">
          {formatQuantity(record.quantity, piecesPerUnit)}
        </span>
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
          {formatDateTime(record.createdAt)}
        </div>
      </TableCell>
      <TableCell className="text-xs text-[hsl(var(--color-text-secondary))]">
        {record.remarks || '-'}
      </TableCell>
    </TableRow>
  );
}
