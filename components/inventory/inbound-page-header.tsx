'use client';

/**
 * 仓库进货页面头部组件
 * 严格遵循全栈项目统一约定规范
 * 使用统一的PageHeader组件
 * 与销售订单页面保持一致的结构
 */

import { FileText, PackageCheck, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { can } from '@/lib/auth/permissions';

export function InboundPageHeader() {
  const router = useRouter();
  const { data: session } = useSession();
  const user = session?.user;

  return (
    <PageHeader
      title="入库记录"
      description="查看和管理产品入库记录，跟踪库存增加情况"
      icon={<PackageCheck className="h-6 w-6 text-white" />}
      iconBgColor="hsl(var(--color-primary))"
      actions={
        <div className="flex items-center gap-3">
          {/* 期初入库按钮 - 仅对有权限的用户显示 */}
          {can(user, 'inventory:opening_balance') && (
            <Button
              variant="secondary"
              size="lg"
              onClick={() =>
                router.push('/inventory/inbound/create?type=opening_balance')
              }
            >
              <FileText className="mr-2 h-4 w-4" />
              期初入库
            </Button>
          )}

          {/* 普通入库按钮 */}
          <Button
            size="lg"
            onClick={() => router.push('/inventory/inbound/create')}
          >
            <Plus className="mr-2 h-4 w-4" />
            新增入库
          </Button>
        </div>
      }
    />
  );
}
