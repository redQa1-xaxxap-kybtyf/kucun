// 移动端数据表格组件 - 响应式数据展示
// 桌面端显示表格，移动端显示卡片列表

import { ChevronRight } from 'lucide-react';
import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

// 列定义接口
export interface ColumnDef<T> {
  key: string;
  title: string;
  render?: (value: any, record: T, index: number) => React.ReactNode;
  width?: string | number;
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
  className?: string;
  mobileHidden?: boolean; // 移动端是否隐藏
  mobileLabel?: string; // 移动端显示的标签
  mobilePrimary?: boolean; // 移动端是否为主要信息
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
  onItemClick?: (record: T) => void; // 添加onItemClick支持
  actions?: ActionButton<T>[];
  renderActions?: (record: T) => React.ReactNode; // 添加renderActions支持
  className?: string;
  cardClassName?: string;
  tableClassName?: string;
  showIndex?: boolean;
  stickyHeader?: boolean;
  maxHeight?: string | number;
  total?: number; // 添加total属性支持
  page?: number; // 添加page属性支持
  pageSize?: number; // 添加pageSize属性支持
  onPageChange?: (page: number) => void; // 添加onPageChange属性支持
  onPageSizeChange?: (pageSize: number) => void; // 添加onPageSizeChange属性支持
  onSort?: (sortBy: string, sortOrder: 'asc' | 'desc') => void; // 添加onSort属性支持
  renderMobileCard?: (item: T) => React.ReactNode; // 添加renderMobileCard属性支持
}

