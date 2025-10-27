'use client';

import { Users } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDateTime } from '@/lib/utils/datetime';

interface StatementBasicInfoProps {
  entity: {
    name: string;
    phone?: string;
    address?: string;
  };
  partnerRole: 'customer' | 'supplier' | 'both';
  lastTransactionDate?: Date | string | null;
  lastPaymentDate?: Date | string | null;
}

const ROLE_LABEL_MAP: Record<StatementBasicInfoProps['partnerRole'], string> = {
  customer: '客户',
  supplier: '供应商',
  both: '客户 / 供应商',
};

export function StatementBasicInfo({
  entity,
  partnerRole,
  lastTransactionDate,
  lastPaymentDate,
}: StatementBasicInfoProps) {
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
          <span className="text-muted-foreground text-sm">伙伴类型</span>
          <span className="font-medium">{ROLE_LABEL_MAP[partnerRole]}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground text-sm">联系电话</span>
          <span className="font-medium">{entity.phone || '-'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground text-sm">地址</span>
          <span className="text-right text-sm font-medium">
            {entity.address || '-'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground text-sm">最后交易</span>
          <span className="font-medium">
            {lastTransactionDate ? formatDateTime(lastTransactionDate, 'yyyy-MM-dd HH:mm') : '-'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground text-sm">最近收付</span>
          <span className="font-medium">
            {lastPaymentDate ? formatDateTime(lastPaymentDate, 'yyyy-MM-dd HH:mm') : '-'}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
