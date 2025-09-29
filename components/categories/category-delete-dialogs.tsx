'use client';

/**
 * 分类删除对话框组件
 * 严格遵循全栈项目统一约定规范
 */

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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { Category } from '@/lib/api/categories';

interface DeleteDialogState {
  open: boolean;
  categoryId: string | null;
  categoryName: string;
}

interface BatchDeleteDialogState {
  open: boolean;
  categories: Category[];
}

interface CategoryDeleteDialogsProps {
  deleteDialog: DeleteDialogState;
  batchDeleteDialog: BatchDeleteDialogState;
  isDeleting: boolean;
  isBatchDeleting: boolean;
  onDeleteDialogChange: (state: DeleteDialogState) => void;
  onBatchDeleteDialogChange: (state: BatchDeleteDialogState) => void;
  onConfirmDelete: () => void;
  onConfirmBatchDelete: () => void;
}

export function CategoryDeleteDialogs({
  deleteDialog,
  batchDeleteDialog,
  isDeleting,
  isBatchDeleting,
  onDeleteDialogChange,
  onBatchDeleteDialogChange,
  onConfirmDelete,
  onConfirmBatchDelete,
}: CategoryDeleteDialogsProps) {
  return (
    <>
      {/* 删除确认对话框 */}
      <Dialog
        open={deleteDialog.open}
        onOpenChange={open => onDeleteDialogChange({ ...deleteDialog, open })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除分类</DialogTitle>
            <DialogDescription>
              您确定要删除分类{' '}
              <strong>&quot;{deleteDialog.categoryName}&quot;</strong> 吗？
              <br />
              <span className="font-medium text-red-600">
                注意：此操作不可撤销，删除后该分类下的所有子分类和产品关联也将被清除。
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                onDeleteDialogChange({ ...deleteDialog, open: false })
              }
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={onConfirmDelete}
              disabled={isDeleting}
              className={isDeleting ? 'cursor-not-allowed' : ''}
            >
              {isDeleting ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  正在删除...
                </>
              ) : (
                '确认删除'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 批量删除确认对话框 */}
      <AlertDialog
        open={batchDeleteDialog.open}
        onOpenChange={open =>
          onBatchDeleteDialogChange({ ...batchDeleteDialog, open })
        }
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认批量删除分类</AlertDialogTitle>
            <AlertDialogDescription>
              您确定要删除以下 {batchDeleteDialog.categories.length} 个分类吗？
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="max-h-60 overflow-y-auto">
            <div className="space-y-2">
              {batchDeleteDialog.categories.map(category => (
                <div
                  key={category.id}
                  className="flex items-center justify-between rounded-md border p-3"
                >
                  <div>
                    <div className="font-medium">{category.name}</div>
                    <div className="text-sm text-muted-foreground">
                      产品数量: {category.productCount || 0}
                    </div>
                  </div>
                  <Badge
                    variant={
                      category.status === 'active' ? 'default' : 'secondary'
                    }
                  >
                    {category.status === 'active' ? '启用' : '禁用'}
                  </Badge>
                </div>
              ))}
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={onConfirmBatchDelete}
              disabled={isBatchDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isBatchDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  删除中...
                </>
              ) : (
                `确认删除 ${batchDeleteDialog.categories.length} 个分类`
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
