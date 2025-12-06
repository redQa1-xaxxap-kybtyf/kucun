'use client';

/**
 * 外调产品库客户端组件
 */

import { useQuery } from '@tanstack/react-query';
import { Calendar, Package, TrendingUp, User } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { useDebouncedCallback } from '@/hooks/use-debounced-search';
import { useSuppliers } from '@/hooks/use-suppliers';
import { PRODUCT_UNIT_LABELS } from '@/lib/types/product';
import type { Supplier } from '@/lib/types/supplier';
import { formatDateTime } from '@/lib/utils/datetime';

interface TemporaryProduct {
  id: string;
  supplierId: string;
  supplierName: string;
  supplierCode: string | null;
  code: string;
  name: string;
  specification: string | null;
  weight: number | null;
  unit: string;
  piecesPerUnit: number;
  usageCount: number;
  lastUsedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  creatorName: string | null;
  salesOrderCount: number;
  factoryShipmentCount: number;
  totalUsageCount: number;
}

interface TemporaryProductsResponse {
  success: boolean;
  data: {
    items: TemporaryProduct[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  };
}

// 统一外调产品的单位展示为中文"件/片"
const getUnitLabel = (unit: string | null | undefined) => {
  if (!unit) return '-';
  return PRODUCT_UNIT_LABELS[unit] ?? unit;
};

// eslint-disable-next-line max-lines-per-function
export function TemporaryProductsClient() {
  const [supplierFilter, setSupplierFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('usageCount');
  const [page, setPage] = useState(1);
  const limit = 20;

  // 获取供应商列表
  const { data: suppliersData } = useSuppliers();
  const suppliers = suppliersData?.data || [];

  // 获取外调产品列表
  const { data, isLoading, error } = useQuery({
    queryKey: [
      'temporary-products',
      supplierFilter,
      search,
      sortBy,
      page,
    ] as const,
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        sortBy,
        sortOrder: 'desc',
      });

      if (supplierFilter !== 'all') {
        params.append('supplierId', supplierFilter);
      }

      if (search) {
        params.append('search', search);
      }

      const res = await fetch(`/api/temporary-products?${params}`);
      if (!res.ok) throw new Error('查询失败');
      return res.json() as Promise<TemporaryProductsResponse>;
    },
  });

  const products = data?.data.items || [];
  const pagination = data?.data.pagination;

  // 使用防抖处理搜索输入
  const debouncedSearch = useDebouncedCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, 300);

  // 处理搜索输入变化
  const handleSearchChange = (value: string) => {
    debouncedSearch(value);
  };

  return (
    <div className="space-y-4">
      {/* 筛选和搜索栏 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">筛选和搜索</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid gap-3 md:grid-cols-4">
            {/* 供应商筛选 */}
            <div className="space-y-2">
              <label className="text-sm font-medium">供应商</label>
              <Select value={supplierFilter} onValueChange={setSupplierFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="选择供应商" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部供应商</SelectItem>
                  {suppliers.map((supplier: Supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
                      {supplier.supplierCode && ` (${supplier.supplierCode})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 排序方式 */}
            <div className="space-y-2">
              <label className="text-sm font-medium">排序方式</label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="usageCount">使用次数</SelectItem>
                  <SelectItem value="lastUsedAt">最后使用时间</SelectItem>
                  <SelectItem value="name">产品名称</SelectItem>
                  <SelectItem value="code">产品编码</SelectItem>
                  <SelectItem value="createdAt">创建时间</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 搜索框 */}
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium">搜索</label>
              <div className="flex gap-2">
                <Input
                  placeholder="搜索编码、名称或规格..."
                  onChange={e => handleSearchChange(e.target.value)}
                  className="flex-1"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 统计信息 */}
      {pagination && (
        <div className="grid gap-3 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-muted-foreground text-xs font-medium">
                外调产品总数
              </CardTitle>
              <Package className="text-muted-foreground h-3.5 w-3.5" />
            </CardHeader>
            <CardContent className="pb-3">
              <div className="text-xl font-bold">{pagination.total}</div>
              <p className="text-muted-foreground mt-0.5 text-xs">
                当前筛选: {products.length} 条
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-muted-foreground text-xs font-medium">
                总使用次数
              </CardTitle>
              <TrendingUp className="text-muted-foreground h-3.5 w-3.5" />
            </CardHeader>
            <CardContent className="pb-3">
              <div className="text-xl font-bold">
                {products.reduce(
                  (sum: number, p: TemporaryProduct) => sum + p.usageCount,
                  0
                )}
              </div>
              <p className="text-muted-foreground mt-0.5 text-xs">
                销售订单 + 厂家发货
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-muted-foreground text-xs font-medium">
                活跃供应商
              </CardTitle>
              <User className="text-muted-foreground h-3.5 w-3.5" />
            </CardHeader>
            <CardContent className="pb-3">
              <div className="text-xl font-bold">
                {
                  new Set(products.map((p: TemporaryProduct) => p.supplierId))
                    .size
                }
              </div>
              <p className="text-muted-foreground mt-0.5 text-xs">
                当前筛选范围内
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 外调产品列表 */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-muted-foreground text-sm">加载中...</div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-destructive text-sm">加载失败,请重试</div>
            </div>
          ) : products.length === 0 ? (
            <div className="text-muted-foreground flex flex-col items-center justify-center py-10">
              <Package className="mb-3 h-10 w-10 opacity-50" />
              <p className="text-sm font-medium">暂无外调产品记录</p>
              <p className="mt-1 text-xs">
                外调产品会在创建调货销售订单时自动记录
              </p>
            </div>
          ) : (
            <>
              {/* 桌面端表格视图 */}
              <div className="hidden overflow-x-auto md:block">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="h-9 text-xs">供应商</TableHead>
                      <TableHead className="h-9 text-xs">编码</TableHead>
                      <TableHead className="h-9 text-xs">名称</TableHead>
                      <TableHead className="h-9 text-xs">规格</TableHead>
                      <TableHead className="h-9 text-center text-xs">
                        单位
                      </TableHead>
                      <TableHead className="h-9 text-center text-xs">
                        每件片数
                      </TableHead>
                      <TableHead className="h-9 text-center text-xs">
                        使用次数
                      </TableHead>
                      <TableHead className="h-9 text-xs">最后使用</TableHead>
                      <TableHead className="h-9 text-xs">创建人</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.map((product: TemporaryProduct) => (
                      <TableRow key={product.id} className="h-12">
                        <TableCell className="py-2">
                          <div>
                            <div className="text-sm font-medium">
                              {product.supplierName}
                            </div>
                            {product.supplierCode && (
                              <div className="text-muted-foreground text-xs">
                                {product.supplierCode}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-2 font-mono text-sm">
                          {product.code}
                        </TableCell>
                        <TableCell className="py-2 text-sm">
                          {product.name}
                        </TableCell>
                        <TableCell className="text-muted-foreground py-2 text-sm">
                          {product.specification || '-'}
                        </TableCell>
                        <TableCell className="py-2 text-center text-sm">
                          {getUnitLabel(product.unit)}
                        </TableCell>
                        <TableCell className="py-2 text-center text-sm">
                          {product.piecesPerUnit}
                        </TableCell>
                        <TableCell className="py-2 text-center">
                          <div>
                            <div className="text-sm font-medium">
                              {product.usageCount}
                            </div>
                            <div className="text-muted-foreground text-xs">
                              销售:{product.salesOrderCount} / 厂发:
                              {product.factoryShipmentCount}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="py-2">
                          {product.lastUsedAt ? (
                            <div className="flex items-center gap-1 text-xs">
                              <Calendar className="h-3 w-3" />
                              <span className="text-muted-foreground">
                                {formatDateTime(new Date(product.lastUsedAt))}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">
                              -
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground py-2 text-sm">
                          {product.creatorName || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* 移动端卡片视图 */}
              <div className="space-y-3 px-4 py-3 md:hidden">
                {products.map((product: TemporaryProduct) => (
                  <div
                    key={product.id}
                    className="card-shadow-light rounded-lg border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-card))] p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs text-[hsl(var(--color-text-secondary))]">
                          {product.supplierName}
                        </div>
                        {product.supplierCode && (
                          <div className="text-muted-foreground text-xs">
                            {product.supplierCode}
                          </div>
                        )}
                        <div className="mt-1 font-mono text-sm font-semibold">
                          {product.code}
                        </div>
                        <div className="text-sm font-medium text-[hsl(var(--color-text-primary))]">
                          {product.name}
                        </div>
                        {product.specification && (
                          <div className="mt-1 line-clamp-2 text-xs text-[hsl(var(--color-text-secondary))]">
                            {product.specification}
                          </div>
                        )}
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[hsl(var(--color-text-secondary))]">
                          <span>单位：{getUnitLabel(product.unit)}</span>
                          <span>每件：{product.piecesPerUnit}片</span>
                        </div>
                      </div>
                      <div className="shrink-0 text-right text-xs text-[hsl(var(--color-text-secondary))]">
                        <div className="flex items-center justify-end gap-1">
                          <TrendingUp className="h-3 w-3" />
                          <span className="font-medium text-[hsl(var(--color-text-primary))]">
                            {product.usageCount}
                          </span>
                        </div>
                        <div className="mt-1 text-[hsl(var(--color-text-secondary))]">
                          销售:{product.salesOrderCount} / 厂发:
                          {product.factoryShipmentCount}
                        </div>
                        <div className="mt-2">
                          {product.lastUsedAt ? (
                            <div className="flex items-center justify-end gap-1">
                              <Calendar className="h-3 w-3" />
                              <span>
                                {formatDateTime(new Date(product.lastUsedAt))}
                              </span>
                            </div>
                          ) : (
                            <span>暂无使用记录</span>
                          )}
                        </div>
                        <div className="mt-1 text-xs text-[hsl(var(--color-text-tertiary))]">
                          创建人：{product.creatorName || '-'}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* 分页 */}
              {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-between border-t px-4 py-3">
                  <div className="text-muted-foreground text-xs">
                    共 {pagination.total} 条记录，第 {pagination.page} /{' '}
                    {pagination.totalPages} 页
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      上一页
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() =>
                        setPage(p => Math.min(pagination.totalPages, p + 1))
                      }
                      disabled={page === pagination.totalPages}
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

      {/* 使用说明 */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardContent className="py-3">
          <div className="flex gap-2.5">
            <div className="mt-0.5 text-blue-600">
              <Package className="h-4 w-4" />
            </div>
            <div className="space-y-0.5 text-xs">
              <p className="font-medium text-blue-900">关于外调产品</p>
              <p className="text-blue-700">
                • 外调产品由系统在创建调货销售订单时自动记录和管理
              </p>
              <p className="text-blue-700">
                • 同一供应商的相同编码会自动复用,并更新使用统计
              </p>
              <p className="text-blue-700">
                • 此页面仅用于查询和检索,不提供手动创建/编辑/删除功能
              </p>
              <p className="text-blue-700">
                • 使用次数反映了该外调产品在订单中被使用的总次数
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
