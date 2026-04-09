'use client';

import { ArrowLeft, PackageCheck, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { can } from '@/lib/auth/permissions';

interface InboundRecordsToolbarProps {
  onCreateNew: () => void;
}

/**
 * 入库记录工具栏组件
 *
 * 功能：
 * - 显示页面标题和描述
 * - 提供"返回"和"新建入库"操作按钮
 * - 根据用户权限控制"新建入库"按钮的显示
 *
 * 权限控制：
 * - 需要 `inventory:inbound` 权限才能显示"新建入库"按钮
 * - 无权限时按钮不显示（而非禁用），提供更好的用户体验
 */
export function InboundRecordsToolbar({
  onCreateNew,
}: InboundRecordsToolbarProps) {
  const router = useRouter();
  const { data: session } = useSession();

  // 检查用户是否有入库操作权限
  const hasInboundPermission = can(
    session?.user
      ? {
          id: session.user.id || '',
          email: session.user.email || '',
          username: session.user.username || '',
          name: session.user.name || '',
          role: session.user.role || 'sales',
          status: 'active',
        }
      : null,
    'inventory:inbound'
  );

  return (
    <PageHeader
      title="入库记录"
      description="查看全部入库记录，跟踪库存增加情况"
      icon={<PackageCheck className="h-6 w-6" />}
      iconBgColor="hsl(var(--color-primary))"
      variant="solid"
      actions={
        <>
          <Button
            variant="outline"
            size="lg"
            className="h-11 gap-2"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4" />
            返回
          </Button>
          {/* 只有拥有入库权限的用户才能看到"新建入库"按钮 */}
          {hasInboundPermission && (
            <Button
              size="lg"
              className="card-shadow-light h-11 gap-2 transition-transform duration-150 hover:scale-[1.02]"
              onClick={onCreateNew}
            >
              <Plus className="h-4 w-4" />
              手工采购入库
            </Button>
          )}
        </>
      }
    />
  );
}
