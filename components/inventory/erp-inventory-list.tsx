'use client';

import { AlertTriangle, Edit, Package, Plus, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import type { Inventory, InventoryQueryParams } from '@/lib/types/inventory';
import { PRODUCT_UNIT_LABELS } from '@/lib/types/product';
import { formatInventoryQuantity } from '@/lib/utils/piece-calculation';

interface ERPInventoryListProps {
  data: {
    data: Inventory[];
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
  categoryOptions: Array<{ id: string; name: string }>;
  queryParams: InventoryQueryParams;
  onSearch: (value: string) => void;
  onFilter: (
    key: keyof InventoryQueryParams,
    value: string | number | boolean
  ) => void;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
}

/**
 * ERP风格库存列表组件
 * 符合中国ERP系统的用户体验标准
 */
export function ERPInventoryList({
  data,
  categoryOptions,
  queryParams,
  onSearch,
  onFilter,
  onPageChange,
  isLoading = false,
}: ERPInventoryListProps) {
  const router = useRouter();
  const [selectedInventoryIds, setSelectedInventoryIds] = React.useState<
    string[]
  >([]);

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
    return (
      <Badge variant={variant} className="text-xs">
        {label}
      </Badge>
    );
  };

  // 格式化库存数量显示
  const formatQuantityDisplay = (item: Inventory) => {
    if (!item.product?.piecesPerUnit) {
      const unit = item.product?.unit
        ? PRODUCT_UNIT_LABELS[
            item.product.unit as keyof typeof PRODUCT_UNIT_LABELS
          ] || item.product.unit
        : '件';
      return `${item.quantity} ${unit}`;
    }
    return formatInventoryQuantity(item.quantity, item.product, true);
  };

  // 处理行选择
  const handleRowSelect = (inventoryId: string, checked: boolean) => {
    if (checked) {
      setSelectedInventoryIds(prev => [...prev, inventoryId]);
    } else {
      setSelectedInventoryIds(prev => prev.filter(id => id !== inventoryId));
    }
  };

  // 处理全选
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedInventoryIds(data.data.map(item => item.id));
    } else {
      setSelectedInventoryIds([]);
    }
  };

  // 处理库存调整
  const handleAdjust = (inventoryId?: string) => {
    if (inventoryId) {
      router.push(`/inventory/adjust?id=${inventoryId}`);
    } else {
      router.push('/inventory/adjust');
    }
  };

  // 处理入库
  const handleInbound = () => {
    router.push('/inventory/inbound');
  };

  // 处理出库
  const handleOutbound = () => {
    router.push('/inventory/outbound');
  };

  if (isLoading) {
    return (
      <div className="rounded border bg-card">
        <div className="border-b bg-muted/30 px-3 py-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">库存管理</h3>
            <div className="text-xs text-muted-foreground">加载中...</div>
          </div>
        </div>
        <div className="p-3">
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-8 animate-pulse rounded bg-muted" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ERP标准工具栏 */}
      <div className="rounded border bg-card">
        <div className="border-b bg-muted/30 px-3 py-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">库存管理</h3>
            <div className="text-xs text-muted-foreground">
              {data?.pagination ? `共 ${data.pagination.total} 条记录` : ''}
              {selectedInventoryIds.length > 0 && (
                <span className="ml-2 text-blue-600">
                  已选择 {selectedInventoryIds.length} 个库存记录
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="p-3">
          <div className="flex items-center gap-2">
            {/* 操作按钮 */}
            <Button size="sm" className="h-7" onClick={handleInbound}>
              <Plus className="mr-1 h-3 w-3" />
              入库
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7"
              onClick={handleOutbound}
            >
              <Package className="mr-1 h-3 w-3" />
              出库
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7"
              onClick={() => handleAdjust()}
            >
              <Edit className="mr-1 h-3 w-3" />
              调整
            </Button>

            <div className="mx-2 h-4 w-px bg-border" />

            {/* 搜索框 */}
            <div className="relative max-w-xs flex-1">
              <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="搜索产品名称、编码..."
                value={queryParams.search}
                onChange={e => onSearch(e.target.value)}
                className="h-7 pl-7 text-xs"
              />
            </div>

            {/* 筛选器 */}
            <Button
              variant={queryParams.lowStock ? 'default' : 'outline'}
              size="sm"
              className="h-7"
              onClick={() => onFilter('lowStock', !queryParams.lowStock)}
            >
              <AlertTriangle className="mr-1 h-3 w-3" />
              库存偏低
            </Button>

            <Button
              variant={queryParams.hasStock ? 'default' : 'outline'}
              size="sm"
              className="h-7"
              onClick={() => onFilter('hasStock', !queryParams.hasStock)}
            >
              <Package className="mr-1 h-3 w-3" />
              有库存
            </Button>

            <Select
              value={queryParams.categoryId || 'all'}
              onValueChange={value =>
                onFilter('categoryId', value === 'all' ? undefined : value)
              }
            >
              <SelectTrigger className="h-7 w-24 text-xs">
                <SelectValue placeholder="分类" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                {categoryOptions.map(category => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={queryParams.sortBy || 'updatedAt'}
              onValueChange={value => onFilter('sortBy', value)}
            >
              <SelectTrigger className="h-7 w-20 text-xs">
                <SelectValue placeholder="排序" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="updatedAt">更新时间</SelectItem>
                <SelectItem value="quantity">库存数量</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* ERP标准数据表格 */}
      <div className="rounded border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="w-12 text-xs">
                <input
                  type="checkbox"
                  checked={
                    selectedInventoryIds.length === data.data.length &&
                    data.data.length > 0
                  }
                  onChange={e => handleSelectAll(e.target.checked)}
                  className="rounded border border-input"
                />
              </TableHead>
              <TableHead className="text-xs">产品编码</TableHead>
              <TableHead className="text-xs">产品名称</TableHead>
              <TableHead className="text-xs">规格</TableHead>
              <TableHead className="text-xs">批次号</TableHead>
              <TableHead className="text-xs">库存数量</TableHead>
              <TableHead className="text-xs">预留数量</TableHead>
              <TableHead className="text-xs">可用数量</TableHead>
              <TableHead className="text-xs">库存状态</TableHead>
              <TableHead className="text-xs">最后更新</TableHead>
              <TableHead className="w-20 text-xs">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.data.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={11}
                  className="h-24 text-center text-muted-foreground"
                >
                  <div className="flex flex-col items-center gap-2">
                    <Package className="h-8 w-8" />
                    <div>暂无库存数据</div>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              data.data.map(item => (
                <TableRow key={item.id} className="text-xs">
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={selectedInventoryIds.includes(item.id)}
                      onChange={e => handleRowSelect(item.id, e.target.checked)}
                      className="rounded border border-input"
                    />
                  </TableCell>
                  <TableCell className="font-mono">
                    {item.product?.code || '-'}
                  </TableCell>
                  <TableCell className="font-medium">
                    {item.product?.name || '-'}
                  </TableCell>
                  <TableCell>{item.product?.specification || '-'}</TableCell>
                  <TableCell className="font-mono">
                    {item.batchNumber || '-'}
                  </TableCell>
                  <TableCell className="font-medium">
                    {formatQuantityDisplay(item)}
                  </TableCell>
                  <TableCell>{item.reservedQuantity || 0}</TableCell>
                  <TableCell className="font-medium">
                    {item.quantity - (item.reservedQuantity || 0)}
                  </TableCell>
                  <TableCell>{getStockBadge(item.quantity, 10)}</TableCell>
                  <TableCell>
                    {new Date(item.updatedAt).toLocaleDateString('zh-CN')}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => handleAdjust(item.id)}
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* 分页 */}
      {data?.pagination && data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div>
            第 {data.pagination.page} 页，共 {data.pagination.totalPages} 页
          </div>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-7"
              onClick={() =>
                data.pagination && onPageChange(data.pagination.page - 1)
              }
              disabled={data.pagination.page <= 1}
            >
              上一页
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7"
              onClick={() =>
                data.pagination && onPageChange(data.pagination.page + 1)
              }
              disabled={data.pagination.page >= data.pagination.totalPages}
            >
              下一页
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
