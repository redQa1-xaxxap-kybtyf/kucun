'use client';

import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  CheckCircle,
  DollarSign,
  FileText,
  XCircle,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { useProcessRefund, useRefundDetail } from '@/lib/api/refunds';

interface RefundProcessPageProps {
  params: Promise<{ id: string }>;
}

/**
 * 退款处理页面
 * 处理退款申请的审核和执行
 */
export default function RefundProcessPage({ params }: RefundProcessPageProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [refundId, setRefundId] = React.useState<string>('');

  // 从 params 获取 ID
  React.useEffect(() => {
    params.then(p => setRefundId(p.id));
  }, [params]);

  const [formData, setFormData] = React.useState({
    processedAmount: '',
    processedDate: new Date().toISOString().split('T')[0],
    status: 'completed' as 'completed' | 'rejected',
    remarks: '',
  });

  // 获取退款详情
  const { data: refund, isLoading, error } = useRefundDetail(refundId);

  // 处理退款 mutation
  const processRefundMutation = useProcessRefund();

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
        icon: Calendar,
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await processRefundMutation.mutateAsync({
        id: refundId,
        data: {
          processedAmount: parseFloat(formData.processedAmount),
          processedDate: formData.processedDate,
          status: formData.status,
          remarks: formData.remarks,
        },
      });

      toast({
        title: '处理成功',
        description: formData.status === 'completed' ? '退款已批准' : '退款已拒绝',
        variant: 'success',
      });

      // 处理成功后跳转
      router.push('/finance/refunds');
    } catch (error) {
      toast({
        title: '处理失败',
        description: error instanceof Error ? error.message : '处理退款失败，请重试',
        variant: 'destructive',
      });
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // 加载状态
  if (isLoading || !refundId) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="border-primary h-8 w-8 animate-spin rounded-full border-b-2"></div>
      </div>
    );
  }

  // 错误状态
  if (error || !refund) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-red-600">
            {error ? '加载退款详情失败' : '退款记录不存在'}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* 页面标题和导航 */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          返回
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">处理退款申请</h1>
          <p className="text-muted-foreground">
            退款单号：{refund.refundNumber}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 退款信息 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              退款信息
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">退款单号</span>
                <span className="font-medium">{refund.refundNumber}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">退货单号</span>
                <span className="font-medium">{refund.returnOrder?.returnNumber || '-'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">原订单号</span>
                <span className="font-medium">
                  {refund.salesOrder?.orderNumber || '-'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">客户名称</span>
                <span className="font-medium">{refund.customer?.name || '-'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">退款原因</span>
                <span className="font-medium">{refund.reason}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">申请日期</span>
                <span className="font-medium">
                  {new Date(refund.refundDate).toLocaleDateString('zh-CN')}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">当前状态</span>
                {getStatusBadge(refund.status)}
              </div>
            </div>

            <div className="border-t pt-4">
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    退款金额
                  </span>
                  <span className="text-lg font-bold text-orange-600">
                    {formatCurrency(refund.refundAmount)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    已处理金额
                  </span>
                  <span className="font-medium text-green-600">
                    {formatCurrency(refund.processedAmount)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    待处理金额
                  </span>
                  <span className="font-medium text-blue-600">
                    {formatCurrency(refund.remainingAmount)}
                  </span>
                </div>
              </div>
            </div>

            {refund.bankInfo && (
              <div className="border-t pt-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    退款账户
                  </span>
                  <span className="font-medium">{refund.bankInfo}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 处理表单 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              退款处理
            </CardTitle>
          </CardHeader>
          <CardContent>
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
                  onChange={e =>
                    handleInputChange('processedAmount', e.target.value)
                  }
                  placeholder="请输入处理金额"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  最大可处理金额：{formatCurrency(refund.remainingAmount)}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="processedDate">处理日期 *</Label>
                <Input
                  id="processedDate"
                  type="date"
                  value={formData.processedDate}
                  onChange={e =>
                    handleInputChange('processedDate', e.target.value)
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">处理结果 *</Label>
                <Select
                  value={formData.status}
                  onValueChange={value => handleInputChange('status', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="completed">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        批准退款
                      </div>
                    </SelectItem>
                    <SelectItem value="rejected">
                      <div className="flex items-center gap-2">
                        <XCircle className="h-4 w-4 text-red-600" />
                        拒绝退款
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="remarks">处理备注</Label>
                <Textarea
                  id="remarks"
                  value={formData.remarks}
                  onChange={e => handleInputChange('remarks', e.target.value)}
                  placeholder="请输入处理备注（可选）"
                  rows={3}
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                  disabled={processRefundMutation.isPending}
                >
                  取消
                </Button>
                <Button
                  type="submit"
                  disabled={processRefundMutation.isPending || !formData.processedAmount}
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
