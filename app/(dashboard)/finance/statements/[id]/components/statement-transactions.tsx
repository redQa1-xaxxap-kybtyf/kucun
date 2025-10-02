'use client';

import { Eye, FileText } from 'lucide-react';
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

interface Transaction {
  id: string;
  type: string;
  referenceNumber: string;
  amount: number;
  balance: number;
  description: string;
  transactionDate: string;
  dueDate?: string;
  status: string;
}

interface StatementTransactionsProps {
  transactions: Transaction[];
}

/**
 * 账单交易明细表格组件
 */
export function StatementTransactions({
  transactions,
}: StatementTransactionsProps) {
  const router = useRouter();

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: 'CNY',
    }).format(amount);

  const getTransactionTypeBadge = (type: string) => {
    const typeMap: Record<
      string,
      { label: string; variant: 'default' | 'secondary' | 'outline' }
    > = {
      sale: { label: '销售', variant: 'default' },
      payment: { label: '收款', variant: 'secondary' },
      refund: { label: '退款', variant: 'outline' },
      purchase: { label: '采购', variant: 'default' },
      payment_out: { label: '付款', variant: 'secondary' },
    };

    const typeInfo = typeMap[type] || {
      label: '其他',
      variant: 'outline' as const,
    };
    return <Badge variant={typeInfo.variant}>{typeInfo.label}</Badge>;
  };

  const getTransactionStatusBadge = (status: string) => {
    const statusMap: Record<
      string,
      { label: string; variant: 'default' | 'secondary' | 'destructive' }
    > = {
      pending: { label: '待处理', variant: 'secondary' },
      completed: { label: '已完成', variant: 'default' },
      overdue: { label: '逾期', variant: 'destructive' },
    };

    const statusInfo = statusMap[status] || {
      label: '未知',
      variant: 'secondary' as const,
    };
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>;
  };

  return (
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
            {transactions.map(transaction => (
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
                      transaction.amount >= 0
                        ? 'text-green-600'
                        : 'text-red-600'
                    }
                  >
                    {formatCurrency(transaction.amount)}
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
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      router.push(`/finance/transactions/${transaction.id}`)
                    }
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
