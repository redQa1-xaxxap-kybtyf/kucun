'use client';

import { CheckCircle, Clock, Receipt, XCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import type { DateRangeValue } from '@/components/ui/date-range-picker';
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

  return (
    <div className="space-y-4">
      {/* ... (保留统计卡片) */}

      {/* 搜索和筛选 */}
      <Card>
        <CardContent className="pt-6">
          {/* ... (保留 SearchFilterCard) */}

          {/* 付款记录列表 */}
          <div className="mt-6">
            <PaymentsOutTableList
              payments={payments}
              pagination={pagination}
              onPageChange={onPageChange}
              onConfirm={handleConfirm}
              confirmingId={confirmingId}
              isConfirming={isConfirming}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
