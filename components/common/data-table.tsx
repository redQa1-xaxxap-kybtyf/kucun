/**
 * 统一的数据表格组件
 *
 * 提供统一的数据表格，包括：
 * - 标准的表格布局
 * - 操作列支持
 * - 空状态显示
 * - 加载状态
 * - 分页支持
 *
 * @see docs/DATA_TABLE_GUIDE.md
 */

'use client';

import { MoreHorizontal } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { InlineLoading } from '@/components/common/loading';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

/**
 * 表格列定义
 */
export interface DataTableColumn<TData> {
  /**
   * 列标题
   */
  header: string;

  /**
   * 列宽度
   */
  width?: string;

  /**
   * 列对齐方式
   */
  align?: 'left' | 'center' | 'right';

  /**
   * 渲染单元格内容
   */
  cell: (row: TData) => React.ReactNode;
}

/**
 * 表格操作定义
 */
export interface DataTableAction<TData> {
  /**
   * 操作标签
   */
  label: string;

  /**
   * 操作图标
   */
  icon?: React.ReactNode;

  /**
   * 操作回调
   */
  onClick: (row: TData) => void;

  /**
   * 是否为危险操作
   */
  destructive?: boolean;

  /**
   * 是否显示分隔线
   */
  separator?: boolean;
}

/**
 * 数据表格属性
 */
export interface DataTableProps<TData> {
  /**
   * 表格列定义
   */
  columns: DataTableColumn<TData>[];

  /**
   * 表格数据
   */
  data: TData[];

  /**
   * 操作列定义
   */
  actions?: DataTableAction<TData>[];

  /**
   * 是否正在加载
   */
  isLoading?: boolean;

  /**
   * 空状态标题
   */
  emptyTitle?: string;

  /**
   * 空状态描述
   */
  emptyDescription?: string;

  /**
   * 空状态操作
   */
  emptyAction?: React.ReactNode;

  /**
   * 获取行的唯一键
   */
  getRowKey: (row: TData) => string;
}

/**
 * 数据表格组件
 *
 * @example
 * ```tsx
 * <DataTable
 *   columns={[
 *     {
 *       header: '产品名称',
 *       cell: (row) => row.name,
 *     },
 *     {
 *       header: '价格',
 *       align: 'right',
 *       cell: (row) => formatCurrency(row.price),
 *     },
 *   ]}
 *   data={products}
 *   actions={[
 *     {
 *       label: '编辑',
 *       onClick: (row) => router.push(`/products/${row.id}/edit`),
 *     },
 *     {
 *       label: '删除',
 *       onClick: (row) => handleDelete(row.id),
 *       destructive: true,
 *       separator: true,
 *     },
 *   ]}
 *   getRowKey={(row) => row.id}
 *   isLoading={isLoading}
 *   emptyTitle="暂无产品"
 *   emptyDescription="点击上方按钮创建第一个产品"
 * />
 * ```
 */
export function DataTable<TData>({
  columns,
  data,
  actions,
  isLoading = false,
  emptyTitle = '暂无数据',
  emptyDescription,
  emptyAction,
  getRowKey,
}: DataTableProps<TData>) {
  // 加载状态
  if (isLoading) {
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column, index) => (
                <TableHead key={index} style={{ width: column.width }}>
                  {column.header}
                </TableHead>
              ))}
              {actions && actions.length > 0 && (
                <TableHead className="w-[70px]">操作</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell
                colSpan={
                  columns.length + (actions && actions.length > 0 ? 1 : 0)
                }
              >
                <InlineLoading text="加载数据..." />
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    );
  }

  // 空状态
  if (data.length === 0) {
    return (
      <div className="rounded-md border">
        <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 p-8 text-center">
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">{emptyTitle}</h3>
            {emptyDescription && (
              <p className="text-muted-foreground text-sm">
                {emptyDescription}
              </p>
            )}
          </div>
          {emptyAction}
        </div>
      </div>
    );
  }

  // 数据表格
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((column, index) => (
              <TableHead
                key={index}
                style={{ width: column.width }}
                className={
                  column.align === 'center'
                    ? 'text-center'
                    : column.align === 'right'
                      ? 'text-right'
                      : ''
                }
              >
                {column.header}
              </TableHead>
            ))}
            {actions && actions.length > 0 && (
              <TableHead className="w-[70px]">操作</TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map(row => (
            <TableRow key={getRowKey(row)}>
              {columns.map((column, index) => (
                <TableCell
                  key={index}
                  className={
                    column.align === 'center'
                      ? 'text-center'
                      : column.align === 'right'
                        ? 'text-right'
                        : ''
                  }
                >
                  {column.cell(row)}
                </TableCell>
              ))}
              {actions && actions.length > 0 && (
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">打开菜单</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {actions.map((action, index) => (
                        <React.Fragment key={index}>
                          {action.separator && index > 0 && (
                            <DropdownMenuSeparator />
                          )}
                          <DropdownMenuItem
                            onClick={() => action.onClick(row)}
                            className={
                              action.destructive ? 'text-destructive' : ''
                            }
                          >
                            {action.icon && (
                              <span className="mr-2">{action.icon}</span>
                            )}
                            {action.label}
                          </DropdownMenuItem>
                        </React.Fragment>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
