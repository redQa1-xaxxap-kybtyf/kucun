'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Edit,
  Eye,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Trash2,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { UnifiedSearchBar } from '@/components/common/unified-search-bar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
import { customerQueryKeys, getCustomers } from '@/lib/api/customers';
import { paginationConfig } from '@/lib/env';
import type { Customer, CustomerQueryParams } from '@/lib/types/customer';

interface ERPCustomerListProps {
  initialData?: {
    data: Customer[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
  initialParams?: CustomerQueryParams;
  onCreateNew?: () => void;
  onViewDetail?: (customer: Customer) => void;
  onEdit?: (customer: Customer) => void;
  onDelete?: (customer: Customer) => void;
}

/**
 * ERP风格的客户管理列表组件
 * 采用紧凑布局，符合中国ERP系统用户习惯
 */
export function ERPCustomerList({
  initialData,
  initialParams,
  onCreateNew,
  onViewDetail,
  onEdit,
  onDelete,
}: ERPCustomerListProps) {
  const router = useRouter();

  // 查询参数状态
  const [queryParams, setQueryParams] = useState<CustomerQueryParams>(
    initialParams || {
      page: 1,
      limit: paginationConfig.defaultPageSize,
      search: '',
      sortBy: 'createdAt',
      sortOrder: 'desc',
    }
  );

  // 获取客户列表数据
  const { data, isLoading } = useQuery({
    queryKey: customerQueryKeys.list(queryParams),
    queryFn: () => getCustomers(queryParams),
    initialData: initialData
      ? {
          data: initialData.data,
          pagination: initialData.pagination,
        }
      : undefined,
  });

  const customers = data?.data || [];

  // 搜索处理
  const handleSearch = (value: string) => {
    setQueryParams(prev => ({ ...prev, search: value, page: 1 }));
  };

  // 排序处理
  const handleSort = (sortBy: string) => {
    setQueryParams(prev => ({
      ...prev,
      sortBy: sortBy as CustomerQueryParams['sortBy'],
      page: 1,
    }));
  };

  // 重置筛选
  const resetFilters = () => {
    setQueryParams({
      page: 1,
      limit: 50,
      search: '',
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });
  };

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
    <div className="space-y-4">
      {/* 页面标题卡片 */}
      <Card className="overflow-hidden shadow-lg shadow-gray-200/50">
        <CardContent className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 shadow-lg shadow-blue-600/30">
                <Users className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                  客户管理
                </h1>
                <p className="text-sm text-gray-600">
                  管理客户信息，维护客户关系
                </p>
              </div>
            </div>
            <Link href="/customers/create">
              <Button
                size="lg"
                className="h-11 shadow-md transition-all hover:scale-105 hover:shadow-lg"
              >
                <Plus className="mr-2 h-4 w-4" />
                新建客户
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* 搜索和筛选 */}
      <Card className="shadow-md shadow-gray-200/50">
        <CardContent className="pt-6">
          <UnifiedSearchBar
            searchValue={queryParams.search || ''}
            onSearchChange={handleSearch}
            searchPlaceholder="搜索客户名称、手机号..."
            debounceDelay={400}
            compact={true}
            filters={[
              {
                key: 'sortBy',
                label: '排序',
                options: [
                  { label: '创建时间', value: 'createdAt' },
                  { label: '客户名称', value: 'name' },
                  { label: '更新时间', value: 'updatedAt' },
                  { label: '交易次数', value: 'transactionCount' },
                  { label: '合作天数', value: 'cooperationDays' },
                  { label: '退货次数', value: 'returnOrderCount' },
                ],
                width: 'w-32',
              },
            ]}
            filterValues={{
              sortBy: queryParams.sortBy || 'createdAt',
            }}
            onFilterChange={(key, value) => {
              if (key === 'sortBy' && value) {
                handleSort(value);
              }
            }}
            actionButtons={[
              {
                label: '重置',
                icon: <RotateCcw className="mr-1 h-3 w-3" />,
                onClick: resetFilters,
                variant: 'outline',
              },
            ]}
          />
        </CardContent>
      </Card>

      {/* 表格区域 */}
      <div className="overflow-hidden rounded-lg border bg-white shadow-lg shadow-gray-200/50">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead>客户名称</TableHead>
              <TableHead>联系电话</TableHead>
              <TableHead>地址</TableHead>
              <TableHead>交易次数</TableHead>
              <TableHead>合作天数</TableHead>
              <TableHead>退货次数</TableHead>
              <TableHead>创建时间</TableHead>
              <TableHead className="text-center">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="text-muted-foreground h-10 text-center text-xs"
                >
                  加载中...
                </TableCell>
              </TableRow>
            ) : customers.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="text-muted-foreground h-10 text-center text-xs"
                >
                  暂无客户记录
                </TableCell>
              </TableRow>
            ) : (
              customers.map(customer => (
                <TableRow
                  key={customer.id}
                  className="cursor-pointer transition-colors hover:bg-blue-50/50"
                  onClick={() => handleViewDetail(customer)}
                >
                  <TableCell className="font-medium text-gray-900">
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
                          className="text-red-600"
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
