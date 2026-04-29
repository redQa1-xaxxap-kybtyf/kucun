'use client';

import { ArrowRight, PiggyBank, RotateCcw } from 'lucide-react';
import Link from 'next/link';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { getCsrfTokenHeader } from '@/lib/utils/csrf';
import { formatDateTime } from '@/lib/utils/datetime';
import { formatCurrency } from '@/lib/utils/format';
import { getFriendlyErrorMessage } from '@/lib/utils/user-friendly-error';

import type { SalesOrderDetail } from './types';

function formatPaymentMethod(method: string | null | undefined): string {
  switch (method) {
    case 'cash':
      return '现金';
    case 'wechat_transfer':
      return '微信转账';
    case 'abc_qr':
      return '农行码';
    case 'icbc_qr':
      return '工行码';
    case 'ccb_qr':
      return '建行码';
    case 'cib_qr':
      return '兴业码';
    case 'bank_transfer':
      return '银行转账';
    case 'alipay':
      return '支付宝';
    case 'wechat':
      return '微信支付';
    case 'check':
      return '支票';
    default:
      return '其他';
  }
}

const STATUS_BADGE: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'outline' }
> = {
  pending: { label: '待确认', variant: 'secondary' },
  confirmed: { label: '已确认', variant: 'default' },
  applied: { label: '已抵扣', variant: 'default' },
  cancelled: { label: '已取消', variant: 'outline' },
};

export function PrepaymentUsageCard({ order }: { order: SalesOrderDetail }) {
  const router = useRouter();
  const { toast } = useToast();
  const usages = order.prepaymentUsages ?? [];
  const totalApplied = order.prepaymentTotalApplied ?? 0;
  const canRollback = order.status === 'draft' || order.status === 'confirmed';
  const [showRollbackDialog, setShowRollbackDialog] = useState(false);
  const [rollbackNotes, setRollbackNotes] = useState('');
  const [isRollingBack, setIsRollingBack] = useState(false);

  if (!usages.length || totalApplied <= 0) {
    // 没有预收款冲抵记录时不展示该卡片
    return null;
  }

  const handleRollback = async () => {
    if (isRollingBack || !canRollback) {
      return;
    }

    setIsRollingBack(true);
    try {
      const trimmedNotes = rollbackNotes.trim();
      const response = await fetch(
        `/api/sales-orders/${order.id}/prepayment/rollback`,
        getCsrfTokenHeader({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(trimmedNotes ? { notes: trimmedNotes } : {}),
        })
      );
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || '回滚预收款抵扣失败');
      }

      toast({
        title: '回滚成功',
        description: `已恢复 ${formatCurrency(data.data?.rolledBackAmount ?? totalApplied)} 预收款余额。`,
        variant: 'success',
      });
      setShowRollbackDialog(false);
      setRollbackNotes('');
      router.refresh();
    } catch (error) {
      toast({
        title: '回滚失败',
        description: getFriendlyErrorMessage(
          error,
          '预收款抵扣暂时无法回滚，请稍后重试'
        ),
        variant: 'destructive',
      });
    } finally {
      setIsRollingBack(false);
    }
  };

  return (
    <>
      <Card className="overflow-hidden rounded-md border border-border shadow-sm">
        <CardHeader className="border-b border-slate-100 bg-slate-50/50 py-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1.5">
              <CardTitle className="flex items-center gap-2.5 text-sm font-semibold text-slate-900">
                <PiggyBank className="h-4 w-4 text-amber-600" />
                预收款抵扣记录
              </CardTitle>
              <p className="text-[11px] font-medium text-slate-500">
                查看这张订单用了多少客户预收款。
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="secondary"
                className="rounded-md px-2.5 py-1 font-semibold"
              >
                合计抵扣：{formatCurrency(totalApplied)}
              </Badge>
              {canRollback && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 rounded-md px-3 text-xs font-semibold"
                  onClick={() => setShowRollbackDialog(true)}
                  disabled={isRollingBack}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  回滚抵扣
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 py-6">
          <div className="flex items-center gap-3 rounded-md border border-amber-100 bg-amber-50 p-4 text-[11px] font-bold text-amber-700">
            <div className="flex h-5 w-5 items-center justify-center rounded-md bg-amber-500 text-[10px] text-white">
              i
            </div>
            <span>
              当前订单已使用 {usages.length}{' '}
              笔预收款抵扣，对应金额已经从客户预收款余额里扣除。
            </span>
          </div>

          <div className="space-y-4">
            {usages.map(usage => {
              const statusConfig =
                STATUS_BADGE[usage.paymentStatus] ?? STATUS_BADGE.confirmed;

              return (
                <div
                  key={usage.id}
                  className="group relative flex flex-col gap-4 rounded-md border border-slate-100 bg-white p-4 transition-colors hover:bg-slate-50/50 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-3">
                      <Badge
                        variant={statusConfig.variant}
                        className="rounded-md px-2 py-0.5 font-bold"
                      >
                        {statusConfig.label}
                      </Badge>
                      <span className="font-mono text-sm font-bold text-slate-700">
                        {usage.paymentNumber}
                      </span>
                      <div className="h-3 w-px bg-slate-200" />
                      <span className="text-xs font-bold text-slate-500">
                        {formatPaymentMethod(usage.paymentMethod)}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1 text-[10px] font-medium text-slate-400">
                      <p>原始收款时间：{formatDateTime(usage.paymentDate)}</p>
                      <p>抵扣时间：{formatDateTime(usage.createdAt)}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-100 pt-3 sm:flex-col sm:items-end sm:gap-2 sm:border-0 sm:pt-0">
                    <div className="text-right">
                      <p className="text-[9px] font-semibold text-slate-400">
                        本次抵扣
                      </p>
                      <p className="font-mono text-lg font-semibold text-emerald-600">
                        -{formatCurrency(usage.appliedAmount)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      asChild
                      className="h-8 rounded-md px-3 text-xs font-semibold text-blue-600 hover:bg-blue-50"
                    >
                      <Link href={`/finance/payments/${usage.paymentRecordId}`}>
                        溯源记录
                        <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <AlertDialog
        open={showRollbackDialog}
        onOpenChange={setShowRollbackDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认回滚预收款抵扣？</AlertDialogTitle>
            <AlertDialogDescription>
              将回滚订单 <strong>{order.orderNumber}</strong> 的预收款抵扣，
              恢复客户预收款余额，并重新计算订单已收金额。
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2">
            <div className="text-sm font-medium">回滚备注（可选）</div>
            <Textarea
              value={rollbackNotes}
              onChange={event => setRollbackNotes(event.target.value)}
              placeholder="例如：订单取消前回滚 / 抵扣录错 / 重新开单..."
              disabled={isRollingBack}
              rows={3}
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRollingBack}>
              先不回滚
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRollback}
              disabled={isRollingBack || !canRollback}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isRollingBack ? '回滚中...' : '确认回滚抵扣'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
