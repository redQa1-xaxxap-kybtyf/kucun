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
          <AlertDialogTitle className="flex items-center gap-3 text-2xl font-black tracking-tighter text-slate-900">
            <AlertCircle className="h-6 w-6 text-rose-500" />
            中止供应协议
          </AlertDialogTitle>
          <AlertDialogDescription className="py-4 leading-relaxed font-bold text-slate-500">
            您正在归档供应商 &quot;{supplierName}&quot;。
            <br />
            此操作将中止双方建立的供应关系标识，过往所有交易数据将变为只读归档状态。该操作具备审计追溯性，无法即时物理撤销。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-3 pt-4">
          <AlertDialogCancel
            className="h-12 rounded-2xl border-none bg-slate-100 font-black text-slate-600 hover:bg-slate-200"
            disabled={isDeleting}
          >
            取消并返回
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isDeleting}
            className="h-12 rounded-2xl border-none bg-rose-600 font-black text-white shadow-xl shadow-rose-200 hover:bg-rose-700"
          >
            {isDeleting ? '归档中...' : '确认归档删除'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

