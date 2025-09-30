'use client';

import { Users } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface StatementBasicInfoProps {
  contact: {
    phone: string;
    address: string;
  };
  creditLimit: number;
  paymentTerms: string;
  lastTransactionDate: string | null;
  lastPaymentDate: string | null;
}

/**
 * 账单基本信息卡片组件
 */
export function StatementBasicInfo({
  contact,
  creditLimit,
  paymentTerms,
  lastTransactionDate,
  lastPaymentDate,
}: StatementBasicInfoProps) {
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: 'CNY',
    }).format(amount);

  return (
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
          <span className="font-medium">{contact.phone || '-'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">地址</span>
          <span className="text-right text-sm font-medium">
            {contact.address || '-'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">信用额度</span>
          <span className="font-medium">{formatCurrency(creditLimit)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">账期</span>
          <span className="font-medium">{paymentTerms}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">最后交易</span>
          <span className="font-medium">{lastTransactionDate || '-'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">最后付款</span>
          <span className="font-medium">{lastPaymentDate || '-'}</span>
        </div>
      </CardContent>
    </Card>
  );
}
