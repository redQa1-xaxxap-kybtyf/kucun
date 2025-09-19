'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Edit,
  Eye,
  MapPin,
  MoreHorizontal,
  Phone,
  Plus,
  Search,
  Trash2,
  Users,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';

// UI Components
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { MobileDataTable } from '@/components/ui/mobile-data-table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// API and Types
import { customerQueryKeys, getCustomers } from '@/lib/api/customers';
import type { Customer, CustomerQueryParams } from '@/lib/types/customer';

/**
 * 客户管理页面
 * 严格遵循全栈项目统一约定规范
 */
export default function CustomersPage() {
  const router = useRouter();
  const [queryParams, setQueryParams] = React.useState<CustomerQueryParams>({
    page: 1,
    limit: 20,
    search: '',
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });

  // 获取客户列表数据
  const { data, isLoading, error } = useQuery({
    queryKey: customerQueryKeys.list(queryParams),
    queryFn: () => getCustomers(queryParams),
  });

  // 搜索处理
  const handleSearch = (value: string) => {
    setQueryParams(prev => ({ ...prev, search: value, page: 1 }));
  };

  // 筛选处理
  const handleFilter = (key: keyof CustomerQueryParams, value: any) => {
    setQueryParams(prev => ({ ...prev, [key]: value, page: 1 }));
  };

  // 分页处理
  const handlePageChange = (page: number) => {
    setQueryParams(prev => ({ ...prev, page }));
  };

  // 移动端表格列配置
  const mobileColumns = [
    { key: 'name', title: '客户名称', mobilePrimary: true },
    { key: 'phone', title: '联系电话', mobileLabel: '电话' },
    {
      key: 'address',
      title: '地址',
      render: (item: Customer) => item.address || '-',
    },
    {
      key: 'transactionCount',
      title: '交易次数',
      render: (item: Customer) => `${item.transactionCount || 0}次`,
    },
    {
      key: 'cooperationDays',
      title: '合作天数',
      render: (item: Customer) =>
        item && item.cooperationDays !== undefined
          ? `${item.cooperationDays}天`
          : '未下单',
    },
    {
      key: 'returnOrderCount',
      title: '退货次数',
      render: (item: Customer) => `${item.returnOrderCount || 0}次`,
    },
  ];

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">客户管理</h1>
          <p className="text-muted-foreground">
            管理客户信息、联系方式和业务关系
          </p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-red-600">
              加载失败: {error instanceof Error ? error.message : '未知错误'}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">客户管理</h1>
          <p className="text-muted-foreground">
            管理客户信息、联系方式和业务关系
          </p>
        </div>
        <Button onClick={() => router.push('/customers/create')}>
          <Plus className="mr-2 h-4 w-4" />
          新建客户
        </Button>
      </div>

      {/* 搜索和筛选 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="搜索客户名称或电话..."
                  value={queryParams.search}
                  onChange={e => handleSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Select
                value={queryParams.sortBy || 'createdAt'}
                onValueChange={value => handleFilter('sortBy', value)}
              >
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="排序" />
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
          </div>
        </CardContent>
      </Card>

      {/* 客户列表 */}
      <Card>
        <CardHeader>
          <CardTitle>客户列表</CardTitle>
          <CardDescription>
            {data?.pagination
              ? `共 ${data.pagination.total} 个客户`
              : '加载中...'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center space-x-4">
                  <Skeleton className="h-12 w-12 rounded" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-[200px]" />
                    <Skeleton className="h-4 w-[150px]" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              {/* 桌面端表格 */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>客户名称</TableHead>
                      <TableHead>联系电话</TableHead>
                      <TableHead>地址</TableHead>
                      <TableHead>交易次数</TableHead>
                      <TableHead>合作天数</TableHead>
                      <TableHead>退货次数</TableHead>
                      <TableHead>创建时间</TableHead>
                      <TableHead className="w-[100px]">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.data?.map(customer => (
                      <TableRow key={customer.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            {customer.name}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            {customer.phone || '-'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            <span className="max-w-[200px] truncate">
                              {customer.address || '-'}
                            </span>
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
                        <TableCell>
                          {new Date(customer.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() =>
                                  router.push(`/customers/${customer.id}`)
                                }
                              >
                                <Eye className="mr-2 h-4 w-4" />
                                查看详情
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  router.push(`/customers/${customer.id}/edit`)
                                }
                              >
                                <Edit className="mr-2 h-4 w-4" />
                                编辑
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-red-600">
                                <Trash2 className="mr-2 h-4 w-4" />
                                删除
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* 移动端卡片 */}
              <div className="md:hidden">
                <MobileDataTable
                  data={data?.data || []}
                  columns={mobileColumns}
                  onItemClick={item => router.push(`/customers/${item.id}`)}
                  renderActions={item => (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => router.push(`/customers/${item.id}`)}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          查看详情
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            router.push(`/customers/${item.id}/edit`)
                          }
                        >
                          <Edit className="mr-2 h-4 w-4" />
                          编辑
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600">
                          <Trash2 className="mr-2 h-4 w-4" />
                          删除
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                />
              </div>

              {/* 分页 */}
              {data?.pagination && data.pagination.totalPages > 1 && (
                <div className="flex items-center justify-between pt-4">
                  <div className="text-sm text-muted-foreground">
                    显示第{' '}
                    {(data.pagination.page - 1) * data.pagination.limit + 1} -{' '}
                    {Math.min(
                      data.pagination.page * data.pagination.limit,
                      data.pagination.total
                    )}{' '}
                    条，共 {data.pagination.total} 条
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(data.pagination.page - 1)}
                      disabled={data.pagination.page <= 1}
                    >
                      上一页
                    </Button>
                    <div className="text-sm">
                      第 {data.pagination.page} / {data.pagination.totalPages}{' '}
                      页
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(data.pagination.page + 1)}
                      disabled={
                        data.pagination.page >= data.pagination.totalPages
                      }
                    >
                      下一页
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
