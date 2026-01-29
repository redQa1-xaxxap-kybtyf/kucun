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
import { cn } from '@/lib/utils';
import { formatDateTime } from '@/lib/utils/datetime';
import { formatCurrency } from '@/lib/utils/format';

interface StatementTransactionsProps {
  transactions: StatementTransaction[];
}

const TRANSACTION_TYPE_LABEL: Record<string, string> = {
  sale: '销售',
  sales_return: '销售退货',
  order_cancellation: '订单取消',
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
    const isPending = status === 'pending';
    return (
      <Badge
        className={cn(
          'font-bold tracking-wider uppercase',
          isPending
            ? 'border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400'
            : 'border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
        )}
      >
        {isPending ? '待入账' : '已核销'}
      </Badge>
    );
  };

  return (
    <Card>
      <CardHeader className="border-b border-slate-200 bg-slate-50 px-6 py-4">
        <CardTitle className="flex items-center gap-2 text-sm font-black tracking-widest text-slate-500 uppercase italic">
          <FileText className="h-4 w-4" />
          全业务往来明细账
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader className="bg-slate-50/50">
            <TableRow className="border-b border-slate-200 hover:bg-transparent">
              <TableHead className="py-4 font-black text-slate-700">
                业务类型
              </TableHead>
              <TableHead className="py-4 font-black text-slate-700">
                单据编号
              </TableHead>
              <TableHead className="py-4 font-black text-slate-700">
                科目摘要
              </TableHead>
              <TableHead className="py-4 text-right font-black text-slate-700">
                借方 (应收+)
              </TableHead>
              <TableHead className="py-4 text-right font-black text-slate-700">
                贷方 (应收-)
              </TableHead>
              <TableHead className="py-4 text-right font-black text-slate-700">
                余额 (元)
              </TableHead>
              <TableHead className="py-4 font-black text-slate-700">
                记账时间
              </TableHead>
              <TableHead className="py-4 font-black text-slate-700">
                核销状态
              </TableHead>
              <TableHead className="py-4 text-right font-black text-slate-700">
                操作
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reversedTransactions.map(transaction => {
              const debit = transaction.debitAmount || 0;
              const credit = transaction.creditAmount || 0;
              const isPositive = transaction.balance >= 0;

              return (
                <TableRow
                  key={transaction.id}
                  className="group transition-colors hover:bg-blue-50/30"
                >
                  <TableCell className="py-4">
                    {getTransactionTypeBadge(transaction.transactionType)}
                  </TableCell>
                  <TableCell className="py-4 font-mono text-xs font-black tracking-tighter text-slate-400 group-hover:text-slate-900">
                    {transaction.referenceNumber || '-'}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate py-4 text-xs font-bold text-slate-500">
                    {transaction.description}
                  </TableCell>
                  <TableCell className="py-4 text-right">
                    {debit > 0 ? (
                      <span className="font-mono text-sm font-black tracking-tight text-rose-500">
                        + {formatCurrency(debit).replace('¥', '')}
                      </span>
                    ) : (
                      <span className="text-slate-200">-</span>
                    )}
                  </TableCell>
                  <TableCell className="py-4 text-right">
                    {credit > 0 ? (
                      <span className="font-mono text-sm font-black tracking-tight text-emerald-500">
                        - {formatCurrency(credit).replace('¥', '')}
                      </span>
                    ) : (
                      <span className="text-slate-200">-</span>
                    )}
                  </TableCell>
                  <TableCell className="py-4 text-right">
                    <span
                      className={cn(
                        'font-mono text-sm font-black tracking-tight',
                        isPositive ? 'text-orange-500' : 'text-rose-500'
                      )}
                    >
                      {formatCurrency(
                        transaction.afterBalance ?? transaction.balance
                      ).replace('¥', '')}
                    </span>
                  </TableCell>
                  <TableCell className="py-4 text-[10px] font-bold text-slate-400 uppercase">
                    {formatDateTime(transaction.transactionDate)}
                  </TableCell>
                  <TableCell className="py-4">
                    {getTransactionStatusBadge(transaction.status)}
                  </TableCell>
                  <TableCell className="py-4 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 rounded-full p-0 opacity-0 transition-opacity group-hover:opacity-100 dark:hover:bg-slate-800"
                      onClick={() =>
                        router.push(`/finance/transactions/${transaction.id}`)
                      }
                    >
                      <Eye className="h-4 w-4 text-blue-600" />
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
