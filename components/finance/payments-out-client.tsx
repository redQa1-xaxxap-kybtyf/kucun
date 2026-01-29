'use client';

import { CheckCircle, Clock, Receipt, XCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { SearchFilterCard } from '@/components/common/search-filter-card';
import { Badge } from '@/components/ui/badge';
import type { DateRangeValue } from '@/components/ui/date-range-picker';
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
import { useToast } from '@/components/ui/use-toast';
import { getCsrfTokenHeader } from '@/lib/utils/csrf';

import { PaymentsOutTableList } from './payments-out-table-list';

interface PaymentOutRecord {
  id: string;
  paymentNumber: string;
  paymentAmount: number;
  paymentMethod: string;
  paymentDate: string;
  status: string;
  remarks?: string;
  voucherNumber?: string;
  payableRecord?: {
    id: string;
    payableNumber: string;
    payableAmount: number;
    remainingAmount: number;
  };
  supplier: {
    id: string;
    name: string;
    phone?: string;
  };
  user: {
    id: string;
    name: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface PaymentsOutClientProps {
  initialData: {
    payments: PaymentOutRecord[];
    statistics: {
      totalAmount: number;
      confirmedAmount: number;
      pendingAmount: number;
      recordCount: number;
      currentMonthConfirmedAmount?: number;
      previousMonthConfirmedAmount?: number;
      confirmedAmountChangePercent?: number | null;
    };
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
  initialParams?: {
    page: number;
    limit: number;
    search?: string;
    status?: string;
    paymentMethod?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    startDate?: string;
    endDate?: string;
  };
  onSearch?: (value: string) => void;
  onFilter?: (key: string, value: string | undefined) => void;
  onDateRangeChange?: (range: DateRangeValue) => void;
  onPageChange?: (page: number) => void;
}

/**
 * 状态显示组件
 */
function _StatusBadge({ status }: { status: string }) {
  const statusConfig = {
    pending: { label: '待确认', variant: 'secondary' as const, icon: Clock },
    confirmed: {
      label: '已确认',
      variant: 'default' as const,
      icon: CheckCircle,
    },
    cancelled: {
      label: '已取消',
      variant: 'destructive' as const,
      icon: XCircle,
    },
  };

  const config = statusConfig[status as keyof typeof statusConfig] || {
    label: status,
    variant: 'secondary' as const,
    icon: Clock,
  };
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className="gap-1">
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}

/**
 * 付款方式显示组件
 */
function _PaymentMethodBadge({ method }: { method: string }) {
  const methodLabels: Record<string, string> = {
    cash: '现金',
    bank_transfer: '银行转账',
    alipay: '支付宝',
    wechat: '微信',
    check: '支票',
    other: '其他',
  };

  return (
    <Badge variant="outline" className="gap-1">
      <Receipt className="h-3 w-3" />
      {methodLabels[method] || method}
    </Badge>
  );
}

export function PaymentsOutClient({
  initialData,
  initialParams,
  onSearch: _onSearch,
  onFilter: _onFilter,
  onDateRangeChange: _onDateRangeChange,
  onPageChange,
}: PaymentsOutClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [_searchValue, _setSearchValue] = React.useState(
    initialParams?.search ?? ''
  );
  const [isConfirming, setIsConfirming] = React.useState(false);
  const [confirmingId, setConfirmingId] = React.useState<string | null>(null);
  const [voidingPayment, setVoidingPayment] =
    React.useState<PaymentOutRecord | null>(null);
  const [voidReason, setVoidReason] = React.useState('');
  const [isVoiding, setIsVoiding] = React.useState(false);

  React.useEffect(() => {
    _setSearchValue(initialParams?.search ?? '');
  }, [initialParams?.search]);
  const { payments, statistics: _statistics, pagination } = initialData;

  // ... (保留 confirmedAmountChangeLabel 和 handleDateRangeChange)

  // 确认付款
  const handleConfirm = async (paymentId: string) => {
    if (isConfirming) return;

    setIsConfirming(true);
    setConfirmingId(paymentId);
    try {
      const response = await fetch(
        `/api/finance/payments-out/${paymentId}`,
        getCsrfTokenHeader({
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            status: 'confirmed',
            idempotencyKey: crypto.randomUUID(),
          }),
        })
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || '确认付款失败');
      }

      toast({
        title: '确认成功',
        description: '付款记录已确认',
        variant: 'success',
      });

      // 刷新页面数据
      router.refresh();
    } catch (error) {
      toast({
        title: '确认失败',
        description: error instanceof Error ? error.message : '确认付款失败',
        variant: 'destructive',
      });
    } finally {
      setIsConfirming(false);
      setConfirmingId(null);
    }
  };

  const handleVoidRequest = (payment: PaymentOutRecord) => {
    if (isVoiding) return;
    setVoidingPayment(payment);
    setVoidReason('');
  };

  const handleVoidConfirm = async () => {
    if (!voidingPayment || isVoiding) return;

    setIsVoiding(true);
    try {
      const trimmedReason = voidReason.trim().slice(0, 64);
      const payload: Record<string, unknown> = {
        idempotencyKey: crypto.randomUUID(),
        ...(trimmedReason ? { voidReason: trimmedReason } : {}),
      };

      const response = await fetch(
        `/api/finance/payments-out/${voidingPayment.id}`,
        getCsrfTokenHeader({
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        })
      );

      const data = (await response.json()) as {
        success?: boolean;
        error?: string;
        message?: string;
      };

      if (!response.ok || !data.success) {
        throw new Error(data.error || '作废付款失败');
      }

      toast({
        title: '作废成功',
        description: data.message || '付款记录已作废',
        variant: 'success',
      });

      setVoidingPayment(null);
      router.refresh();
    } catch (error) {
      toast({
        title: '作废失败',
        description: error instanceof Error ? error.message : '作废付款失败',
        variant: 'destructive',
      });
    } finally {
      setIsVoiding(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* ... (保留统计卡片) */}

      {/* 搜索和筛选 */}
      <div className="relative z-10">
        <SearchFilterCard
          searchValue={_searchValue}
          onSearchChange={_setSearchValue}
          searchPlaceholder="检索供应商名称、单号或联系人..."
          variant="pro"
          compact={true}
          filters={[
            {
              key: 'status',
              label: '状态',
              options: [
                { label: '待确认', value: 'pending' },
                { label: '已确认', value: 'confirmed' },
                { label: '已取消', value: 'cancelled' },
              ],
              width: 'w-[140px]',
            },
            {
              key: 'paymentMethod',
              label: '付款方式',
              options: [
                { label: '现金', value: 'cash' },
                { label: '银行转账', value: 'bank_transfer' },
                { label: '支付宝', value: 'alipay' },
                { label: '微信', value: 'wechat' },
                { label: '支票', value: 'check' },
              ],
              width: 'w-[140px]',
            },
          ]}
          filterValues={{
            status: initialParams?.status || 'all',
            paymentMethod: initialParams?.paymentMethod || 'all',
          }}
          onFilterChange={_onFilter}
          dateRangeFilter={
            _onDateRangeChange
              ? {
                  key: 'dateRange',
                  label: '日期',
                  value: {
                    startDate: initialParams?.startDate,
                    endDate: initialParams?.endDate,
                  },
                  onChange: _onDateRangeChange,
                  placeholder: '付款日期范围',
                }
              : undefined
          }
        />
      </div>

      {/* 付款记录列表 */}
      <div className="animate-in fade-in slide-in-from-bottom-4 mt-6 duration-700">
        <PaymentsOutTableList
          payments={payments}
          pagination={pagination}
          onPageChange={onPageChange}
          onConfirm={handleConfirm}
          onVoid={handleVoidRequest}
          confirmingId={confirmingId}
          isConfirming={isConfirming}
          isVoiding={isVoiding}
        />
      </div>

      <AlertDialog
        open={Boolean(voidingPayment)}
        onOpenChange={open => {
          if (!open) {
            setVoidingPayment(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认作废付款记录？</AlertDialogTitle>
            <AlertDialogDescription>
              {voidingPayment ? (
                <>
                  将作废付款单 <strong>{voidingPayment.paymentNumber}</strong>。
                  <br />
                  作废会回滚关联应付款，并写入供应商往来账反向流水。
                </>
              ) : (
                '确认作废该付款记录吗？'
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2">
            <div className="text-sm font-medium">作废原因（可选）</div>
            <Textarea
              value={voidReason}
              onChange={e => setVoidReason(e.target.value)}
              placeholder="例如：录入错误 / 重复付款 / 供应商更换…（最多64字）"
              disabled={isVoiding}
              rows={3}
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isVoiding}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleVoidConfirm}
              disabled={isVoiding}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isVoiding ? '作废中...' : '确认作废'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
