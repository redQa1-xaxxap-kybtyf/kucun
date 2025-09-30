'use client';

import { ArrowLeft, Download, Receipt } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface StatementHeaderProps {
  name: string;
  type: 'customer' | 'supplier';
  status: string;
}

/**
 * 账单详情页面头部组件
 */
export function StatementHeader({ name, type, status }: StatementHeaderProps) {
  const router = useRouter();

  const getStatusBadge = (status: string) => {
    const statusMap: Record<
      string,
      { label: string; variant: 'default' | 'secondary' | 'destructive' }
    > = {
      normal: { label: '正常', variant: 'default' },
      overdue: { label: '逾期', variant: 'destructive' },
      warning: { label: '预警', variant: 'secondary' },
    };

    const statusInfo = statusMap[status] || {
      label: '未知',
      variant: 'secondary' as const,
    };
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>;
  };

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          返回
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{name}</h1>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant="outline">
              {type === 'customer' ? '客户' : '供应商'}
            </Badge>
            {getStatusBadge(status)}
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
      </div>
    </div>
  );
}
