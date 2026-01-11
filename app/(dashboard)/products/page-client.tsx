'use client';

import { Package, Plus } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { PageHeader } from '@/components/common/page-header';
import { ERPProductList } from '@/components/products/erp-product-list';
import { Button } from '@/components/ui/button';
import type { ProductQueryParams } from '@/lib/types/product';

interface ProductsPageClientProps {
  initialParams: ProductQueryParams;
}

/**
 * 产品管理页面客户端组件
 * 使用 ERPProductList 组件统一产品列表的渲染逻辑
 * 严格遵循前端架构规范：Client Component 层
 *
 * ✅ 修复：使用 ERPProductList 避免双重滚动问题
 */
export function ProductsPageClient({
  initialParams,
}: ProductsPageClientProps) {
  return (
    <div className="flex h-full flex-col overflow-auto p-6">
      <div className="space-y-6">
        {/* 页面标题 */}
        <PageHeader
          title="产品管理"
          description="管理产品信息、规格和库存状态"
          icon={<Package className="h-6 w-6 text-white" />}
          iconBgColor="hsl(var(--color-primary))"
          actions={
            <Button
              size="lg"
              asChild
              className="h-11 shadow-[var(--shadow-light)] transition-transform hover:-translate-y-0.5 hover:shadow-[var(--shadow-medium)]"
            >
              <Link href="/products/create">
                <Plus className="mr-2 h-4 w-4" />
                新建产品
              </Link>
            </Button>
          }
        />

        {/* 产品列表 */}
        <ERPProductList initialParams={initialParams} />
      </div>
    </div>
  );
}
