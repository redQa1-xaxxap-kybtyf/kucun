'use client';

import { Package } from 'lucide-react';
import * as React from 'react';

import { ERPInventoryList } from '@/components/inventory/erp-inventory-list';
import { Card, CardContent } from '@/components/ui/card';
import { useOptimizedInventoryQuery } from '@/hooks/use-optimized-inventory-query';
import type { FormattedInventory } from '@/lib/api/inventory-formatter';
import type { CategoryOption } from '@/lib/types/category';
import type {
  Inventory,
  InventoryListResponse,
  InventoryQueryParams,
} from '@/lib/types/inventory';

interface InventoryPageClientProps {
  initialData: {
    data: FormattedInventory[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
  initialParams: InventoryQueryParams;
  categoryOptions: CategoryOption[];
}

/**
 * 库存管理页面客户端组件
 * 负责用户交互和状态管理
 * 严格遵循前端架构规范：Client Component 层
 */
export function InventoryPageClient({
  initialData,
  initialParams,
  categoryOptions,
}: InventoryPageClientProps) {
  const [queryParams, setQueryParams] =
    React.useState<InventoryQueryParams>(initialParams);

  // 将 FormattedInventory 转换为 Inventory 类型
  const convertedInitialData: InventoryListResponse = {
    success: true,
    data: {
      inventories: initialData.data.map(item => ({
        id: item.id,
        productId: item.productId,
        batchNumber: item.batchNumber,
        quantity: item.quantity,
        reservedQuantity: item.reservedQuantity,
        unitCost: item.unitCost,
        location: item.location,
        updatedAt: item.updatedAt,
        product: {
          id: item.product.id,
          code: item.product.code,
          name: item.product.name,
          specification: item.product.specification,
          unit: item.product.unit as import('@/lib/config/product').ProductUnit,
          piecesPerUnit: item.product.piecesPerUnit,
          status: item.product
            .status as import('@/lib/config/product').ProductStatus,
          categoryId: item.product.categoryId,
          category: item.product.category
            ? {
                id: item.product.category.id,
                name: item.product.category.name,
                code: item.product.category.code,
              }
            : undefined,
          createdAt: new Date().toISOString(), // 占位值，不影响显示
          updatedAt: item.updatedAt,
        },
      })),
      pagination: initialData.pagination,
    },
  };

  // 获取库存列表数据（使用优化Hook，内置缓存与预取，保持上一页数据）
  const { data, isLoading, error } = useOptimizedInventoryQuery({
    params: queryParams,
    initialData: convertedInitialData,
  });

  // 注意：库存更新现在通过TanStack Query的自动后台刷新机制处理
  // 移除了WebSocket实时更新，改用更简单可靠的轮询机制

  // 规范化列表数据结构，适配不同返回字段命名
  const normalizedData = React.useMemo(() => {
    if (!data) {
      return { data: [], pagination: undefined };
    }

    // 处理API响应的嵌套结构
    // API返回: { success: true, data: { data: [...], pagination: {...} } }
    // 组件期望: { data: [...], pagination: {...} }
    const response = data as {
      success?: boolean;
      data?: {
        data?: Inventory[];
        inventories?: Inventory[];
        pagination?: {
          page: number;
          limit: number;
          total: number;
          totalPages: number;
        };
      };
      // 直接格式（向后兼容）
      inventories?: Inventory[];
      pagination?: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
    };

    // 优先从嵌套的data中提取
    const nestedData = response.data;
    const items =
      nestedData?.data ?? nestedData?.inventories ?? response.inventories ?? [];
    const pagination = nestedData?.pagination ?? response.pagination;

    return { data: items, pagination };
  }, [data]);

  // 搜索处理
  const handleSearch = React.useCallback((value: string) => {
    setQueryParams(prev => ({ ...prev, search: value, page: 1 }));
  }, []);

  // 筛选处理
  const handleFilter = React.useCallback(
    (
      key: keyof InventoryQueryParams,
      value: string | number | boolean | undefined
    ) => {
      setQueryParams(prev => ({ ...prev, [key]: value, page: 1 }));
    },
    []
  );

  // 分页处理
  const handlePageChange = React.useCallback((page: number) => {
    setQueryParams(prev => ({ ...prev, page }));
  }, []);

  if (error) {
    return (
      <div className="bg-card rounded border p-4 text-center text-red-600">
        加载失败: {error instanceof Error ? error.message : '未知错误'}
      </div>
    );
  }

  return (
    <>
      {/* 页面标题卡片 */}
      <Card className="overflow-hidden shadow-lg shadow-gray-200/50">
        <CardContent className="bg-gradient-to-r from-slate-50 to-gray-50 p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 shadow-lg shadow-blue-600/30">
              <Package className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                库存管理
              </h1>
              <p className="text-sm text-gray-600">
                实时监控产品库存，管理入库、出库和库存调整
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 库存列表 */}
      <ERPInventoryList
        data={normalizedData}
        categoryOptions={categoryOptions}
        queryParams={queryParams}
        onSearch={handleSearch}
        onFilter={handleFilter}
        onPageChange={handlePageChange}
        isLoading={isLoading}
      />
    </>
  );
}
