'use client';

import { useQueryClient } from '@tanstack/react-query';
import * as React from 'react';
import { toast } from 'sonner';

import { ERPInventoryList } from '@/components/inventory/erp-inventory-list';
import { useOptimizedInventoryQuery } from '@/hooks/use-optimized-inventory-query';
import { useInventoryUpdates } from '@/hooks/use-websocket';
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
  const queryClient = useQueryClient();
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

  // 订阅库存实时更新
  useInventoryUpdates(
    React.useCallback(
      event => {
        // 刷新库存列表
        queryClient.invalidateQueries({ queryKey: ['inventory'] });

        // 显示变更提示
        const changeType = event.changeAmount > 0 ? '增加' : '减少';
        const amount = Math.abs(event.changeAmount);
        toast.info(
          `库存变更: ${event.productName || '产品'} ${changeType} ${amount}`,
          {
            description: event.reason || event.action,
          }
        );
      },
      [queryClient]
    )
  );

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
      <div className="overflow-hidden rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 p-6 shadow-lg shadow-gray-200/50">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 shadow-lg shadow-blue-600/30">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-6 w-6 text-white"
            >
              <path d="M16.5 9.4 7.55 4.24" />
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              <polyline points="3.29 7 12 12 20.71 7" />
              <line x1="12" x2="12" y1="22" y2="12" />
            </svg>
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
      </div>

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
