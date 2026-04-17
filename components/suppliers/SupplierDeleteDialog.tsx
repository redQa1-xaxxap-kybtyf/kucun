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
      <AlertDialogContent className="rounded-[2.5rem] border-none p-8 shadow-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-3 text-2xl font-semibold tracking-tighter text-slate-900">
            <AlertCircle className="h-6 w-6 text-rose-500" />
            删除供应商
          </AlertDialogTitle>
          <AlertDialogDescription className="py-4 leading-relaxed font-bold text-slate-500">
            您正在删除供应商 &quot;{supplierName}&quot;。
            <br />
            删除后，这家供应商会从日常列表中移除，历史交易记录仍会保留，方便后续查询。该操作暂时不能直接恢复。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-3 pt-4">
          <AlertDialogCancel
            className="h-12 rounded-2xl border-none bg-slate-100 font-semibold text-slate-600 hover:bg-slate-200"
            disabled={isDeleting}
          >
            取消并返回
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isDeleting}
            className="h-12 rounded-2xl border-none bg-rose-600 font-semibold text-white shadow-xl shadow-rose-200 hover:bg-rose-700"
          >
            {isDeleting ? '删除中...' : '确认删除'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
