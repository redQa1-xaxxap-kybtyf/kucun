'use client';

import { AlertCircle } from 'lucide-react';

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

export function SupplierDeleteDialog({
  open,
  onOpenChange,
  supplierName,
  onConfirm,
  isDeleting,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplierName: string;
  onConfirm: () => void;
  isDeleting: boolean;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="rounded-md p-6 shadow-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-3 text-lg font-semibold text-slate-900">
            <AlertCircle className="h-5 w-5 text-rose-500" />
            删除供应商
          </AlertDialogTitle>
          <AlertDialogDescription className="py-3 leading-relaxed text-slate-500">
            您正在删除供应商 &quot;{supplierName}&quot;。
            <br />
            删除后，这家供应商会从日常列表中移除，历史交易记录仍会保留，方便后续查询。该操作暂时不能直接恢复。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-3 pt-4">
          <AlertDialogCancel
            className="h-10 rounded-md font-medium"
            disabled={isDeleting}
          >
            取消并返回
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isDeleting}
            className="h-10 rounded-md bg-rose-600 font-medium text-white hover:bg-rose-700"
          >
            {isDeleting ? '删除中...' : '确认删除'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
