// 移动端数据表格组件 - 响应式数据展示
// 桌面端显示表格，移动端显示卡片列表

import React from 'react';

import { EmptyState } from '@/components/common/empty-state';
import { ContentLoading } from '@/components/common/loading';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

import {
  DesktopTableView,
  MobileCardList,
  toDisplayValue,
  useTableUtilities,
} from './mobile-data-table-helpers';

// 列定义接口
export interface ColumnDef<T> {
  key: string;
  title: string;
  render?: (value: unknown, record: T, index: number) => React.ReactNode;
  width?: string | number;
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
  className?: string;
  mobileHidden?: boolean;
  mobileLabel?: string;
  mobilePrimary?: boolean;
}

// 操作按钮接口
export interface ActionButton<T> {
  key: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  onClick: (record: T, index: number) => void;
  variant?:
    | 'default'
    | 'destructive'
    | 'outline'
    | 'secondary'
    | 'ghost'
    | 'link';
  disabled?: (record: T) => boolean;
  hidden?: (record: T) => boolean;
}

export interface MobileDataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  loading?: boolean;
  empty?: React.ReactNode;
  rowKey?: string | ((record: T) => string);
  onRowClick?: (record: T, index: number) => void;
  onItemClick?: (record: T) => void;
  actions?: ActionButton<T>[];
  renderActions?: (record: T) => React.ReactNode;
  className?: string;
  cardClassName?: string;
  tableClassName?: string;
  showIndex?: boolean;
  stickyHeader?: boolean;
  maxHeight?: string | number;
  total?: number;
  page?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  onSort?: (sortBy: string, sortOrder: 'asc' | 'desc') => void;
  renderMobileCard?: (item: T) => React.ReactNode;
}

function MobileDataTable<T extends Record<string, unknown>>({
  data,
  columns,
  loading = false,
  empty,
  rowKey = 'id',
  onRowClick,
  onItemClick,
  actions = [],
  renderActions,
  renderMobileCard,
  className,
  cardClassName,
  tableClassName,
  showIndex = false,
  stickyHeader = false,
  maxHeight,
}: MobileDataTableProps<T>) {
  const { getRowKey, handleRowClick, renderCellContent, renderActionButtons } =
    useTableUtilities({
      rowKey,
      actions,
      onRowClick,
      onItemClick,
    });

  if (loading) {
    return (
      <div className={cn('space-y-4', className)}>
        <ContentLoading text="加载数据..." />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className={cn('', className)}>
        {empty || <EmptyState compact className="rounded-lg border" />}
      </div>
    );
  }

  const hasClickableRow = Boolean(onRowClick || onItemClick);

  return (
    <div className={cn('', className)}>
      <DesktopTableView
        data={data}
        columns={columns}
        showIndex={showIndex}
        actions={actions}
        tableClassName={tableClassName}
        stickyHeader={stickyHeader}
        maxHeight={maxHeight}
        getRowKey={getRowKey}
        handleRowClick={handleRowClick}
        renderCellContent={renderCellContent}
        renderActionButtons={renderActionButtons}
        hasClickableRow={hasClickableRow}
      />

      <MobileCardList
        data={data}
        columns={columns}
        actions={actions}
        cardClassName={cardClassName}
        getRowKey={getRowKey}
        handleRowClick={handleRowClick}
        renderCellContent={renderCellContent}
        renderActionButtons={renderActionButtons}
        onRowClick={onRowClick}
        onItemClick={onItemClick}
        renderActions={renderActions}
        renderMobileCard={renderMobileCard}
      />
    </div>
  );
}

// 预设的列类型
export const createTextColumn = <T extends unknown>(
  key: string,
  title: string,
  options?: Partial<ColumnDef<T>>
): ColumnDef<T> => ({
  key,
  title,
  ...options,
});

export const createBadgeColumn = <T extends unknown>(
  key: string,
  title: string,
  badgeVariant: 'default' | 'secondary' | 'destructive' | 'outline' = 'default',
  options?: Partial<ColumnDef<T>>
): ColumnDef<T> => ({
  key,
  title,
  render: value =>
    value ? (
      <Badge variant={badgeVariant}>{toDisplayValue(value)}</Badge>
    ) : null,
  ...options,
});

export const createDateColumn = <T extends unknown>(
  key: string,
  title: string,
  format: (date: Date) => string = date => date.toLocaleDateString(),
  options?: Partial<ColumnDef<T>>
): ColumnDef<T> => ({
  key,
  title,
  render: value => {
    const date =
      value instanceof Date
        ? value
        : typeof value === 'string' && value
          ? new Date(value)
          : null;

    if (!date || Number.isNaN(date.getTime())) {
      return '-';
    }

    return format(date);
  },
  ...options,
});

export const createNumberColumn = <T extends unknown>(
  key: string,
  title: string,
  formatter?: (value: number) => string,
  options?: Partial<ColumnDef<T>>
): ColumnDef<T> => ({
  key,
  title,
  align: 'right',
  render: value => {
    const numeric =
      typeof value === 'number'
        ? value
        : typeof value === 'string'
          ? Number(value)
          : NaN;
    if (!Number.isFinite(numeric)) {
      return '-';
    }
    return formatter ? formatter(numeric) : numeric.toLocaleString('zh-CN');
  },
  ...options,
});

export { MobileDataTable };
