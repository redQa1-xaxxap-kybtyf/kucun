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
import { Textarea } from '@/components/ui/textarea';

interface ExpenseRecordActionDialogProps {
  open: boolean;
  mode: 'delete' | 'void';
  expenseNumber: string;
  isSubmitting: boolean;
  reason?: string;
  onReasonChange?: (value: string) => void;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function ExpenseRecordActionDialog({
  open,
  mode,
  expenseNumber,
  isSubmitting,
  reason = '',
  onReasonChange,
  onOpenChange,
  onConfirm,
}: ExpenseRecordActionDialogProps) {
  const isVoid = mode === 'void';

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isVoid ? '确认作废这笔费用？' : '确认删除这笔费用？'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isVoid ? (
              <>
                将作废费用单 <strong>{expenseNumber}</strong>。
                <br />
                作废后不再计入报表。
              </>
            ) : (
              <>
                确定要删除费用单 <strong>{expenseNumber}</strong> 吗？
                <br />
                <span className="text-destructive font-medium">
                  删除后无法恢复，草稿费用才允许删除。
                </span>
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {isVoid && onReasonChange ? (
          <div className="space-y-2">
            <div className="text-sm font-medium">备注（可选）</div>
            <Textarea
              value={reason}
              onChange={event => onReasonChange(event.target.value)}
              placeholder="例如：录入金额有误 / 重复登记 / 供应商填错..."
              rows={3}
              maxLength={64}
              disabled={isSubmitting}
            />
          </div>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>
            {isVoid ? '先不作废' : '取消'}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={event => {
              event.preventDefault();
              onConfirm();
            }}
            disabled={isSubmitting}
            className={
              isVoid
                ? undefined
                : 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
            }
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isVoid ? '作废中...' : '删除中...'}
              </>
            ) : isVoid ? (
              '确认作废'
            ) : (
              '确认删除'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
