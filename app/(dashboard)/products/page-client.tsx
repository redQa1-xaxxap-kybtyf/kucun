'use client';

import * as React from 'react';

import { ERPProductList } from '@/components/products/erp-product-list';
import type { PaginatedResponse } from '@/lib/types/api';
import type { Category } from '@/lib/types/category';
import type { Product, ProductQueryParams } from '@/lib/types/product';

interface ProductsPageClientProps {
  initialData: PaginatedResponse<Product>;
  initialParams: ProductQueryParams;
  categories: Category[];
}

/**
 * 产品管理页面客户端组件
 * 使用 ERPProductList 组件统一产品列表的渲染逻辑
 * 严格遵循前端架构规范：Client Component 层
 *
 * ✅ 修复：使用 ERPProductList 避免双重滚动问题
 */
export function ProductsPageClient({
  initialData,
  initialParams,
}: ProductsPageClientProps) {
  return (
    <div className="flex h-full flex-col overflow-auto p-6">
      <ERPProductList initialData={initialData} initialParams={initialParams} />
    </div>
  );
}