function MobileDataTable<T extends Record<string, any>>({
  data,
  columns,
  loading = false,
  empty,
  rowKey = 'id',
  onRowClick,
  onItemClick,
  actions = [],
  renderActions,
  className,
  cardClassName,
  tableClassName,
  showIndex = false,
  stickyHeader = false,
  maxHeight,
}: MobileDataTableProps<T>) {
  // 获取行的唯一键
  const getRowKey = (record: T, index: number): string => {
    if (typeof rowKey === 'function') {
      return rowKey(record);
    }
    return record[rowKey] || index.toString();
  };

  // 处理行点击事件
  const handleRowClick = (record: T, index: number) => {
    onRowClick?.(record, index);
    onItemClick?.(record);
  };

  // 渲染单元格内容
  const renderCellContent = (
    column: ColumnDef<T>,
    record: T,
    index: number
  ) => {
    const value = record[column.key];
    if (column.render) {
      return column.render(value, record, index);
    }
    return value;
  };

  // 渲染操作按钮
  const renderActionButtons = (record: T, index: number) => {
    const visibleActions = actions.filter(action => !action.hidden?.(record));
    if (visibleActions.length === 0) return null;

    return (
      <div className="flex items-center gap-1">
        {visibleActions.map(action => {
          const Icon = action.icon;
          return (
            <Button
              key={action.key}
              variant={action.variant || 'ghost'}
              size="sm"
              onClick={e => {
                e.stopPropagation();
                action.onClick(record, index);
              }}
              disabled={action.disabled?.(record)}
              className="h-8 w-8 p-0"
            >
              {Icon ? <Icon className="h-4 w-4" /> : action.label}
            </Button>
          );
        })}
      </div>
    );
  };

  // 加载状态
  if (loading) {
    return (
      <div className={cn('space-y-4', className)}>
        {/* 桌面端骨架屏 */}
        <div className="hidden md:block">
          <div className="rounded-lg border">
            <div className="p-4">
              <Skeleton className="mb-2 h-4 w-full" />
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="mb-2 h-12 w-full" />
              ))}
            </div>
          </div>
        </div>

        {/* 移动端骨架屏 */}
        <div className="space-y-3 md:hidden">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="mb-2 h-4 w-3/4" />
                <Skeleton className="mb-2 h-3 w-1/2" />
                <Skeleton className="h-3 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // 空数据状态
  if (!data || data.length === 0) {
    return (
      <div className={cn('', className)}>
        {empty || (
          <div className="py-12 text-center">
            <div className="text-muted-foreground">暂无数据</div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn('', className)}>
      {/* 桌面端表格 */}
      <div className="hidden md:block">
        <div
          className={cn(
            'rounded-lg border',
            maxHeight && 'overflow-auto',
            tableClassName
          )}
          style={maxHeight ? { maxHeight } : undefined}
        >
          <Table>
            <TableHeader
              className={cn(stickyHeader && 'sticky top-0 z-10 bg-background')}
            >
              <TableRow>
                {showIndex && <TableHead className="w-12">#</TableHead>}
                {columns.map(column => (
                  <TableHead
                    key={column.key}
                    className={cn(
                      column.align === 'center' && 'text-center',
                      column.align === 'right' && 'text-right',
                      column.className
                    )}
                    style={column.width ? { width: column.width } : undefined}
                  >
                    {column.title}
                  </TableHead>
                ))}
                {actions.length > 0 && (
                  <TableHead className="w-20">操作</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((record, index) => (
                <TableRow
                  key={getRowKey(record, index)}
                  className={cn(
                    (onRowClick || onItemClick) &&
                      'cursor-pointer hover:bg-muted/50'
                  )}
                  onClick={() => handleRowClick(record, index)}
                >
                  {showIndex && (
                    <TableCell className="font-medium text-muted-foreground">
                      {index + 1}
                    </TableCell>
                  )}
                  {columns.map(column => (
                    <TableCell
                      key={column.key}
                      className={cn(
                        column.align === 'center' && 'text-center',
                        column.align === 'right' && 'text-right',
                        column.className
                      )}
                    >
                      {renderCellContent(column, record, index)}
                    </TableCell>
                  ))}
                  {actions.length > 0 && (
                    <TableCell>{renderActionButtons(record, index)}</TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* 移动端卡片列表 */}
      <div className="space-y-3 md:hidden">
        {data.map((record, index) => {
          // 分离主要信息和次要信息
          const primaryColumns = columns.filter(
            col => col.mobilePrimary && !col.mobileHidden
          );
          const secondaryColumns = columns.filter(
            col => !col.mobilePrimary && !col.mobileHidden
          );

          return (
            <Card
              key={getRowKey(record, index)}
              className={cn(
                'transition-colors',
                (onRowClick || onItemClick) &&
                  'cursor-pointer hover:bg-muted/50 active:bg-muted',
                cardClassName
              )}
              onClick={() => handleRowClick(record, index)}
            >
              <CardContent className="p-4">
                {/* 主要信息 */}
                {primaryColumns.length > 0 && (
                  <div className="mb-3 space-y-2">
                    {primaryColumns.map(column => (
                      <div
                        key={column.key}
                        className="flex items-start justify-between"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">
                            {renderCellContent(column, record, index)}
                          </div>
                          {column.mobileLabel && (
                            <div className="mt-1 text-xs text-muted-foreground">
                              {column.mobileLabel}
                            </div>
                          )}
                        </div>
                        {actions.length > 0 && (
                          <div className="ml-2 flex-shrink-0">
                            {renderActionButtons(record, index)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* 次要信息 */}
                {secondaryColumns.length > 0 && (
                  <div className="space-y-2 text-sm">
                    {secondaryColumns.map(column => {
                      const content = renderCellContent(column, record, index);
                      if (!content) return null;

                      return (
                        <div
                          key={column.key}
                          className="flex items-center justify-between"
                        >
                          <span className="text-xs text-muted-foreground">
                            {column.mobileLabel || column.title}:
                          </span>
                          <span className="text-xs font-medium">{content}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* 操作按钮 */}
                {renderActions && (
                  <div className="mt-3 flex justify-end">
                    {renderActions(record)}
                  </div>
                )}

                {/* 点击指示器 */}
                {(onRowClick || onItemClick) && !renderActions && (
                  <div className="mt-3 flex justify-end">
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// 预设的列类型
export const createTextColumn = <T, >(
  key: string,
  title: string,
  options?: Partial<ColumnDef<T>>
): ColumnDef<T> => ({
  key,
  title,
  ...options,
});

export const createBadgeColumn = <T, >(
  key: string,
  title: string,
  badgeVariant: 'default' | 'secondary' | 'destructive' | 'outline' = 'default',
  options?: Partial<ColumnDef<T>>
): ColumnDef<T> => ({
  key,
  title,
  render: value =>
    value ? <Badge variant={badgeVariant}>{value}</Badge> : null,
  ...options,
});

export const createDateColumn = <T, >(
  key: string,
  title: string,
  format: (date: string | Date) => string = date =>
    new Date(date).toLocaleDateString(),
  options?: Partial<ColumnDef<T>>
): ColumnDef<T> => ({
  key,
  title,
  render: value => (value ? format(value) : '-'),
  ...options,
});

export const createNumberColumn = <T, >(
  key: string,
  title: string,
  formatter?: (value: number) => string,
  options?: Partial<ColumnDef<T>>
): ColumnDef<T> => ({
  key,
  title,
  align: 'right',
  render: value => {
    if (value === null || value === undefined) return '-';
    return formatter ? formatter(value) : value.toString();
  },
  ...options,
});

export { MobileDataTable };
