'use client';

import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Calendar,
  Edit,
  Eye,
  Filter,
  MoreHorizontal,
  Phone,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  Users,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { customerQueryKeys, getCustomers } from '@/lib/api/customers';
import type { Customer, CustomerQueryParams } from '@/lib/types/customer';
import { formatDate } from '@/lib/utils/datetime';

interface ERPCustomerListProps {
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
  onCreateNew,
  onViewDetail,
  onEdit,
  onDelete,
}: ERPCustomerListProps) {
  const router = useRouter();

  // 查询参数状态
  const [queryParams, setQueryParams] = useState<CustomerQueryParams>({
    page: 1,
    limit: 50,
    search: '',
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });

  // 获取客户列表数据
  const { data, isLoading } = useQuery({
    queryKey: customerQueryKeys.list(queryParams),
    queryFn: () => getCustomers(queryParams),
  });

  const customers = data?.data || [];

  // 搜索处理
  const handleSearch = (value: string) => {
    setQueryParams(prev => ({ ...prev, search: value, page: 1 }));
  };

  // 排序处理
  const handleSort = (sortBy: string) => {
    setQueryParams(prev => ({ ...prev, sortBy, page: 1 }));
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

  return (
    <div className="rounded border bg-card">
      {/* ERP标准工具栏 */}
      <div className="border-b bg-muted/30 px-3 py-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">客户管理</h3>
          <div className="text-xs text-muted-foreground">
            {data?.pagination ? `共 ${data.pagination.total} 条记录` : ''}
          </div>
        </div>
      </div>

      {/* 操作按钮区 */}
      <div className="border-b bg-muted/10 px-3 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7"
              onClick={() => router.back()}
            >
              <ArrowLeft className="mr-1 h-3 w-3" />
              返回
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" className="h-7" onClick={handleCreateNew}>
              <Plus className="mr-1 h-3 w-3" />
              新建客户
            </Button>
          </div>
        </div>
      </div>

      {/* 筛选区域 */}
      <div className="border-b bg-muted/5 px-3 py-2">
        <div className="flex items-center gap-2 text-xs">
          <Filter className="h-3 w-3 text-muted-foreground" />
          <span className="text-muted-foreground">筛选条件</span>
        </div>
        <div className="mt-2 grid grid-cols-1 gap-x-4 gap-y-2 md:grid-cols-4">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">搜索客户</label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="客户名称或电话"
                value={queryParams.search}
                onChange={e => handleSearch(e.target.value)}
                className="h-7 pl-7 text-xs"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">排序方式</label>
            <Select
              value={queryParams.sortBy || 'createdAt'}
              onValueChange={handleSort}
            >
              <SelectTrigger className="h-7 text-xs">
                <SelectValue placeholder="排序方式" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="createdAt">创建时间</SelectItem>
                <SelectItem value="name">客户名称</SelectItem>
                <SelectItem value="updatedAt">更新时间</SelectItem>
                <SelectItem value="transactionCount">交易次数</SelectItem>
                <SelectItem value="cooperationDays">合作天数</SelectItem>
                <SelectItem value="returnOrderCount">退货次数</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">&nbsp;</label>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7"
                onClick={resetFilters}
              >
                <RotateCcw className="mr-1 h-3 w-3" />
                重置
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* 表格区域 */}
      <div className="px-3 py-2">
        <div className="mb-2 text-xs font-medium text-muted-foreground">
          客户列表
        </div>
        <div className="rounded border">
          <Table>
            <TableHeader>
              <TableRow className="h-8">
                <TableHead className="h-8 px-2 text-xs">客户名称</TableHead>
                <TableHead className="h-8 px-2 text-xs">联系电话</TableHead>
                <TableHead className="h-8 px-2 text-xs">地址</TableHead>
                <TableHead className="h-8 px-2 text-xs">交易次数</TableHead>
                <TableHead className="h-8 px-2 text-xs">合作天数</TableHead>
                <TableHead className="h-8 px-2 text-xs">退货次数</TableHead>
                <TableHead className="h-8 px-2 text-xs">创建时间</TableHead>
                <TableHead className="h-8 w-[80px] px-2 text-xs">
                  操作
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="h-10 text-center text-xs text-muted-foreground"
                  >
                    加载中...
                  </TableCell>
                </TableRow>
              ) : customers.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="h-10 text-center text-xs text-muted-foreground"
                  >
                    暂无客户记录
                  </TableCell>
                </TableRow>
              ) : (
                customers.map(customer => (
                  <TableRow key={customer.id} className="h-10">
                    <TableCell className="px-2 py-1">
                      <div className="flex items-center gap-2">
                        <Users className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs font-medium">
                          {customer.name}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="px-2 py-1">
                      <div className="flex items-center gap-1">
                        <Phone className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs">{customer.phone || '-'}</span>
                      </div>
                    </TableCell>
                    <TableCell className="px-2 py-1">
                      <div
                        className="max-w-[120px] truncate text-xs"
                        title={customer.address}
                      >
                        {customer.address || '-'}
                      </div>
                    </TableCell>
                    <TableCell className="px-2 py-1">
                      <Badge variant="outline" className="text-xs">
                        {customer.transactionCount || 0}次
                      </Badge>
                    </TableCell>
                    <TableCell className="px-2 py-1">
                      <Badge
                        variant={
                          customer.cooperationDays !== undefined
                            ? 'default'
                            : 'secondary'
                        }
                        className="text-xs"
                      >
                        {customer.cooperationDays !== undefined
                          ? `${customer.cooperationDays}天`
                          : '未下单'}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-2 py-1">
                      <Badge
                        variant={
                          customer.returnOrderCount &&
                          customer.returnOrderCount > 0
                            ? 'destructive'
                            : 'outline'
                        }
                        className="text-xs"
                      >
                        {customer.returnOrderCount || 0}次
                      </Badge>
                    </TableCell>
                    <TableCell className="px-2 py-1">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs">
                          {formatDate(customer.createdAt)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="px-2 py-1">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                          >
                            <MoreHorizontal className="h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="text-xs">
                          <DropdownMenuItem
                            onClick={() => handleViewDetail(customer)}
                          >
                            <Eye className="mr-1 h-3 w-3" />
                            查看详情
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleEdit(customer)}
                          >
                            <Edit className="mr-1 h-3 w-3" />
                            编辑
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => handleDelete(customer)}
                          >
                            <Trash2 className="mr-1 h-3 w-3" />
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
    </div>
  );
}
