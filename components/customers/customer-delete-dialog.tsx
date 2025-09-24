'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Loader2 } from 'lucide-react';
import * as React from 'react';

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
import { useToast } from '@/components/ui/use-toast';
import { customerQueryKeys, deleteCustomer } from '@/lib/api/customers';
import type { Customer } from '@/lib/types/customer';

interface CustomerDeleteDialogProps {
  customer: Customer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * 客户删除确认对话框组件
 * 提供安全的删除确认流程
 */
export function CustomerDeleteDialog({
  customer,
  open,
  onOpenChange,
}: CustomerDeleteDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // 删除客户
  const deleteMutation = useMutation({
    mutationFn: (customerId: string) => deleteCustomer(customerId),
    onSuccess: () => {
      toast({
        title: '删除成功',
        description: `客户"${customer?.name}"已成功删除`,
      });

      // 刷新客户列表
      queryClient.invalidateQueries({
        queryKey: customerQueryKeys.lists(),
      });

      onOpenChange(false);
    },
    onError: error => {
      toast({
        title: '删除失败',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleDelete = () => {
    if (customer?.id) {
      deleteMutation.mutate(customer.id);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <AlertDialogTitle>确认删除客户</AlertDialogTitle>
              <AlertDialogDescription className="mt-1">
                此操作无法撤销。确定要删除客户吗？
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>

        {customer && (
          <div className="my-4 rounded-lg bg-muted/50 p-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">
                  客户名称：
                </span>
                <span className="font-medium">{customer.name}</span>
              </div>
              {customer.phone && (
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">
                    联系电话：
                  </span>
                  <span>{customer.phone}</span>
                </div>
              )}
              {customer.transactionCount !== undefined &&
                customer.transactionCount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">
                      交易次数：
                    </span>
                    <span className="font-medium text-orange-600">
                      {customer.transactionCount}次
                    </span>
                  </div>
                )}
            </div>

            {customer.transactionCount !== undefined &&
              customer.transactionCount > 0 && (
                <div className="mt-3 rounded border border-orange-200 bg-orange-50 p-2 text-sm text-orange-800">
                  <AlertTriangle className="mr-1 inline h-4 w-4" />
                  注意：该客户有交易记录，删除后相关数据将无法恢复
                </div>
              )}
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteMutation.isPending}>
            取消
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
          >
            {deleteMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            确认删除
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
