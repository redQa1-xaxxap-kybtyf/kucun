'use client';

import { Edit, Eye, ImageIcon, MoreHorizontal, Trash2 } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

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
import { ProductDataUtils } from '@/lib/utils/product-data';

interface ProductTableProps {
  products: Product[];
  onProductSelect?: (product: Product) => void;
  onDeleteProduct: (productId: string, productCode: string) => void;
  isLoading?: boolean;
}

export function ProductTable({
  products,
  onProductSelect,
  onDeleteProduct,
  isLoading = false,
}: ProductTableProps) {
  const router = useRouter();

  // 状态标签渲染
  const getStatusBadge = (status: string) => (
    <Badge variant={getCommonStatusBadgeVariant(status)} className="text-xs">
      {PRODUCT_STATUS_LABELS[status as keyof typeof PRODUCT_STATUS_LABELS] ||
        status}
    </Badge>
  );

  return (
    <Table>
      <TableHeader className="card-shadow-light">
        <TableRow>
          <TableHead className="w-16">缩略图</TableHead>
          <TableHead>产品编码</TableHead>
          <TableHead>产品名称</TableHead>
          <TableHead>分类</TableHead>
          <TableHead>规格</TableHead>
          <TableHead>厚度(mm)</TableHead>
          <TableHead>状态</TableHead>
          <TableHead>创建时间</TableHead>
          <TableHead className="text-right">操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {products.map(product => (
          <TableRow
            key={product.id}
            className="transition-colors hover:bg-[hsl(var(--color-primary-light))]"
          >
            <TableCell>
              {product.thumbnailUrl ? (
                <div className="relative h-10 w-10 overflow-hidden rounded border border-[hsl(var(--color-border-secondary))] bg-white">
                  <Image
                    src={product.thumbnailUrl}
                    alt={product.name}
                    fill
                    className="object-cover"
                    sizes="40px"
                  />
                </div>
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded border border-dashed border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-secondary))]">
                  <ImageIcon className="h-4 w-4 text-[hsl(var(--color-text-tertiary))]" />
                </div>
              )}
            </TableCell>
            <TableCell className="font-medium text-[hsl(var(--color-primary))]">
              {product.code}
            </TableCell>
            <TableCell className="font-medium">{product.name}</TableCell>
            <TableCell className="text-[hsl(var(--color-text-secondary))]">
              {product.category?.name || '-'}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {ProductDataUtils.formatter.formatSpecification(
                product.specification
              )}
            </TableCell>
            <TableCell className="text-[hsl(var(--color-text-secondary))]">
              {ProductDataUtils.formatter.formatThickness(product.thickness)}
            </TableCell>
            <TableCell>{getStatusBadge(product.status)}</TableCell>
            <TableCell className="text-[hsl(var(--color-text-secondary))]">
              {formatDateTime(product.createdAt)}
            </TableCell>
            <TableCell className="text-right">
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
                    onClick={() => {
                      if (onProductSelect) {
                        onProductSelect(product);
                      } else {
                        router.push(`/products/${product.id}`);
                      }
                    }}
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    查看详情
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={isLoading}
                    onClick={() => router.push(`/products/${product.id}/edit`)}
                  >
                    <Edit className="mr-2 h-4 w-4" />
                    编辑
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={isLoading}
                    onClick={() => onDeleteProduct(product.id, product.code)}
                    className="text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    删除
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
