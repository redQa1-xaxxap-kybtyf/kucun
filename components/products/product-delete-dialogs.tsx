'use client';

import { Loader2 } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { Product } from '@/lib/types/product';

interface ProductDeleteDialogProps {
  open: boolean;
  productName: string;
  isDeleting: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function ProductDeleteDialog({
  open,
  productName,
  isDeleting,
  onOpenChange,
  onConfirm,
}: ProductDeleteDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>确认删除产品</AlertDialogTitle>
          <AlertDialogDescription>
            您确定要删除产品 <strong>{productName}</strong> 吗？
            <br />
            此操作不可撤销，请谨慎操作。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>取消</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                删除中...
              </>
            ) : (
              '确认删除'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface ProductBatchDeleteDialogProps {
  open: boolean;
  products: Product[];
  isBatchDeleting: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function ProductBatchDeleteDialog({
  open,
  products,
  isBatchDeleting,
  onOpenChange,
  onConfirm,
}: ProductBatchDeleteDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>确认批量删除产品</AlertDialogTitle>
          <AlertDialogDescription>
            您确定要删除以下 {products.length} 个产品吗？
            <br />
            此操作不可撤销，请谨慎操作。
            <div className="mt-4 max-h-32 overflow-y-auto rounded border p-2">
              {products.map(product => (
                <div key={product.id} className="text-sm">
                  <strong>{product.code}</strong> - {product.name}
                </div>
              ))}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isBatchDeleting}>取消</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isBatchDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isBatchDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                删除中...
              </>
            ) : (
              `确认删除 ${products.length} 个产品`
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
