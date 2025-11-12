'use client';

/**
 * 供应商页面头部组件
 * 使用统一的PageHeader组件
 * 严格遵循全栈项目统一约定规范
 */

import { Building2, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';

export function SupplierPageHeader() {
  const router = useRouter();

  return (
    <PageHeader
      title="供应商管理"
      description="管理供应商信息，跟踪采购和合作情况"
      icon={<Building2 className="h-6 w-6 text-white" />}
      iconBgColor="hsl(var(--color-orange))"
      actions={
        <Button
          size="lg"
          onClick={() => router.push('/suppliers/create')}
          className="h-11 shadow-[var(--shadow-light)] transition-transform hover:-translate-y-0.5 hover:shadow-[var(--shadow-medium)]"
        >
          <Plus className="mr-2 h-4 w-4" />
          新建供应商
        </Button>
      }
    />
  );
}
