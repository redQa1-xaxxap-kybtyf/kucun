/**
 * 库存盘点相关对话框组件
 */

import * as React from 'react';

import { ProductCombobox } from '@/components/inventory/product-combobox';
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
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/**
 * 删除盘点计划对话框
 */
export function DeleteCountDialog({
  open,
  onOpenChange,
  onConfirm,
  isDeleting,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isDeleting: boolean;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>确认删除</AlertDialogTitle>
          <AlertDialogDescription>
            确定要删除此盘点计划吗？此操作不可撤销。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>取消</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={isDeleting}>
            {isDeleting ? '删除中…' : '确认删除'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * 添加盘点产品对话框
 */
export function AddProductDialog({
  open,
  onOpenChange,
  selectedProductId,
  onProductChange,
  onConfirm,
  isAdding,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedProductId: string;
  onProductChange: (value: string) => void;
  onConfirm: () => void;
  isAdding: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>添加盘点产品</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <div className="mb-2 text-sm font-medium text-[hsl(var(--color-text-secondary))]">
              选择产品
            </div>
            <ProductCombobox
              value={selectedProductId}
              onChange={onProductChange}
              placeholder="搜索产品名称、编码..."
            />
          </div>
          <p className="text-muted-foreground text-xs">
            将根据所选产品当前的库存记录（按批次号）生成盘点明细。
          </p>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isAdding}
          >
            取消
          </Button>
          <Button onClick={onConfirm} disabled={isAdding}>
            {isAdding ? '添加中…' : '添加到盘点明细'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
