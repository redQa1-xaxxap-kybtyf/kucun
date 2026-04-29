'use client';

/**
 * 外采产品库客户端组件
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Calendar, Edit, Package, Plus, TrendingUp, User } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { useListSearchController } from '@/hooks/use-list-search-controller';
import { useSuppliers } from '@/hooks/use-suppliers';
import { PRODUCT_UNIT_LABELS } from '@/lib/types/product';
import type { Supplier } from '@/lib/types/supplier';
import { formatDateTime } from '@/lib/utils/datetime';
import { formatCurrency } from '@/lib/utils/format';

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
  description: string | null;
  thumbnailUrl: string | null;
  images: string | null;
  showInMiniProgram: boolean;
  usageCount: number;
  lastUsedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  creatorName: string | null;
  salesOrderCount: number;
  factoryShipmentCount: number;
  totalUsageCount: number;
  latestCostPrice: number | null;
  latestSalePrice: number | null;
  latestPriceSource: string | null;
  latestPriceOrderNumber: string | null;
  latestPriceDate: string | null;
  priceRemarks: string | null;
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

interface ExternalProductFormState {
  supplierId: string;
  code: string;
  name: string;
  specification: string;
  weight: string;
  unit: string;
  piecesPerUnit: string;
  description: string;
  thumbnailUrl: string;
  showInMiniProgram: boolean;
  latestCostPrice: string;
  latestSalePrice: string;
  priceRemarks: string;
}

const emptyForm: ExternalProductFormState = {
  supplierId: '',
  code: '',
  name: '',
  specification: '',
  weight: '',
  unit: '片',
  piecesPerUnit: '1',
  description: '',
  thumbnailUrl: '',
  showInMiniProgram: true,
  latestCostPrice: '',
  latestSalePrice: '',
  priceRemarks: '',
};

// 统一调货产品的单位展示为中文"件/片"
const getUnitLabel = (unit: string | null | undefined) => {
  if (!unit) return '-';
  return PRODUCT_UNIT_LABELS[unit] ?? unit;
};

function formatOptionalCurrency(value: number | null | undefined) {
  return value === null || value === undefined ? '-' : formatCurrency(value);
}

function normalizeSearch(value?: string) {
  const trimmed = value?.trim() ?? '';
  return trimmed ? trimmed : undefined;
}

function getCsrfToken() {
  if (typeof document === 'undefined') return '';
  const item = document.cookie
    .split('; ')
    .find(cookie => cookie.startsWith('csrf_token='));
  return item ? decodeURIComponent(item.split('=')[1] ?? '') : '';
}

function toFormState(product?: TemporaryProduct): ExternalProductFormState {
  if (!product) return emptyForm;

  return {
    supplierId: product.supplierId,
    code: product.code,
    name: product.name,
    specification: product.specification ?? '',
    weight: product.weight === null ? '' : String(product.weight),
    unit: product.unit || '片',
    piecesPerUnit: String(product.piecesPerUnit || 1),
    description: product.description ?? '',
    thumbnailUrl: product.thumbnailUrl ?? '',
    showInMiniProgram: product.showInMiniProgram,
    latestCostPrice:
      product.latestCostPrice === null ? '' : String(product.latestCostPrice),
    latestSalePrice:
      product.latestSalePrice === null ? '' : String(product.latestSalePrice),
    priceRemarks: product.priceRemarks ?? '',
  };
}

function toPayload(form: ExternalProductFormState) {
  return {
    supplierId: form.supplierId,
    code: form.code.trim(),
    name: form.name.trim(),
    specification: normalizeSearch(form.specification) ?? null,
    weight: form.weight ? Number(form.weight) : null,
    unit: form.unit.trim() || '片',
    piecesPerUnit: form.piecesPerUnit ? Number(form.piecesPerUnit) : 1,
    description: normalizeSearch(form.description) ?? null,
    thumbnailUrl: normalizeSearch(form.thumbnailUrl) ?? null,
    showInMiniProgram: form.showInMiniProgram,
    latestCostPrice: form.latestCostPrice ? Number(form.latestCostPrice) : null,
    latestSalePrice: form.latestSalePrice ? Number(form.latestSalePrice) : null,
    priceRemarks: normalizeSearch(form.priceRemarks) ?? null,
  };
}

// eslint-disable-next-line max-lines-per-function
export function TemporaryProductsClient() {
  const [supplierFilter, setSupplierFilter] = React.useState<string>('all');
  const [search, setSearch] = React.useState('');
  const [sortBy, setSortBy] = React.useState('usageCount');
  const [page, setPage] = React.useState(1);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingProduct, setEditingProduct] =
    React.useState<TemporaryProduct | null>(null);
  const [form, setForm] = React.useState<ExternalProductFormState>(emptyForm);
  const limit = 20;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { searchInput, handleSearchChange, cancelPendingCommit } =
    useListSearchController({
      committedValue: search,
      onCommit: value => {
        setSearch(value ?? '');
        setPage(1);
      },
    });

  // 获取供应商列表
  const { data: suppliersData } = useSuppliers();
  const suppliers = React.useMemo(
    () => suppliersData?.data || [],
    [suppliersData?.data]
  );

  // 获取外采产品列表
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

  const saveMutation = useMutation({
    mutationFn: async () => {
      const csrfToken = getCsrfToken();
      const res = await fetch(
        editingProduct
          ? `/api/temporary-products/${editingProduct.id}`
          : '/api/temporary-products',
        {
          method: editingProduct ? 'PUT' : 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
          },
          body: JSON.stringify(toPayload(form)),
        }
      );
      const result = (await res.json()) as {
        success: boolean;
        error?: string;
      };
      if (!res.ok || !result.success) {
        throw new Error(result.error || '保存失败');
      }
      return result;
    },
    onSuccess: () => {
      toast({
        title: editingProduct ? '外采产品已更新' : '外采产品已新增',
      });
      setDialogOpen(false);
      setEditingProduct(null);
      setForm(emptyForm);
      queryClient.invalidateQueries({ queryKey: ['temporary-products'] });
    },
    onError: error => {
      toast({
        title: '保存失败',
        description: error instanceof Error ? error.message : '请稍后重试',
        variant: 'destructive',
      });
    },
  });

  const syncPendingSearch = React.useCallback(() => {
    cancelPendingCommit();
    const nextSearch = normalizeSearch(searchInput);
    setSearch(nextSearch ?? '');
    return nextSearch;
  }, [cancelPendingCommit, searchInput]);

  const openCreateDialog = React.useCallback(() => {
    setEditingProduct(null);
    setForm({
      ...emptyForm,
      supplierId:
        supplierFilter !== 'all'
          ? supplierFilter
          : (suppliers[0] as Supplier | undefined)?.id || '',
    });
    setDialogOpen(true);
  }, [supplierFilter, suppliers]);

  const openEditDialog = React.useCallback((product: TemporaryProduct) => {
    setEditingProduct(product);
    setForm(toFormState(product));
    setDialogOpen(true);
  }, []);

  const updateForm = React.useCallback(
    <K extends keyof ExternalProductFormState>(
      key: K,
      value: ExternalProductFormState[K]
    ) => {
      setForm(prev => ({ ...prev, [key]: value }));
    },
    []
  );

  const handleSave = React.useCallback(() => {
    if (!form.supplierId || !form.code.trim() || !form.name.trim()) {
      toast({
        title: '请补全必填信息',
        description: '供应商、编码和名称必须填写。',
        variant: 'destructive',
      });
      return;
    }
    saveMutation.mutate();
  }, [form, saveMutation, toast]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-lg border bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-semibold">外采产品维护</div>
          <div className="text-muted-foreground mt-1 text-xs">
            这里记录其他公司的产品和内部报价；小程序只展示产品资料，不展示价格。
          </div>
        </div>
        <Button className="h-9 gap-2" onClick={openCreateDialog}>
          <Plus className="h-4 w-4" />
          新增外采产品
        </Button>
      </div>

      {/* 筛选和搜索栏 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">筛选和搜索</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid gap-3 md:grid-cols-4">
            {/* 供应商筛选 */}
            <div className="space-y-2">
              <label
                className="text-sm font-medium"
                htmlFor="temporary-products-supplier"
              >
                供应商
              </label>
              <select
                id="temporary-products-supplier"
                value={supplierFilter}
                onChange={e => {
                  syncPendingSearch();
                  setSupplierFilter(e.target.value);
                  setPage(1);
                }}
                className="border-input bg-background ring-offset-background focus:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="all">全部供应商</option>
                {suppliers.map((supplier: Supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                    {supplier.supplierCode && ` (${supplier.supplierCode})`}
                  </option>
                ))}
              </select>
            </div>

            {/* 排序方式 */}
            <div className="space-y-2">
              <label
                className="text-sm font-medium"
                htmlFor="temporary-products-sort"
              >
                排序方式
              </label>
              <select
                id="temporary-products-sort"
                value={sortBy}
                onChange={e => {
                  syncPendingSearch();
                  setSortBy(e.target.value);
                  setPage(1);
                }}
                className="border-input bg-background ring-offset-background focus:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="usageCount">使用次数</option>
                <option value="lastUsedAt">最后使用时间</option>
                <option value="name">产品名称</option>
                <option value="code">产品编码</option>
                <option value="createdAt">创建时间</option>
              </select>
            </div>

            {/* 搜索框 */}
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium">搜索</label>
              <div className="flex gap-2">
                <Input
                  value={searchInput}
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
                外采产品总数
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

      {/* 外采产品列表 */}
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
              <p className="text-sm font-medium">暂无外采产品记录</p>
              <p className="mt-1 text-xs">
                外采产品会在创建调货销售订单时自动记录
              </p>
            </div>
          ) : (
            <>
              {/* 桌面端表格视图 */}
              <div className="hidden overflow-x-auto md:block">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>供应商</TableHead>
                      <TableHead>编码</TableHead>
                      <TableHead>名称</TableHead>
                      <TableHead>规格</TableHead>
                      <TableHead className="text-center">单位</TableHead>
                      <TableHead className="text-center">装箱数</TableHead>
                      <TableHead>最近价格</TableHead>
                      <TableHead className="text-center">使用次数</TableHead>
                      <TableHead className="text-center">小程序</TableHead>
                      <TableHead>最后使用</TableHead>
                      <TableHead>创建人</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.map((product: TemporaryProduct) => (
                      <TableRow key={product.id} className="h-12">
                        <TableCell className="py-3">
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
                        <TableCell className="py-3 font-mono text-sm">
                          {product.code}
                        </TableCell>
                        <TableCell className="py-3 text-sm">
                          {product.name}
                        </TableCell>
                        <TableCell className="text-muted-foreground py-3 text-sm">
                          {product.specification || '-'}
                        </TableCell>
                        <TableCell className="py-3 text-center text-sm">
                          {getUnitLabel(product.unit)}
                        </TableCell>
                        <TableCell className="py-3 text-center text-sm">
                          {product.piecesPerUnit}
                        </TableCell>
                        <TableCell className="py-3">
                          <div className="text-sm">
                            <div className="font-medium">
                              成本{' '}
                              {formatOptionalCurrency(product.latestCostPrice)}
                            </div>
                            <div className="text-muted-foreground text-xs">
                              售价{' '}
                              {formatOptionalCurrency(product.latestSalePrice)}
                              {product.latestPriceSource &&
                                ` · ${product.latestPriceSource}`}
                            </div>
                            {product.latestPriceOrderNumber && (
                              <div className="text-muted-foreground text-xs">
                                {product.latestPriceOrderNumber}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-3 text-center">
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
                        <TableCell className="py-3 text-center text-sm">
                          {product.showInMiniProgram ? (
                            <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
                              展示
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">
                              隐藏
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="py-3">
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
                        <TableCell className="text-muted-foreground py-3 text-sm">
                          {product.creatorName || '-'}
                        </TableCell>
                        <TableCell className="py-3 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-1"
                            onClick={() => openEditDialog(product)}
                          >
                            <Edit className="h-3.5 w-3.5" />
                            编辑
                          </Button>
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
                    className="rounded-md border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-card))] p-4 shadow-sm"
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
                        <div className="mt-2 rounded-md bg-[hsl(var(--color-bg-subtle))] px-2 py-1.5 text-xs text-[hsl(var(--color-text-secondary))]">
                          <span className="font-medium text-[hsl(var(--color-text-primary))]">
                            成本：
                            {formatOptionalCurrency(product.latestCostPrice)}
                          </span>
                          <span className="ml-2">
                            售价：
                            {formatOptionalCurrency(product.latestSalePrice)}
                          </span>
                          {product.latestPriceSource && (
                            <span className="ml-2">
                              {product.latestPriceSource}
                            </span>
                          )}
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <span
                            className={
                              product.showInMiniProgram
                                ? 'rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700'
                                : 'text-xs text-[hsl(var(--color-text-tertiary))]'
                            }
                          >
                            {product.showInMiniProgram
                              ? '小程序展示'
                              : '小程序隐藏'}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 gap-1 px-2 text-xs"
                            onClick={() => openEditDialog(product)}
                          >
                            <Edit className="h-3 w-3" />
                            编辑
                          </Button>
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
                      onClick={() => {
                        syncPendingSearch();
                        setPage(p => Math.max(1, p - 1));
                      }}
                      disabled={page === 1}
                    >
                      上一页
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => {
                        syncPendingSearch();
                        setPage(p => Math.min(pagination.totalPages, p + 1));
                      }}
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? '编辑外采产品' : '新增外采产品'}
            </DialogTitle>
            <DialogDescription>
              价格仅供内部开单参考，普通客户小程序不会展示。
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="external-product-supplier">供应商</Label>
              <select
                id="external-product-supplier"
                value={form.supplierId}
                onChange={event => updateForm('supplierId', event.target.value)}
                className="border-input bg-background ring-offset-background focus:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:ring-offset-2 focus:outline-hidden"
              >
                <option value="">请选择供应商</option>
                {suppliers.map((supplier: Supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                    {supplier.supplierCode && ` (${supplier.supplierCode})`}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="external-product-code">产品编码</Label>
              <Input
                id="external-product-code"
                value={form.code}
                onChange={event => updateForm('code', event.target.value)}
                placeholder="例如 YSB-800"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="external-product-name">产品名称</Label>
              <Input
                id="external-product-name"
                value={form.name}
                onChange={event => updateForm('name', event.target.value)}
                placeholder="例如 雅士白转角石"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="external-product-spec">规格</Label>
              <Input
                id="external-product-spec"
                value={form.specification}
                onChange={event =>
                  updateForm('specification', event.target.value)
                }
                placeholder="例如 300x600"
              />
            </div>

            <div className="grid grid-cols-3 gap-3 md:col-span-2">
              <div className="space-y-2">
                <Label htmlFor="external-product-unit">单位</Label>
                <Input
                  id="external-product-unit"
                  value={form.unit}
                  onChange={event => updateForm('unit', event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="external-product-pieces">装箱数</Label>
                <Input
                  id="external-product-pieces"
                  type="number"
                  min="1"
                  value={form.piecesPerUnit}
                  onChange={event =>
                    updateForm('piecesPerUnit', event.target.value)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="external-product-weight">重量</Label>
                <Input
                  id="external-product-weight"
                  type="number"
                  min="0"
                  step="0.001"
                  value={form.weight}
                  onChange={event => updateForm('weight', event.target.value)}
                  placeholder="kg"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="external-product-cost">成本价</Label>
              <Input
                id="external-product-cost"
                type="number"
                min="0"
                step="0.001"
                value={form.latestCostPrice}
                onChange={event =>
                  updateForm('latestCostPrice', event.target.value)
                }
                placeholder="内部查看"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="external-product-sale">参考售价</Label>
              <Input
                id="external-product-sale"
                type="number"
                min="0"
                step="0.01"
                value={form.latestSalePrice}
                onChange={event =>
                  updateForm('latestSalePrice', event.target.value)
                }
                placeholder="内部查看"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="external-product-image">主图地址</Label>
              <Input
                id="external-product-image"
                value={form.thumbnailUrl}
                onChange={event =>
                  updateForm('thumbnailUrl', event.target.value)
                }
                placeholder="可填图片 URL，后续可再接入上传"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="external-product-description">产品介绍</Label>
              <Textarea
                id="external-product-description"
                value={form.description}
                onChange={event =>
                  updateForm('description', event.target.value)
                }
                placeholder="客户可见，避免填写价格和供应商内部信息"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="external-product-price-remarks">价格备注</Label>
              <Textarea
                id="external-product-price-remarks"
                value={form.priceRemarks}
                onChange={event =>
                  updateForm('priceRemarks', event.target.value)
                }
                placeholder="仅内部可见，例如报价有效期、拿货条件"
              />
            </div>

            <label className="flex items-center gap-2 text-sm md:col-span-2">
              <input
                type="checkbox"
                checked={form.showInMiniProgram}
                onChange={event =>
                  updateForm('showInMiniProgram', event.target.checked)
                }
              />
              在小程序客户目录展示
            </label>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saveMutation.isPending}
            >
              取消
            </Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
