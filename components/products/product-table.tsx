'use client';

import { Edit, Eye, MoreHorizontal, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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

interface ProductTableProps {
  products: Product[];
  selectedProductIds: string[];
  onProductSelect?: (product: Product) => void;
  onSelectProduct: (productId: string, checked: boolean) => void;
  onSelectAll: (checked: boolean) => void;
  onDeleteProduct: (productId: string, productCode: string) => void;
}

export function ProductTable({
  products,
  selectedProductIds,
  onProductSelect,
  onSelectProduct,
  onSelectAll,
  onDeleteProduct,
}: ProductTableProps) {
  const router = useRouter();

  // 状态标签渲染
  const getStatusBadge = (status: string) => {
    const variant = status === 'active' ? 'default' : 'secondary';
    return (
      <Badge variant={variant} className="text-xs">
        {PRODUCT_STATUS_LABELS[status as keyof typeof PRODUCT_STATUS_LABELS] ||
          status}
      </Badge>
    );
  };

  // 全选状态计算
  const isAllSelected =
    products.length > 0 &&
    products.every(product => selectedProductIds.includes(product.id));
  const isIndeterminate = selectedProductIds.length > 0 && !isAllSelected;

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              <Checkbox
                checked={isAllSelected}
                ref={(input: HTMLButtonElement | null) => {
                  if (input) {
                    // @ts-expect-error - indeterminate is not in the type definition but exists on the element
                    input.indeterminate = isIndeterminate;
                  }
                }}
                onCheckedChange={checked => onSelectAll(!!checked)}
              />
            </TableHead>
            <TableHead>产品编码</TableHead>
            <TableHead>产品名称</TableHead>
            <TableHead>规格</TableHead>
            <TableHead>单位</TableHead>
            <TableHead>状态</TableHead>
            <TableHead>分类</TableHead>
            <TableHead className="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map(product => (
            <TableRow key={product.id}>
              <TableCell>
                <Checkbox
                  checked={selectedProductIds.includes(product.id)}
                  onCheckedChange={checked =>
                    onSelectProduct(product.id, !!checked)
                  }
                />
              </TableCell>
              <TableCell className="font-medium">{product.code}</TableCell>
              <TableCell>{product.name}</TableCell>
              <TableCell className="text-muted-foreground">
                {product.specification || '-'}
              </TableCell>
              <TableCell>{product.unit}</TableCell>
              <TableCell>{getStatusBadge(product.status)}</TableCell>
              <TableCell>{product.category?.name || '-'}</TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0">
                      <span className="sr-only">打开菜单</span>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
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
                      onClick={() =>
                        router.push(`/products/${product.id}/edit`)
                      }
                    >
                      <Edit className="mr-2 h-4 w-4" />
                      编辑
                    </DropdownMenuItem>
                    <DropdownMenuItem
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
    </div>
  );
}
