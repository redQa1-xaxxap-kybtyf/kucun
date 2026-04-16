'use client';

import { Download, Loader2, Package, Plus, Upload } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import * as React from 'react';

import { PageHeader } from '@/components/common/page-header';
import { ProductImportDialog } from '@/components/products/product-import-dialog';
import { Button } from '@/components/ui/button';
import { getProducts, type ProductListQueryParams } from '@/lib/api/products';
import { ExportService } from '@/lib/services/export-service';
import type { Product, ProductQueryParams } from '@/lib/types/product';
import {
  buildProductExportFilename,
  buildProductExportRows,
  PRODUCT_EXPORT_PAGE_SIZE,
} from '@/lib/utils/product-export';
import { showError, showSuccess, showWarning } from '@/lib/utils/toast-helper';

const ERPProductList = dynamic(
  () =>
    import('@/components/products/erp-product-list').then(
      mod => mod.ERPProductList
    ),
  {
    ssr: false,
    loading: () => (
      <div className="text-muted-foreground rounded-lg border border-dashed p-6 text-sm">
        产品列表加载中...
      </div>
    ),
  }
);

interface ProductsPageClientProps {
  initialParams: ProductQueryParams;
}

async function fetchProductsForExport(
  queryParams: ProductListQueryParams
): Promise<Product[]> {
  const products: Product[] = [];
  let currentPage = 1;
  let totalPages = 1;

  do {
    const response = await getProducts({
      ...queryParams,
      page: currentPage,
      limit: PRODUCT_EXPORT_PAGE_SIZE,
      includeInventory: false,
      includeStatistics: false,
      includeBatchSpecs: false,
    });

    products.push(...response.data);
    totalPages = response.pagination?.totalPages ?? 1;
    currentPage += 1;
  } while (currentPage <= totalPages);

  return products;
}

/**
 * 产品管理页面客户端组件
 * 使用 ERPProductList 组件统一产品列表的渲染逻辑
 * 严格遵循前端架构规范：Client Component 层
 *
 * ✅ 修复：使用 ERPProductList 避免双重滚动问题
 */
export function ProductsPageClient({ initialParams }: ProductsPageClientProps) {
  const [isImportDialogOpen, setIsImportDialogOpen] = React.useState(false);
  const [isExporting, setIsExporting] = React.useState(false);

  const handleExportProducts = React.useCallback(() => {
    if (isExporting) {
      return;
    }

    void (async () => {
      setIsExporting(true);

      try {
        const products = await fetchProductsForExport(initialParams);

        if (products.length === 0) {
          showWarning('没有可导出的产品', {
            description: '当前筛选条件下没有产品数据',
          });
          return;
        }

        await ExportService.exportToExcel(buildProductExportRows(products), {
          filename: buildProductExportFilename(),
          sheetName: '产品列表',
          includeHeaders: true,
        });

        showSuccess('产品导出成功', {
          description: `已导出 ${products.length} 条产品记录`,
        });
      } catch (error) {
        showError('产品导出失败', {
          description: error instanceof Error ? error.message : '请稍后重试',
        });
      } finally {
        setIsExporting(false);
      }
    })();
  }, [initialParams, isExporting]);

  return (
    <>
      <div className="flex h-full flex-col overflow-auto p-4 sm:p-6">
        <div className="space-y-6">
          {/* 页面标题 */}
          <PageHeader
            title="产品管理"
            description="管理产品信息、规格和库存状态"
            icon={<Package className="h-6 w-6 text-white" />}
            iconBgColor="hsl(var(--color-primary))"
            actions={
              <>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-11 w-full justify-center transition-transform hover:-translate-y-0.5 sm:w-auto"
                  onClick={handleExportProducts}
                  disabled={isExporting}
                >
                  {isExporting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  {isExporting ? '导出中...' : '导出产品'}
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-11 w-full justify-center transition-transform hover:-translate-y-0.5 sm:w-auto"
                  onClick={() => setIsImportDialogOpen(true)}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  批量导入
                </Button>
                <Button
                  size="lg"
                  asChild
                  className="h-11 w-full justify-center shadow-[var(--shadow-light)] transition-transform hover:-translate-y-0.5 hover:shadow-[var(--shadow-medium)] sm:w-auto"
                >
                  <Link href="/products/create">
                    <Plus className="mr-2 h-4 w-4" />
                    新建产品
                  </Link>
                </Button>
              </>
            }
          />

          {/* 产品列表 */}
          <ERPProductList initialParams={initialParams} />
        </div>
      </div>
      <ProductImportDialog
        open={isImportDialogOpen}
        onOpenChange={setIsImportDialogOpen}
      />
    </>
  );
}
