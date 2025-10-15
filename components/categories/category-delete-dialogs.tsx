'use client';

/**
 * 分类删除对话框组件
 * 严格遵循全栈项目统一约定规范
 */

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
interface DeleteDialogState {
  open: boolean;
  categoryId: string | null;
  categoryName: string;
}

interface CategoryDeleteDialogsProps {
  deleteDialog: DeleteDialogState;
  isDeleting: boolean;
  onDeleteDialogChange: React.Dispatch<React.SetStateAction<DeleteDialogState>>;
  onConfirmDelete: () => void;
}

export function CategoryDeleteDialogs({
  deleteDialog,
  isDeleting,
  onDeleteDialogChange,
  onConfirmDelete,
}: CategoryDeleteDialogsProps) {
  return (
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
              注意：此操作不可撤销。如果该分类下还有子分类或产品，将无法删除。
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
  );
}
