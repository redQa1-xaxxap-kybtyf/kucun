'use client';

import { ArrowLeft, PackagePlus, Plus } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef } from 'react';

import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import type { InventoryAdjustFormData } from '@/lib/validations/inventory-operations';

import { InventoryAdjustTable } from './components/InventoryAdjustTable';
import { useInventoryAdjustPage } from './hooks/useInventoryAdjustPage';

const InventoryAdjustDialog = dynamic(
  () =>
    import('./components/InventoryAdjustDialog').then(
      mod => mod.InventoryAdjustDialog
    ),
  { ssr: false, loading: () => null }
);

/**
 * 库存调整页面
 * 显示当前库存状态并提供新增调整功能
 */
export default function InventoryAdjustPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    showAdjustDialog,
    inventoryRecords,
    isLoading,
    handleAdjustSuccess,
    openAdjustDialog,
    closeAdjustDialog,
  } = useInventoryAdjustPage();
  const hasOpenedFromQueryRef = useRef(false);
  const presetReason = searchParams.get('reason');
  const shouldAutoOpen = searchParams.get('open') === '1';
  const initialValues = useMemo(() => {
    if (
      !presetReason ||
      !ADJUST_REASON_SET.has(presetReason as InventoryAdjustFormData['reason'])
    ) {
      return undefined;
    }

    return {
      reason: presetReason as InventoryAdjustFormData['reason'],
    };
  }, [presetReason]);

  useEffect(() => {
    if (!shouldAutoOpen || hasOpenedFromQueryRef.current) {
      return;
    }

    hasOpenedFromQueryRef.current = true;
    openAdjustDialog();
  }, [openAdjustDialog, shouldAutoOpen]);

  // 处理返回操作
  const handleBack = () => {
    router.push('/inventory');
  };

  return (
    <div className="flex h-full flex-col overflow-auto p-4 xl:p-6">
      <div className="space-y-6">
        {/* 页面标题 */}
        <PageHeader
          title="库存调整"
          description={
            initialValues?.reason === 'damage_loss'
              ? '处理仓内破损、报废和损耗，扣减库存后会自动登记到手工报损台账'
              : '查看当前库存状态并进行调整操作'
          }
          icon={<PackagePlus className="h-6 w-6 text-white" />}
          iconBgColor="hsl(var(--color-success))"
          actions={
            <>
              <Button
                variant="outline"
                size="lg"
                className="h-11 gap-2"
                onClick={handleBack}
              >
                <ArrowLeft className="h-4 w-4" />
                返回
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="h-11 gap-2"
                asChild
              >
                <Link href="/inventory/manual-damage">查看手工报损台账</Link>
              </Button>
              <Button
                size="lg"
                className="h-11 gap-2 shadow-sm"
                onClick={openAdjustDialog}
              >
                <Plus className="h-4 w-4" />
                新增调整
              </Button>
            </>
          }
        />

        {/* 调整对话框 */}
        {showAdjustDialog ? (
          <InventoryAdjustDialog
            onClose={closeAdjustDialog}
            onSuccess={handleAdjustSuccess}
            initialValues={initialValues}
          />
        ) : null}

        {/* 当前库存列表 */}
        <div className="overflow-hidden rounded-md border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-card))] shadow-sm">
          <div className="border-b border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-secondary))] px-4 py-3">
            <h2 className="text-sm font-medium text-[hsl(var(--color-text-primary))]">
              当前库存状态
            </h2>
          </div>
          <InventoryAdjustTable
            inventoryRecords={inventoryRecords}
            isLoading={isLoading}
          />
        </div>
      </div>
    </div>
  );
}

const ADJUST_REASON_SET = new Set<InventoryAdjustFormData['reason']>([
  'inventory_gain',
  'inventory_loss',
  'damage_loss',
  'surplus_gain',
  'transfer',
  'other',
]);
