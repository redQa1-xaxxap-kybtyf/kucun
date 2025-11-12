'use client';

/**
 * 销售订单页面头部组件
 * 严格遵循全栈项目统一约定规范
 * 使用统一的PageHeader组件
 */

import { Plus, ShoppingCart } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';

export function SalesOrderPageHeader() {
  const router = useRouter();

  return (
    <PageHeader
      title="销售订单"
      description="管理销售订单和发货信息"
      icon={<ShoppingCart className="h-6 w-6 text-white" />}
      iconBgColor="hsl(var(--color-blue))"
      actions={
        <Button
          size="lg"
          onClick={() => router.push('/sales-orders/create')}
          className="h-11 shadow-[var(--shadow-light)] transition-transform hover:-translate-y-0.5 hover:shadow-[var(--shadow-medium)]"
        >
          <Plus className="mr-2 h-4 w-4" />
          新建订单
        </Button>
      }
    />
  );
}
