'use client';

import {
  Edit,
  Eye,
  ImageIcon,
  MoreHorizontal,
  Route,
  Trash2,
  ZoomIn,
} from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { PhotoProvider, PhotoView } from 'react-photo-view';

import 'react-photo-view/dist/react-photo-view.css';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PRODUCT_STATUS_LABELS } from '@/lib/config/product';
import type { Product } from '@/lib/types/product';
import { getCommonStatusBadgeVariant } from '@/lib/utils/badge-helpers';
import { formatDateTime } from '@/lib/utils/datetime';
import { shouldBypassImageOptimization } from '@/lib/utils/image';
import { ProductDataUtils } from '@/lib/utils/product-data';

interface ProductTableProps {
  products: Product[];
  onProductSelect?: (product: Product) => void;
  onDeleteProduct: (productId: string, productCode: string) => void;
  categoryPathById?: Map<string, string>;
  isLoading?: boolean;
}

export function ProductTable({
  products,
  onProductSelect,
  onDeleteProduct,
  categoryPathById,
  isLoading = false,
}: ProductTableProps) {
  const router = useRouter();

  const resolveCategoryLabel = (product: Product) =>
    (product.category?.id
      ? categoryPathById?.get(product.category.id)
      : undefined) ??
    product.category?.name ??
    '-';

  // 状态标签渲染
  const getStatusBadge = (status: string) => (
    <Badge variant={getCommonStatusBadgeVariant(status)} className="text-xs">
      {PRODUCT_STATUS_LABELS[status as keyof typeof PRODUCT_STATUS_LABELS] ||
        status}
    </Badge>
  );

  const handleViewProduct = (product: Product) => {
    if (onProductSelect) {
      onProductSelect(product);
      return;
    }

    router.push(`/products/${product.id}`);
  };

  const handleEditProduct = (productId: string) => {
    router.push(`/products/${productId}/edit`);
  };

  const handleTrackProduct = (productId: string) => {
    router.push(`/products/${productId}/tracking`);
  };

  return (
    <>
      <div className="space-y-3 p-3 md:hidden">
        {products.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-secondary))] px-4 py-8 text-center text-sm text-[hsl(var(--color-text-secondary))]">
            暂无产品数据
          </div>
        ) : (
          products.map(product => (
            <div
              key={product.id}
              className="rounded-lg border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-card))] p-3 shadow-[var(--shadow-light)]"
            >
              <div className="flex items-start gap-3">
                <ProductThumbnailPreview
                  product={product}
                  size="mobile"
                />

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-mono text-xs font-semibold text-[hsl(var(--color-primary))]">
                        {product.code}
                      </div>
                      <div className="mt-1 text-sm font-bold text-[hsl(var(--color-text-primary))]">
                        {product.name}
                      </div>
                    </div>
                    <div className="shrink-0">
                      {getStatusBadge(product.status)}
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                    <div className="min-w-0">
                      <div className="text-[hsl(var(--color-text-tertiary))]">
                        分类
                      </div>
                      <div className="mt-1 truncate font-medium text-[hsl(var(--color-text-secondary))]">
                        {resolveCategoryLabel(product)}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <div className="text-[hsl(var(--color-text-tertiary))]">
                        厚度(mm)
                      </div>
                      <div className="mt-1 font-medium text-[hsl(var(--color-text-secondary))]">
                        {ProductDataUtils.formatter.formatThickness(
                          product.thickness
                        )}
                      </div>
                    </div>
                    <div className="col-span-2 min-w-0">
                      <div className="text-[hsl(var(--color-text-tertiary))]">
                        规格
                      </div>
                      <div className="mt-1 truncate font-medium text-[hsl(var(--color-text-secondary))]">
                        {ProductDataUtils.formatter.formatSpecification(
                          product.specification
                        ) || '-'}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 text-xs text-[hsl(var(--color-text-tertiary))]">
                    创建时间：{formatDateTime(product.createdAt)}
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  className="h-9"
                  disabled={isLoading}
                  onClick={() => handleViewProduct(product)}
                >
                  <Eye className="h-4 w-4" />
                  查看
                </Button>
                <Button
                  variant="outline"
                  className="h-9"
                  disabled={isLoading}
                  onClick={() => handleTrackProduct(product.id)}
                >
                  <Route className="h-4 w-4" />
                  流向
                </Button>
                <Button
                  variant="outline"
                  className="h-9"
                  disabled={isLoading}
                  onClick={() => handleEditProduct(product.id)}
                >
                  <Edit className="h-4 w-4" />
                  编辑
                </Button>
                <Button
                  variant="ghost"
                  className="text-destructive hover:text-destructive h-9"
                  disabled={isLoading}
                  onClick={() => onDeleteProduct(product.id, product.code)}
                >
                  <Trash2 className="h-4 w-4" />
                  删除
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="hidden md:block">
        <Table>
          <TableHeader className="shadow-sm">
            <TableRow>
              <TableHead className="w-16 whitespace-nowrap">缩略图</TableHead>
              <TableHead>产品编码</TableHead>
              <TableHead>产品名称</TableHead>
              <TableHead>分类</TableHead>
              <TableHead>规格</TableHead>
              <TableHead>厚度(mm)</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>创建时间</TableHead>
              <TableHead className="w-[178px] text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="py-10 text-center text-[hsl(var(--color-text-secondary))]"
                >
                  暂无产品数据
                </TableCell>
              </TableRow>
            ) : (
              products.map(product => (
                <TableRow
                  key={product.id}
                  className="transition-colors hover:bg-[hsl(var(--color-primary-light))]"
                >
                  <TableCell>
                    <ProductThumbnailPreview
                      product={product}
                      size="desktop"
                    />
                  </TableCell>
                  <TableCell className="font-medium text-[hsl(var(--color-primary))]">
                    {product.code}
                  </TableCell>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell className="text-[hsl(var(--color-text-secondary))]">
                    {resolveCategoryLabel(product)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {ProductDataUtils.formatter.formatSpecification(
                      product.specification
                    )}
                  </TableCell>
                  <TableCell className="text-[hsl(var(--color-text-secondary))]">
                    {ProductDataUtils.formatter.formatThickness(
                      product.thickness
                    )}
                  </TableCell>
                  <TableCell>{getStatusBadge(product.status)}</TableCell>
                  <TableCell className="text-[hsl(var(--color-text-secondary))]">
                    {formatDateTime(product.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2"
                        disabled={isLoading}
                        onClick={() => handleViewProduct(product)}
                      >
                        <Eye className="h-4 w-4" />
                        查看
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-2"
                        disabled={isLoading}
                        onClick={() => handleTrackProduct(product.id)}
                      >
                        <Route className="h-4 w-4" />
                        流向
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            disabled={isLoading}
                          >
                            <span className="sr-only">打开菜单</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            disabled={isLoading}
                            onClick={() => handleEditProduct(product.id)}
                          >
                            <Edit className="mr-2 h-4 w-4" />
                            编辑
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={isLoading}
                            onClick={() =>
                              onDeleteProduct(product.id, product.code)
                            }
                            className="text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            删除
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

interface ProductThumbnailPreviewProps {
  product: Product;
  size: 'mobile' | 'desktop';
}

function ProductThumbnailPreview({
  product,
  size,
}: ProductThumbnailPreviewProps) {
  const boxClass =
    size === 'mobile' ? 'h-16 w-16 rounded-lg' : 'h-10 w-10 rounded';
  const iconClass = size === 'mobile' ? 'h-5 w-5' : 'h-4 w-4';
  const imageSize = size === 'mobile' ? '64px' : '40px';
  const fallbackImageUrl =
    product.images?.find(image => image.url)?.url?.trim() || '';
  const displayImageUrl = product.thumbnailUrl || fallbackImageUrl;

  if (!displayImageUrl) {
    return (
      <div
        className={`flex shrink-0 items-center justify-center border border-dashed border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-secondary))] ${boxClass}`}
        aria-label={`${product.name} 暂无缩略图`}
      >
        <ImageIcon
          className={`${iconClass} text-[hsl(var(--color-text-tertiary))]`}
        />
      </div>
    );
  }

  return (
    <div className={`relative shrink-0 ${boxClass}`}>
      <PhotoProvider maskOpacity={0.85}>
        <PhotoView src={displayImageUrl}>
          <button
            type="button"
            title="点击预览"
            aria-label={`预览 ${product.name} 的缩略图`}
            className={`group relative overflow-hidden border border-[hsl(var(--color-border-secondary))] bg-white transition focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-primary))] focus-visible:ring-offset-2 focus-visible:outline-none ${boxClass}`}
          >
            <Image
              src={displayImageUrl}
              alt={product.name}
              fill
              className="object-cover"
              sizes={imageSize}
              unoptimized={shouldBypassImageOptimization(displayImageUrl)}
            />
            <span className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition group-hover:bg-black/35 group-hover:opacity-100 group-focus-visible:bg-black/35 group-focus-visible:opacity-100">
              <ZoomIn className={`${iconClass} text-white`} />
            </span>
          </button>
        </PhotoView>
      </PhotoProvider>
    </div>
  );
}
