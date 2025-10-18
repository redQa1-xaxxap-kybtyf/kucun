'use client';

import { ArrowLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';

interface SalesOrderHeaderProps {
  onBack: () => void;
}

export function SalesOrderHeader({ onBack }: SalesOrderHeaderProps) {
  return (
    <div className="flex items-center gap-4">
      <Button type="button" variant="ghost" onClick={onBack}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        返回
      </Button>
      <div>
        <h1 className="text-3xl font-bold tracking-tight">新建销售订单</h1>
        <p className="text-muted-foreground">
          创建新的销售订单，支持完整的开票信息
        </p>
      </div>
    </div>
  );
}
