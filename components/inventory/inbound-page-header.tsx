'use client';

/**
 * 仓库进货页面头部组件
 * 严格遵循全栈项目统一约定规范
 * 使用统一的PageHeader组件
 * 与销售订单页面保持一致的结构
 */

import { FileSpreadsheet, FileText, PackageCheck, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useState } from 'react';

import { PageHeader } from '@/components/common/page-header';
import { InitialStockImportDialog } from '@/components/inventory/initial-stock-import-dialog';
import { Button } from '@/components/ui/button';
import { can } from '@/lib/auth/permissions';

export function InboundPageHeader() {
  const router = useRouter();
  const { data: session } = useSession();
  const user = session?.user;
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  return (
    <>
      <PageHeader
        title="入库记录"
        description="采购入库、期初库存和破损记录"
        icon={<PackageCheck className="h-6 w-6" />}
        iconBgColor="hsl(var(--color-primary))"
        actions={
          <>
            {/* 期初入库按钮 - 仅对有权限的用户显示 */}
            {can(user ?? null, 'inventory:opening_balance') && (
              <>
                <Button
                  variant="outline"
                  className="h-11 border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-900"
                  onClick={() => setImportDialogOpen(true)}
                >
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  期初库存批量导入
                </Button>
                <Button
                  variant="outline"
                  className="h-11 border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  onClick={() =>
                    router.push(
                      '/inventory/inbound/create?type=opening_balance'
                    )
                  }
                >
                  <FileText className="mr-2 h-4 w-4" />
                  期初库存录入
                </Button>
              </>
            )}

            {/* 新增入库按钮 */}
            <Button
              className="h-11 bg-blue-600 text-white hover:bg-blue-700"
              onClick={() => router.push('/inventory/inbound/create')}
            >
              <Plus className="mr-2 h-4 w-4" />
              手工采购入库
            </Button>
          </>
        }
      />
      <InitialStockImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
      />
    </>
  );
}
