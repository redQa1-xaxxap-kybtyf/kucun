'use client';

/**
 * 仓库进货页面头部组件
 * 严格遵循全栈项目统一约定规范
 * 使用统一的PageHeader组件
 * 与销售订单页面保持一致的结构
 */

import { PackageCheck, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';

export function InboundPageHeader() {
  const router = useRouter();

  return (
    <PageHeader
      title="入库记录"
      description="查看和管理产品入库记录，跟踪库存增加情况"
      icon={<PackageCheck className="h-6 w-6 text-white" />}
      iconBgColor="hsl(var(--color-primary))"
      actions={
        <Button
          size="lg"
          onClick={() => router.push('/inventory/inbound/create')}
        >
          <Plus className="mr-2 h-4 w-4" />
          新增入库
        </Button>
      }
    />
  );
}
