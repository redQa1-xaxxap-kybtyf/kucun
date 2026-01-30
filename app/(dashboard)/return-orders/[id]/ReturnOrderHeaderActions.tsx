'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Ban,
  CheckCircle,
  Download,
  Edit,
  MoreHorizontal,
  Printer,
  XCircle,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/components/ui/use-toast';
import { queryKeys } from '@/lib/queryKeys';
import { getCsrfTokenHeader } from '@/lib/utils/csrf';

interface ReturnOrderHeaderActionsProps {
  id: string;
  returnNumber: string;
  status: string;
  onPrint: () => void;
}

export function ReturnOrderHeaderActions({
  id,
  returnNumber,
  status,
  onPrint,
}: ReturnOrderHeaderActionsProps) {
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(
        `/api/return-orders/${id}/status`,
        getCsrfTokenHeader({
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            status: 'cancelled',
            idempotencyKey: crypto.randomUUID(),
            remarks: '用户取消退货订单',
          }),
        })
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || '取消退货订单失败');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: '取消成功',
        description: '退货订单已取消',
        variant: 'success',
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.returnOrders.detail(id),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.returnOrders.all });
      setShowCancelDialog(false);
    },
    onError: (error: Error) => {
      toast({
        title: '取消失败',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const canEdit = ['draft', 'submitted'].includes(status);
  const canCancel = ['draft', 'submitted', 'approved', 'processing'].includes(status);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-3"
          onClick={onPrint}
        >
          <Printer className="mr-2 h-4 w-4" />
          打印
        </Button>
        <Button variant="outline" size="sm" className="h-8 px-3">
          <Download className="mr-2 h-4 w-4" />
          导出
        </Button>
        {canEdit && (
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-3"
            onClick={() => router.push(`/return-orders/${id}/edit`)}
          >
            <Edit className="mr-2 h-4 w-4" />
            编辑
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 px-2">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {status === 'pending' && (
              <>
                <DropdownMenuItem>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  批准退货
                </DropdownMenuItem>
                <DropdownMenuItem className="text-destructive">
                  <XCircle className="mr-2 h-4 w-4" />
                  拒绝退货
                </DropdownMenuItem>
              </>
            )}
            {canCancel && (
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => setShowCancelDialog(true)}
              >
                <Ban className="mr-2 h-4 w-4" />
                取消退货
              </DropdownMenuItem>
            )}
            <DropdownMenuItem>复制订单</DropdownMenuItem>
            <DropdownMenuItem>发送邮件</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认取消退货订单</AlertDialogTitle>
            <AlertDialogDescription>
              您确定要取消退货订单 <strong>{returnNumber}</strong> 吗？
              <br />
              <br />
              取消后：
              <ul className="mt-2 list-inside list-disc space-y-1">
                <li>该退货订单将被标记为已取消状态</li>
                <li>已取消的订单不会影响往来账单余额</li>
                <li>订单记录仍会保留在系统中用于审计追踪</li>
                <li>此操作不可撤销</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelMutation.isPending}>
              我再想想
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => cancelMutation.mutate()}
              disabled={cancelMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancelMutation.isPending ? '取消中...' : '确认取消'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

