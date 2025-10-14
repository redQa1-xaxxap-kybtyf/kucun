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
import type { StatementTransaction } from '@/lib/types/statement';
import { formatCurrency, formatDate } from '@/lib/utils/format';

interface StatementTransactionsProps {
  transactions: StatementTransaction[];
}

const TRANSACTION_TYPE_LABEL: Record<string, string> = {
  sale: '销售',
  sales_return: '销售退货',
  payment_in: '收款',
  payment_out: '付款',
  prepayment_in: '预收款',
  prepayment_out: '预付款',
  refund: '退款',
  purchase: '采购',
  adjustment: '调整',
};

export function StatementTransactions({
  transactions,
}: StatementTransactionsProps) {
  const router = useRouter();

  // 倒序显示交易记录（最新的在前）
  const reversedTransactions = [...transactions].reverse();

  const getTransactionTypeBadge = (type: string) => {
    const label = TRANSACTION_TYPE_LABEL[type] ?? '其他';
    const variant =
      type === 'payment_in' || type === 'prepayment_in'
        ? 'secondary'
        : type === 'payment_out' || type === 'prepayment_out'
          ? 'destructive'
          : 'outline';
    return <Badge variant={variant}>{label}</Badge>;
  };

  const getTransactionStatusBadge = (
    status: StatementTransaction['status']
  ) => {
    const variant = status === 'pending' ? 'secondary' : 'outline';
    const label = status === 'pending' ? '待入账' : '已完成';
    return <Badge variant={variant}>{label}</Badge>;
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
              <TableHead>描述</TableHead>
              <TableHead className="text-right">应收增加</TableHead>
              <TableHead className="text-right">应收减少</TableHead>
              <TableHead className="text-right">余额</TableHead>
              <TableHead>交易日期</TableHead>
              <TableHead>状态</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reversedTransactions.map(transaction => {
              const debit = transaction.debitAmount || 0;
              const credit = transaction.creditAmount || 0;
              const balanceClass =
                transaction.balance >= 0
                  ? 'text-[hsl(var(--color-success))]'
                  : 'text-[hsl(var(--color-warning))]';

              return (
                <TableRow key={transaction.id}>
                  <TableCell>
                    {getTransactionTypeBadge(transaction.transactionType)}
                  </TableCell>
                  <TableCell className="font-medium">
                    {transaction.referenceNumber || '-'}
                  </TableCell>
                  <TableCell className="max-w-[220px] truncate">
                    {transaction.description}
                  </TableCell>
                  <TableCell className="text-right font-medium text-[hsl(var(--color-error))]">
                    {debit > 0 ? formatCurrency(debit) : '-'}
                  </TableCell>
                  <TableCell className="text-right font-medium text-[hsl(var(--color-success))]">
                    {credit > 0 ? formatCurrency(credit) : '-'}
                  </TableCell>
                  <TableCell
                    className={`text-right font-semibold ${balanceClass}`}
                  >
                    {formatCurrency(
                      transaction.afterBalance ?? transaction.balance
                    )}
                  </TableCell>
                  <TableCell>
                    {formatDate(transaction.transactionDate, 'datetime')}
                  </TableCell>
                  <TableCell>
                    {getTransactionStatusBadge(transaction.status)}
                  </TableCell>
                  <TableCell className="text-right">
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
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
