'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Edit,
  Trash2,
  Eye,
  Package,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
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
import { Progress } from '@/components/ui/progress';
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
import { getInventories, inventoryQueryKeys } from '@/lib/api/inventory';
import type { Inventory, InventoryQueryParams } from '@/lib/types/inventory';

/**
 * 库存管理页面
 * 严格遵循全栈项目统一约定规范
 */
export default function InventoryPage() {
  const router = useRouter();
  const [queryParams, setQueryParams] = React.useState<InventoryQueryParams>({
    page: 1,
    limit: 20,
    search: '',
    lowStock: false,
    sortBy: 'updatedAt',
    sortOrder: 'desc',
  });

  // 获取库存列表数据
  const { data, isLoading, error } = useQuery({
    queryKey: inventoryQueryKeys.list(queryParams),
    queryFn: () => getInventories(queryParams),
  });

  // 搜索处理
  const handleSearch = (value: string) => {
    setQueryParams(prev => ({ ...prev, search: value, page: 1 }));
  };

  // 筛选处理
  const handleFilter = (key: keyof InventoryQueryParams, value: any) => {
    setQueryParams(prev => ({ ...prev, [key]: value, page: 1 }));
  };

  // 分页处理
  const handlePageChange = (page: number) => {
    setQueryParams(prev => ({ ...prev, page }));
  };

  // 库存状态判断
  const getStockStatus = (quantity: number, minStock: number = 10) => {
    if (quantity <= 0) {
      return {
        status: 'out',
        label: '缺货',
        variant: 'destructive' as const,
        color: 'text-red-600',
      };
    } else if (quantity <= minStock) {
      return {
        status: 'low',
        label: '库存不足',
        variant: 'secondary' as const,
        color: 'text-yellow-600',
      };
    } else {
      return {
        status: 'normal',
        label: '正常',
        variant: 'default' as const,
        color: 'text-green-600',
      };
    }
  };

  // 库存状态标签渲染
  const getStockBadge = (quantity: number, minStock?: number) => {
    const { label, variant } = getStockStatus(quantity, minStock);
    return <Badge variant={variant}>{label}</Badge>;
  };

  // 库存进度条
  const getStockProgress = (quantity: number, maxStock: number = 100) => {
    const percentage = Math.min((quantity / maxStock) * 100, 100);
    return (
      <div className="flex items-center gap-2">
        <Progress value={percentage} className="flex-1" />
        <span className="min-w-[3rem] text-sm text-muted-foreground">
          {percentage.toFixed(0)}%
        </span>
      </div>
    );
  };

  // 移动端表格列配置
  const mobileColumns = [
    {
      key: 'product',
      title: '产品',
      mobilePrimary: true,
      render: (item: Inventory) => item.product?.name || '-',
    },
    {
      key: 'quantity',
      title: '库存数量',
      render: (item: Inventory) =>
        `${item.quantity} ${item.product?.unit || ''}`,
    },
    {
      key: 'status',
      title: '状态',
      render: (item: Inventory) => getStockBadge(item.quantity, 10),
    },
    {
      key: 'reservedQuantity',
      title: '预留',
      render: (item: Inventory) => `${item.reservedQuantity || 0}`,
    },
  ];

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">库存管理</h1>
          <p className="text-muted-foreground">查看和管理所有产品的库存信息</p>
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
          <h1 className="text-3xl font-bold tracking-tight">库存管理</h1>
          <p className="text-muted-foreground">查看和管理所有产品的库存信息</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => router.push('/inventory/inbound')}
          >
            <TrendingUp className="mr-2 h-4 w-4" />
            入库记录
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push('/inventory/outbound')}
          >
            <TrendingDown className="mr-2 h-4 w-4" />
            出库记录
          </Button>
          <Button onClick={() => router.push('/inventory/adjust')}>
            <Plus className="mr-2 h-4 w-4" />
            库存调整
          </Button>
        </div>
      </div>

      {/* 搜索和筛选 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="搜索产品名称或编码..."
                  value={queryParams.search}
                  onChange={e => handleSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant={queryParams.lowStock ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleFilter('lowStock', !queryParams.lowStock)}
              >
                <AlertTriangle className="mr-2 h-4 w-4" />
                库存不足
              </Button>
              <Select
                value={queryParams.sortBy || 'updatedAt'}
                onValueChange={value => handleFilter('sortBy', value)}
              >
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="排序" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="updatedAt">更新时间</SelectItem>
                  <SelectItem value="quantity">库存数量</SelectItem>
                  <SelectItem value="product.name">产品名称</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 库存列表 */}
      <Card>
        <CardHeader>
          <CardTitle>库存列表</CardTitle>
          <CardDescription>
            {data?.pagination
              ? `共 ${data.pagination.total} 个产品库存`
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
                      <TableHead>产品信息</TableHead>
                      <TableHead>当前库存</TableHead>
                      <TableHead>预留数量</TableHead>
                      <TableHead>可用库存</TableHead>
                      <TableHead>库存状态</TableHead>
                      <TableHead>最后更新</TableHead>
                      <TableHead className="w-[100px]">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.data?.map(inventory => {
                      const availableQuantity =
                        inventory.quantity - (inventory.reservedQuantity || 0);
                      return (
                        <TableRow key={inventory.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Package className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <div className="font-medium">
                                  {inventory.product?.name || '-'}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {inventory.product?.code || '-'}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">
                              {inventory.quantity}{' '}
                              {inventory.product?.unit || ''}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-muted-foreground">
                              {inventory.reservedQuantity || 0}{' '}
                              {inventory.product?.unit || ''}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">
                              {availableQuantity}{' '}
                              {inventory.product?.unit || ''}
                            </div>
                          </TableCell>
                          <TableCell>
                            {getStockBadge(inventory.quantity, 10)}
                          </TableCell>
                          <TableCell>
                            {new Date(inventory.updatedAt).toLocaleDateString()}
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
                                    router.push(`/inventory/${inventory.id}`)
                                  }
                                >
                                  <Eye className="mr-2 h-4 w-4" />
                                  查看详情
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() =>
                                    router.push(
                                      `/inventory/${inventory.id}/adjust`
                                    )
                                  }
                                >
                                  <Edit className="mr-2 h-4 w-4" />
                                  库存调整
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() =>
                                    router.push(
                                      `/inventory/${inventory.id}/history`
                                    )
                                  }
                                >
                                  <Package className="mr-2 h-4 w-4" />
                                  变动记录
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* 移动端卡片 */}
              <div className="md:hidden">
                <MobileDataTable
                  data={data?.data || []}
                  columns={mobileColumns}
                  onItemClick={item => router.push(`/inventory/${item.id}`)}
                  renderActions={item => (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => router.push(`/inventory/${item.id}`)}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          查看详情
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            router.push(`/inventory/${item.id}/adjust`)
                          }
                        >
                          <Edit className="mr-2 h-4 w-4" />
                          库存调整
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            router.push(`/inventory/${item.id}/history`)
                          }
                        >
                          <Package className="mr-2 h-4 w-4" />
                          变动记录
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
