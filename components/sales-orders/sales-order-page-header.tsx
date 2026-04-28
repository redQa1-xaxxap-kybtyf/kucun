'use client';

/**
 * 销售订单页面头部组件
 * 严格遵循全栈项目统一约定规范
 * 使用统一的PageHeader组件
 */

import { Clock, Plus, ShoppingCart, Upload } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import type { SalesOrderRecordScope } from '@/lib/types/sales-order';
import {
  getCurrentPathWithSearch,
  withReturnTo,
} from '@/lib/utils/sales-order-navigation';

import { SalesOrderImportDialog } from './sales-order-import-dialog';

interface SalesOrderPageHeaderProps {
  recordScope?: SalesOrderRecordScope;
  onRecordScopeChange?: (recordScope?: SalesOrderRecordScope) => void;
}

export function SalesOrderPageHeader({
  recordScope,
  onRecordScopeChange,
}: SalesOrderPageHeaderProps) {
  const router = useRouter();
  const [importOpen, setImportOpen] = React.useState(false);
  const isHistoryView = recordScope === 'history';

  return (
    <>
      <PageHeader
        title={isHistoryView ? '历史销售记录' : '销售订单'}
        description={
          isHistoryView ? '查看导入的历史单据' : '开单、发货和收款进度'
        }
        icon={<ShoppingCart className="h-6 w-6 text-white" />}
        iconBgColor="hsl(var(--color-info))"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="lg"
              variant="outline"
              onClick={() =>
                onRecordScopeChange
                  ? onRecordScopeChange(isHistoryView ? undefined : 'history')
                  : router.push(
                      isHistoryView
                        ? '/sales-orders'
                        : '/sales-orders?recordScope=history'
                    )
              }
              className="h-11"
            >
              <Clock className="mr-2 h-4 w-4" />
              {isHistoryView ? '返回销售订单' : '历史销售记录'}
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => setImportOpen(true)}
              className="h-11"
            >
              <Upload className="mr-2 h-4 w-4" />
              导入销售记录
            </Button>
            <Button
              size="lg"
              onClick={() =>
                router.push(
                  withReturnTo(
                    '/sales-orders/create',
                    getCurrentPathWithSearch() ?? '/sales-orders'
                  )
                )
              }
              className="h-11 rounded-md"
            >
              <Plus className="mr-2 h-4 w-4" />
              新建订单
            </Button>
          </div>
        }
      />
      <SalesOrderImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </>
  );
}
