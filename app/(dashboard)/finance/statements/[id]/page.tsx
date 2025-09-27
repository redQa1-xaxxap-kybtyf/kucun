'use client';

import {
  ArrowLeft,
  DollarSign,
  Download,
  Eye,
  FileText,
  Receipt,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface StatementDetailPageProps {
  params: {
    id: string;
  };
}

/**
 * 往来账单详情页面
 * 显示客户或供应商的详细账务往来信息
 */
export default function StatementDetailPage({
  params,
}: StatementDetailPageProps) {
  const router = useRouter();

  // 模拟数据 - 实际项目中应该从API获取
  const mockStatement = {
    id: params.id,
    name: '张三建材',
    type: 'customer',
    totalOrders: 15,
    totalAmount: 125000.0,
    paidAmount: 85000.0,
    pendingAmount: 40000.0,
    overdueAmount: 15000.0,
    creditLimit: 50000.0,
    paymentTerms: '30天',
    status: 'overdue',
    lastTransactionDate: '2025-01-15',
    lastPaymentDate: '2025-01-10',
    contact: {
      phone: '138-0000-1234',
      address: '北京市朝阳区建材街123号',
    },
    transactions: [
      {
        id: '1',
        type: 'sale',
        referenceNumber: 'SO-2025-001',
        amount: 25000.0,
        balance: 25000.0,
        description: '销售订单 - 瓷砖采购',
        transactionDate: '2025-01-10',
        dueDate: '2025-02-09',
        status: 'pending',
      },
      {
        id: '2',
        type: 'payment',
        referenceNumber: 'PAY-2025-001',
        amount: -10000.0,
        balance: 15000.0,
        description: '客户付款 - 银行转账',
        transactionDate: '2025-01-12',
        status: 'completed',
      },
      {
        id: '3',
        type: 'sale',
        referenceNumber: 'SO-2025-002',
        amount: 18000.0,
        balance: 33000.0,
        description: '销售订单 - 地板采购',
        transactionDate: '2024-12-15',
        dueDate: '2025-01-14',
        status: 'overdue',
      },
    ],
    summary: {
      currentMonthAmount: 25000.0,
      lastMonthAmount: 18000.0,
      averageMonthlyAmount: 21500.0,
      paymentRate: 68.0,
      averagePaymentDays: 25,
    },
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: 'CNY',
    }).format(amount);

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      active: { label: '正常', variant: 'default' as const },
      settled: { label: '已结清', variant: 'default' as const },
      overdue: { label: '逾期', variant: 'destructive' as const },
      suspended: { label: '暂停', variant: 'secondary' as const },
    };
    const config = statusConfig[status as keyof typeof statusConfig];
    return (
      <Badge variant={config?.variant || 'secondary'}>{config?.label}</Badge>
    );
  };

  const getTransactionTypeBadge = (type: string) => {
    const typeConfig = {
      sale: { label: '销售', variant: 'default' as const, icon: TrendingUp },
      payment: {
        label: '收款',
        variant: 'default' as const,
        icon: TrendingDown,
      },
      refund: {
        label: '退款',
        variant: 'secondary' as const,
        icon: TrendingDown,
      },
      adjustment: {
        label: '调整',
        variant: 'outline' as const,
        icon: FileText,
      },
    };
    const config = typeConfig[type as keyof typeof typeConfig];
    const IconComponent = config?.icon || FileText;
    return (
      <Badge
        variant={config?.variant || 'outline'}
        className="flex items-center gap-1"
      >
        <IconComponent className="h-3 w-3" />
        {config?.label}
      </Badge>
    );
  };

  const getTransactionStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { label: '待收款', variant: 'secondary' as const },
      completed: { label: '已完成', variant: 'default' as const },
      overdue: { label: '逾期', variant: 'destructive' as const },
    };
    const config = statusConfig[status as keyof typeof statusConfig];
    return (
      <Badge variant={config?.variant || 'secondary'}>{config?.label}</Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* 页面标题和操作 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {mockStatement.name}
            </h1>
            <div className="mt-1 flex items-center gap-2">
              <Badge variant="outline">
                {mockStatement.type === 'customer' ? '客户' : '供应商'}
              </Badge>
              {getStatusBadge(mockStatement.status)}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            导出对账单
          </Button>
          <Button variant="outline" size="sm">
            <Receipt className="mr-2 h-4 w-4" />
            生成报表
          </Button>
          {mockStatement.type === 'customer' &&
            mockStatement.pendingAmount > 0 && (
              <Button size="sm">
                <DollarSign className="mr-2 h-4 w-4" />
                收款
              </Button>
            )}
        </div>
      </div>

      {/* 基本信息和统计 */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* 基本信息 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              基本信息
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">联系电话</span>
              <span className="font-medium">{mockStatement.contact.phone}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">地址</span>
              <span className="text-right text-sm font-medium">
                {mockStatement.contact.address}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">信用额度</span>
              <span className="font-medium">
                {formatCurrency(mockStatement.creditLimit)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">付款条件</span>
              <span className="font-medium">{mockStatement.paymentTerms}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">最后交易</span>
              <span className="font-medium">
                {mockStatement.lastTransactionDate}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">最后付款</span>
              <span className="font-medium">
                {mockStatement.lastPaymentDate}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* 账务统计 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              账务统计
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">总交易金额</span>
              <span className="font-bold">
                {formatCurrency(mockStatement.totalAmount)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">已付金额</span>
              <span className="font-medium text-green-600">
                {formatCurrency(mockStatement.paidAmount)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">待收金额</span>
              <span className="font-medium text-orange-600">
                {formatCurrency(mockStatement.pendingAmount)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">逾期金额</span>
              <span className="font-medium text-red-600">
                {formatCurrency(mockStatement.overdueAmount)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">总订单数</span>
              <span className="font-medium">{mockStatement.totalOrders}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">收款率</span>
              <span className="font-medium">
                {mockStatement.summary.paymentRate}%
              </span>
            </div>
          </CardContent>
        </Card>

        {/* 趋势分析 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              趋势分析
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">本月交易</span>
              <span className="font-medium">
                {formatCurrency(mockStatement.summary.currentMonthAmount)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">上月交易</span>
              <span className="font-medium">
                {formatCurrency(mockStatement.summary.lastMonthAmount)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">月均交易</span>
              <span className="font-medium">
                {formatCurrency(mockStatement.summary.averageMonthlyAmount)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">平均账期</span>
              <span className="font-medium">
                {mockStatement.summary.averagePaymentDays}天
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">环比增长</span>
              <span className="font-medium text-green-600">
                +
                {(
                  ((mockStatement.summary.currentMonthAmount -
                    mockStatement.summary.lastMonthAmount) /
                    mockStatement.summary.lastMonthAmount) *
                  100
                ).toFixed(1)}
                %
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 交易明细 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            交易明细
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>交易类型</TableHead>
                <TableHead>单据号</TableHead>
                <TableHead>交易描述</TableHead>
                <TableHead>交易金额</TableHead>
                <TableHead>余额</TableHead>
                <TableHead>交易日期</TableHead>
                <TableHead>到期日期</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockStatement.transactions.map(transaction => (
                <TableRow key={transaction.id}>
                  <TableCell>
                    {getTransactionTypeBadge(transaction.type)}
                  </TableCell>
                  <TableCell className="font-medium">
                    {transaction.referenceNumber}
                  </TableCell>
                  <TableCell>{transaction.description}</TableCell>
                  <TableCell>
                    <span
                      className={
                        transaction.amount > 0
                          ? 'text-red-600'
                          : 'text-green-600'
                      }
                    >
                      {formatCurrency(Math.abs(transaction.amount))}
                    </span>
                  </TableCell>
                  <TableCell className="font-medium">
                    {formatCurrency(transaction.balance)}
                  </TableCell>
                  <TableCell>{transaction.transactionDate}</TableCell>
                  <TableCell>{transaction.dueDate || '-'}</TableCell>
                  <TableCell>
                    {getTransactionStatusBadge(transaction.status)}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
