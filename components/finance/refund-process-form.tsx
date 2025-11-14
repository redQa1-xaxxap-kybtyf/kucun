'use client';

import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import {
  AlertCircle,
  Calendar as CalendarIcon,
  CheckCircle,
  FileText,
  XCircle,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { ChineseYuan } from '@/components/icons/chinese-yuan';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { useProcessRefund } from '@/lib/api/finance';
import { useRefundDetail } from '@/lib/api/refunds';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/utils/datetime';

type RefundFormState = {
  processedAmount: string;
  processedDate: string;
  status: 'completed' | 'rejected';
  remarks: string;
  closeRemaining: boolean;
};

export type RefundProcessFormVariant = 'page' | 'dialog';

interface RefundProcessFormProps {
  refundId: string | null;
  variant?: RefundProcessFormVariant;
  onCancel?: () => void;
  onSuccess?: () => void;
}

const createInitialFormState = (): RefundFormState => ({
  processedAmount: '',
  processedDate: new Date().toISOString().split('T')[0],
  status: 'completed',
  remarks: '',
  closeRemaining: false,
});

/**
 * 退款处理表单
 * 可复用于独立页面和弹窗模式
 */
export function RefundProcessForm({
  refundId,
  variant = 'page',
  onCancel,
  onSuccess,
}: RefundProcessFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [formData, setFormData] = React.useState<RefundFormState>(() =>
    createInitialFormState()
  );

  const effectiveRefundId = refundId ?? '';

  // 获取退款详情
  const { data: refund, isLoading, error } = useRefundDetail(effectiveRefundId);

  // 处理退款 mutation
  const processRefundMutation = useProcessRefund();

  React.useEffect(() => {
    setFormData(createInitialFormState());
  }, [effectiveRefundId]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: 'CNY',
    }).format(amount);

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: {
        label: '待处理',
        variant: 'secondary' as const,
        icon: AlertCircle,
      },
      processing: {
        label: '处理中',
        variant: 'default' as const,
        icon: CalendarIcon,
      },
      completed: {
        label: '已完成',
        variant: 'default' as const,
        icon: CheckCircle,
      },
      rejected: {
        label: '已拒绝',
        variant: 'destructive' as const,
        icon: XCircle,
      },
    };
    const config = statusConfig[status as keyof typeof statusConfig];
    const IconComponent = config?.icon || AlertCircle;
    return (
      <Badge
        variant={config?.variant || 'secondary'}
        className="flex items-center gap-1"
      >
        <IconComponent className="h-3 w-3" />
        {config?.label}
      </Badge>
    );
  };

  const handleInputChange = <K extends keyof RefundFormState>(
    field: K,
    value: RefundFormState[K]
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleCheckboxChange = (checked: boolean | 'indeterminate') => {
    const value = checked === true;

    setFormData(prev => {
      if (value) {
        const processedAmount =
          prev.processedAmount.trim() === '' ? '0' : prev.processedAmount;
        return { ...prev, closeRemaining: true, processedAmount };
      }

      const processedAmount =
        prev.processedAmount === '0' ? '' : prev.processedAmount;
      return { ...prev, closeRemaining: false, processedAmount };
    });
  };

  React.useEffect(() => {
    if (formData.status !== 'completed') {
      setFormData(prev =>
        prev.closeRemaining
          ? {
              ...prev,
              closeRemaining: false,
              processedAmount:
                prev.processedAmount === '0' ? '' : prev.processedAmount,
            }
          : prev
      );
    }
  }, [formData.status]);

  const handleCancel = React.useCallback(() => {
    setFormData(createInitialFormState());
    if (variant === 'page') {
      if (onCancel) {
        onCancel();
      } else {
        router.back();
      }
    } else {
      onCancel?.();
    }
  }, [onCancel, router, variant]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!effectiveRefundId) {
      toast({
        title: '数据错误',
        description: '未找到对应的退款记录，请刷新后重试。',
        variant: 'destructive',
      });
      return;
    }

    const processedAmountValue = Number.parseFloat(formData.processedAmount);

    if (Number.isNaN(processedAmountValue) || processedAmountValue < 0) {
      toast({
        title: '输入错误',
        description: '请输入正确的处理金额',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.closeRemaining && processedAmountValue === 0) {
      toast({
        title: '输入错误',
        description: '处理金额必须大于0，或勾选“抹平剩余金额”。',
        variant: 'destructive',
      });
      return;
    }

    try {
      await processRefundMutation.mutateAsync({
        id: effectiveRefundId,
        data: {
          processedAmount: processedAmountValue,
          processedDate: formData.processedDate,
          status: formData.status,
          remarks: formData.remarks,
          closeRemaining: formData.closeRemaining,
        },
      });

      toast({
        title: '处理成功',
        description:
          formData.status === 'completed' ? '退款已批准' : '退款已拒绝',
        variant: 'success',
      });

      setFormData(createInitialFormState());
      onSuccess?.();
      if (variant === 'page') {
        router.replace('/finance/refunds');
        router.refresh();
      } else {
        onCancel?.();
      }
    } catch (submitError) {
      toast({
        title: '处理失败',
        description:
          submitError instanceof Error
            ? submitError.message
            : '处理退款失败，请重试',
        variant: 'destructive',
      });
    }
  };

  const containerClass = variant === 'dialog' ? 'space-y-4' : 'space-y-6';

  // 加载状态
  if (isLoading || !effectiveRefundId) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="border-primary h-8 w-8 animate-spin rounded-full border-b-2" />
      </div>
    );
  }

  // 错误状态
  if (error || !refund) {
    return (
      <Card className="border border-[hsl(var(--color-error))] shadow-[var(--shadow-light)]">
        <CardContent className="bg-[hsl(var(--color-error-light))] pt-6 text-center">
          {error ? '加载退款详情失败' : '退款记录不存在'}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={containerClass}>
      <div className="flex items-center space-x-2">
        <span className="text-muted-foreground">
          退款单号：{refund.refundNumber}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 退款信息 */}
        <Card className="shadow-[var(--shadow-medium)]">
          <CardHeader className="border-b bg-gradient-to-r from-[hsl(var(--color-primary-light))] to-[hsl(var(--color-primary-lighter))]">
            <CardTitle className="flex items-center gap-2 text-[hsl(var(--color-text-primary))]">
              <FileText className="h-5 w-5 text-[hsl(var(--color-primary))]" />
              退款信息
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 bg-[hsl(var(--color-bg-card))]">
            <div className="grid gap-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">退款单号</span>
                <span className="font-medium">{refund.refundNumber}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">退货单号</span>
                <span className="font-medium">
                  {refund.returnOrder?.returnNumber || '-'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">原订单号</span>
                <span className="font-medium">
                  {refund.salesOrder?.orderNumber || '-'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">客户名称</span>
                <span className="font-medium">
                  {refund.customer?.name || '-'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">退款原因</span>
                <span className="font-medium">{refund.reason}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">申请日期</span>
                <span className="font-medium">
                  {formatDate(refund.refundDate)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">当前状态</span>
                {getStatusBadge(refund.status)}
              </div>
            </div>

            <div className="border-t pt-4">
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-sm">
                    退款金额
                  </span>
                  <span className="text-lg font-bold text-[hsl(var(--color-warning))]">
                    {formatCurrency(refund.refundAmount)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-sm">
                    已处理金额
                  </span>
                  <span className="font-medium text-[hsl(var(--color-success))]">
                    {formatCurrency(refund.processedAmount)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-sm">
                    待处理金额
                  </span>
                  <span className="font-medium text-[hsl(var(--color-primary))]">
                    {formatCurrency(refund.remainingAmount)}
                  </span>
                </div>
              </div>
            </div>

            {refund.bankInfo && (
              <div className="border-t pt-4">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-sm">
                    退款账户
                  </span>
                  <span className="font-medium">{refund.bankInfo}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 处理表单 */}
        <Card className="shadow-[var(--shadow-medium)]">
          <CardHeader className="border-b bg-gradient-to-r from-[hsl(var(--color-primary-light))] to-[hsl(var(--color-primary-lighter))]">
            <CardTitle className="flex items-center gap-2 text-[hsl(var(--color-text-primary))]">
              <ChineseYuan className="h-5 w-5 text-[hsl(var(--color-primary))]" />
              退款处理
            </CardTitle>
          </CardHeader>
          <CardContent className="bg-[hsl(var(--color-bg-card))]">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="processedAmount">处理金额 *</Label>
                <Input
                  id="processedAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  max={refund.remainingAmount}
                  value={formData.processedAmount}
                  onChange={event =>
                    handleInputChange('processedAmount', event.target.value)
                  }
                  placeholder="请输入处理金额"
                  required
                />
                <p className="text-muted-foreground text-xs">
                  最大可处理金额：{formatCurrency(refund.remainingAmount)}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="processedDate">处理日期 *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      id="processedDate"
                      type="button"
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !formData.processedDate && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.processedDate ? (
                        format(new Date(formData.processedDate), 'PPP', {
                          locale: zhCN,
                        })
                      ) : (
                        <span>选择日期</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={
                        formData.processedDate
                          ? new Date(formData.processedDate)
                          : undefined
                      }
                      onSelect={date =>
                        handleInputChange(
                          'processedDate',
                          date ? format(date, 'yyyy-MM-dd') : ''
                        )
                      }
                      disabled={date => date > new Date()}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">处理结果 *</Label>
                <Select
                  value={formData.status}
                  onValueChange={value =>
                    handleInputChange(
                      'status',
                      value as RefundFormState['status']
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="completed">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-[hsl(var(--color-success))]" />
                        批准退款
                      </div>
                    </SelectItem>
                    <SelectItem value="rejected">
                      <div className="flex items-center gap-2">
                        <XCircle className="h-4 w-4 text-[hsl(var(--color-error))]" />
                        拒绝退款
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {refund.remainingAmount > 0 && (
                <div className="border-muted-foreground/30 bg-muted/30 rounded-lg border border-dashed p-3">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="closeRemaining"
                      checked={formData.closeRemaining}
                      onCheckedChange={handleCheckboxChange}
                      disabled={
                        formData.status !== 'completed' ||
                        processRefundMutation.isPending
                      }
                    />
                    <div className="space-y-1 text-sm">
                      <Label
                        htmlFor="closeRemaining"
                        className="flex items-center gap-2 font-medium text-[hsl(var(--color-text-primary))]"
                      >
                        抹平剩余金额
                        <Badge variant="outline">
                          剩余 {formatCurrency(refund.remainingAmount)}
                        </Badge>
                      </Label>
                      <p className="text-muted-foreground text-xs">
                        已确认无需退还剩余零头时勾选，系统会将剩余金额记为核销并更新应退金额。
                      </p>
                      {formData.status !== 'completed' && (
                        <p className="text-xs text-[hsl(var(--color-warning))]">
                          仅在选择“批准退款”时可核销剩余金额。
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="remarks">处理备注</Label>
                <Textarea
                  id="remarks"
                  value={formData.remarks}
                  onChange={event =>
                    handleInputChange('remarks', event.target.value)
                  }
                  placeholder="请输入处理备注（可选）"
                  rows={3}
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancel}
                  disabled={processRefundMutation.isPending}
                >
                  取消
                </Button>
                <Button
                  type="submit"
                  disabled={
                    processRefundMutation.isPending || !formData.processedAmount
                  }
                  className="flex-1"
                >
                  {processRefundMutation.isPending ? (
                    <>
                      <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      处理中...
                    </>
                  ) : (
                    <>
                      {formData.status === 'completed' ? (
                        <CheckCircle className="mr-2 h-4 w-4" />
                      ) : (
                        <XCircle className="mr-2 h-4 w-4" />
                      )}
                      {formData.status === 'completed'
                        ? '批准退款'
                        : '拒绝退款'}
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
