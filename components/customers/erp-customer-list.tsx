'use client';

import { Edit, Eye, Loader2, MoreHorizontal, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { EmptyState } from '@/components/common/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Pagination } from '@/components/ui/pagination';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { Customer } from '@/lib/types/customer';
import { formatDateTime } from '@/lib/utils/datetime';

interface ERPCustomerListProps {
  customers: Customer[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  isLoading?: boolean;
  onCreateNew?: () => void;
  onViewDetail?: (customer: Customer) => void;
  onEdit?: (customer: Customer) => void;
  onDelete?: (customer: Customer) => void;
  onPageChange?: (page: number) => void;
}

/**
 * ERP风格的客户管理列表组件
 * 采用紧凑布局，符合中国ERP系统用户习惯
 * 简化版本：移除客户端状态管理，依赖服务器端数据
 */
export function ERPCustomerList({
  customers,
  pagination,
  isLoading = false,
  onCreateNew,
  onViewDetail,
  onEdit,
  onDelete,
  onPageChange,
}: ERPCustomerListProps) {
  const router = useRouter();

  // 处理创建新客户
  const handleCreateNew = () => {
    if (onCreateNew) {
      onCreateNew();
    } else {
      router.push('/customers/create');
    }
  };

  // 处理查看详情
  const handleViewDetail = (customer: Customer) => {
    if (onViewDetail) {
      onViewDetail(customer);
    } else {
      router.push(`/customers/${customer.id}`);
    }
  };

  // 处理编辑
  const handleEdit = (customer: Customer) => {
    if (onEdit) {
      onEdit(customer);
    } else {
      router.push(`/customers/${customer.id}/edit`);
    }
  };

  // 处理删除
  const handleDelete = (customer: Customer) => {
    if (onDelete) {
      onDelete(customer);
    }
  };

  // 处理分页
  const handlePageChange = (page: number) => {
    if (onPageChange) {
      onPageChange(page);
    } else {
      // 默认行为：导航到新页面
      const params = new URLSearchParams(window.location.search);
      if (page > 1) {
        params.set('page', page.toString());
      } else {
        params.delete('page');
      }
      router.push(`/customers?${params.toString()}`);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* 表格区域 - 桌面端 */}
      <div className="hidden flex-1 overflow-auto md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>客户名称</TableHead>
              <TableHead>联系电话</TableHead>
              <TableHead>地址</TableHead>
              <TableHead>交易次数</TableHead>
              <TableHead>合作天数</TableHead>
              <TableHead>退货次数</TableHead>
              <TableHead>最近下单</TableHead>
              <TableHead>创建时间</TableHead>
              <TableHead className="text-center">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="p-8">
                  {isLoading ? (
                    <EmptyState
                      title="正在加载客户数据..."
                      icon={
                        <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
                      }
                      compact
                    />
                  ) : (
                    <EmptyState
                      title="暂无客户记录"
                      action={
                        <Button onClick={handleCreateNew}>新建客户</Button>
                      }
                      compact
                    />
                  )}
                </TableCell>
              </TableRow>
            ) : (
              customers.map(customer => (
                <TableRow
                  key={customer.id}
                  className="cursor-pointer"
                  onClick={() => handleViewDetail(customer)}
                >
                  <TableCell className="font-medium text-[hsl(var(--color-text-primary))]">
                    {customer.name}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {customer.phone || '-'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    <div
                      className="max-w-[200px] truncate"
                      title={customer.address}
                    >
                      {customer.address || '-'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {customer.transactionCount || 0}次
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        customer.cooperationDays !== undefined
                          ? 'default'
                          : 'secondary'
                      }
                    >
                      {customer.cooperationDays !== undefined
                        ? `${customer.cooperationDays}天`
                        : '未下单'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        customer.returnOrderCount &&
                        customer.returnOrderCount > 0
                          ? 'destructive'
                          : 'outline'
                      }
                    >
                      {customer.returnOrderCount || 0}次
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {customer.lastOrderDate
                      ? formatDateTime(customer.lastOrderDate)
                      : '-'}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {formatDateTime(customer.createdAt)}
                  </TableCell>
                  <TableCell className="text-center">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={e => e.stopPropagation()}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={e => {
                            e.stopPropagation();
                            handleViewDetail(customer);
                          }}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          查看详情
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={e => {
                            e.stopPropagation();
                            handleEdit(customer);
                          }}
                        >
                          <Edit className="mr-2 h-4 w-4" />
                          编辑
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-[hsl(var(--color-error))]"
                          onClick={e => {
                            e.stopPropagation();
                            handleDelete(customer);
                          }}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          删除
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* 移动端：卡片列表 */}
      <div className="space-y-3 md:hidden">
        {customers.length === 0 ? (
          <div className="card-shadow-medium rounded-lg border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-card))] p-6 text-center text-sm">
            {isLoading ? '正在加载客户数据...' : '暂无客户记录'}
          </div>
        ) : (
          customers.map(customer => (
            <div
              key={customer.id}
              className="card-shadow-light cursor-pointer rounded-lg border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-card))] p-3"
              onClick={() => handleViewDetail(customer)}
              onKeyDown={event => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  handleViewDetail(customer);
                }
              }}
              role="button"
              tabIndex={0}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-medium text-[hsl(var(--color-text-primary))]">
                    {customer.name}
                  </div>
                  <div className="mt-0.5 text-xs text-[hsl(var(--color-text-secondary))]">
                    电话：{customer.phone || '-'}
                  </div>
                  <div className="mt-0.5 text-[10px] text-[hsl(var(--color-text-tertiary))]">
                    地址：{customer.address || '-'}
                  </div>
                </div>
                <div className="shrink-0 text-right text-[10px] text-[hsl(var(--color-text-secondary))]">
                  <div>交易：{customer.transactionCount || 0}次</div>
                  <div className="mt-0.5">
                    合作：
                    {customer.cooperationDays !== undefined
                      ? `${customer.cooperationDays}天`
                      : '未下单'}
                  </div>
                  <div className="mt-0.5">
                    退货：{customer.returnOrderCount || 0}次
                  </div>
                </div>
              </div>

              <div className="mt-2 flex items-center justify-between text-[10px] text-[hsl(var(--color-text-tertiary))]">
                <span>
                  最近下单：
                  {customer.lastOrderDate
                    ? formatDateTime(customer.lastOrderDate)
                    : '-'}
                </span>
                <span>创建：{formatDateTime(customer.createdAt)}</span>
              </div>

              <div className="mt-2 flex items-center justify-end gap-2 text-[11px]">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  onClick={event => {
                    event.stopPropagation();
                    handleViewDetail(customer);
                  }}
                >
                  <Eye className="mr-1 h-3 w-3" />
                  查看
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  onClick={event => {
                    event.stopPropagation();
                    handleEdit(customer);
                  }}
                >
                  <Edit className="mr-1 h-3 w-3" />
                  编辑
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 分页组件 */}
      {pagination && pagination.total > 0 && (
        <div className="flex-shrink-0 border-t border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-tertiary))] px-4 py-3">
          <Pagination
            pagination={pagination}
            onPageChange={handlePageChange}
            showRange
            showTotal
          />
        </div>
      )}
    </div>
  );
}
