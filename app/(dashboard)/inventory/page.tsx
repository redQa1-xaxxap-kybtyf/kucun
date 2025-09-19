'use client';

import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Package, Plus, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';

// UI Components
import { BatchInventoryTable } from '@/components/inventory/BatchInventoryTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

// 新增组件导入

// API and Types
import { getInventories, inventoryQueryKeys } from '@/lib/api/inventory';
import type { Inventory, InventoryQueryParams } from '@/lib/types/inventory';
import { PRODUCT_UNIT_LABELS } from '@/lib/types/product';
import { formatInventoryQuantity } from '@/lib/utils/piece-calculation';

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
    hasStock: false,
    groupByVariant: false,
    includeVariants: true,
    sortBy: 'updatedAt',
    sortOrder: 'desc',
  });

  // 展开的变体组
  const [expandedVariants, setExpandedVariants] = React.useState<Set<string>>(
    new Set()
  );

  // 视图模式：table（表格）或 grouped（分组）
  const [viewMode, setViewMode] = React.useState<'table' | 'grouped'>('table');

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
      render: (item: Inventory) => {
        if (!item.product?.piecesPerUnit) {
          // 如果没有每件片数信息，使用原有显示方式
          const unit = item.product?.unit
            ? PRODUCT_UNIT_LABELS[
                item.product.unit as keyof typeof PRODUCT_UNIT_LABELS
              ] || item.product.unit
            : '件';
          return `${item.quantity} ${unit}`;
        }

        // 使用片数计算显示
        return formatInventoryQuantity(item.quantity, item.product, true);
      },
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
          <Button onClick={() => router.push('/inventory/adjust')}>
            <Plus className="mr-2 h-4 w-4" />
            库存调整
          </Button>
        </div>
      </div>

      {/* 搜索和筛选 */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            {/* 搜索栏 */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="搜索产品名称、编码、色号、批次号..."
                    value={queryParams.search}
                    onChange={e => handleSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* 视图模式切换 */}
              <div className="flex gap-2">
                <Button
                  variant={viewMode === 'table' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('table')}
                >
                  表格视图
                </Button>
                <Button
                  variant={viewMode === 'grouped' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setViewMode('grouped');
                    handleFilter('groupByVariant', true);
                  }}
                >
                  分组视图
                </Button>
              </div>
            </div>

            {/* 筛选器 */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant={queryParams.lowStock ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleFilter('lowStock', !queryParams.lowStock)}
              >
                <AlertTriangle className="mr-2 h-4 w-4" />
                库存偏低
              </Button>

              <Button
                variant={queryParams.hasStock ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleFilter('hasStock', !queryParams.hasStock)}
              >
                <Package className="mr-2 h-4 w-4" />
                有库存
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
                  <SelectItem value="productName">产品名称</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={queryParams.sortOrder || 'desc'}
                onValueChange={value => handleFilter('sortOrder', value)}
              >
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">降序</SelectItem>
                  <SelectItem value="asc">升序</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 库存列表 */}
      {isLoading ? (
        <Card>
          <CardHeader>
            <CardTitle>库存列表</CardTitle>
            <CardDescription>加载中...</CardDescription>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      ) : data?.data && data.data.length > 0 ? (
        <div className="space-y-4">
          {/* 统计信息 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>库存概览</span>
                <Badge variant="outline">
                  {data.pagination ? `共 ${data.pagination.total} 条记录` : ''}
                </Badge>
              </CardTitle>
            </CardHeader>
          </Card>

          {/* 库存表格 */}
          <BatchInventoryTable
            inventoryData={data.data}
            groupByVariant={viewMode === 'grouped'}
            showVariantInfo={true}
            onRowClick={inventory => {
              // 可以添加行点击处理逻辑
              console.log('点击库存记录:', inventory);
            }}
          />
        </div>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <div className="py-8 text-center text-muted-foreground">
              <Package className="mx-auto mb-4 h-12 w-12" />
              <p>暂无库存数据</p>
              <p className="text-sm">请检查筛选条件或添加库存记录</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 分页 */}
      {data?.pagination && data.pagination.totalPages > 1 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                第 {data.pagination.page} 页，共 {data.pagination.totalPages} 页
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(data.pagination.page - 1)}
                  disabled={data.pagination.page <= 1}
                >
                  上一页
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(data.pagination.page + 1)}
                  disabled={data.pagination.page >= data.pagination.totalPages}
                >
                  下一页
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
