'use client';

import { Edit, Eye, MoreHorizontal, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { Customer } from '@/lib/types/customer';

interface ERPCustomerListProps {
  initialData: {
    data: Customer[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
  onCreateNew?: () => void;
  onViewDetail?: (customer: Customer) => void;
  onEdit?: (customer: Customer) => void;
  onDelete?: (customer: Customer) => void;
}

/**
 * ERP风格的客户管理列表组件
 * 采用紧凑布局，符合中国ERP系统用户习惯
 * 简化版本：移除客户端状态管理，依赖服务器端数据
 */
export function ERPCustomerList({
  initialData,
  onCreateNew,
  onViewDetail,
  onEdit,
  onDelete,
}: ERPCustomerListProps) {
  const router = useRouter();

  // 使用服务器传递的数据
  const customers = initialData.data || [];

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

  // 格式化日期
  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('zh-CN');

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* 表格区域 */}
      <div className="flex-1 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="even:bg-[hsl(var(--color-bg-table-header))] hover:bg-[hsl(var(--color-bg-table-header))] [&>th]:border-b-2 [&>th]:border-b-[hsl(var(--color-border-secondary))] [&>th]:text-[hsl(var(--color-text-primary))] [&>th]:text-xs [&>th]:font-semibold [&>th]:tracking-wide">
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
                <TableCell
                  colSpan={9}
                  className="text-muted-foreground h-10 text-center text-xs"
                >
                  暂无客户记录
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
                      ? formatDate(customer.lastOrderDate)
                      : '-'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(customer.createdAt)}
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
    </div>
  );
}
