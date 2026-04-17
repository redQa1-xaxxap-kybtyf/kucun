'use client';

import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Download,
  Edit,
  MoreHorizontal,
  PackageX,
  Printer,
  Truck,
  Undo2,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useSalesOrderExport } from '@/hooks/use-sales-order-export';
import {
  SALES_ORDER_STATUS_LABELS,
  SALES_ORDER_TYPE_LABELS,
  SAMPLE_SETTLEMENT_TYPE_LABELS,
  TRANSFER_MODE_LABELS,
} from '@/lib/types/sales-order';
import { getSalesOrderStatusBadgeVariant } from '@/lib/utils/badge-helpers';
import {
  buildQuickReturnPath,
  getCurrentPathWithSearch,
  withReturnTo,
} from '@/lib/utils/sales-order-navigation';

import type { SalesOrderDetail } from './types';

const PrintTemplatePreviewDialog = dynamic(
  () =>
    import(
      '@/components/print-designer/renderer/PrintTemplatePreviewDialog'
    ).then(mod => mod.PrintTemplatePreviewDialog),
  { ssr: false, loading: () => null }
);

interface Props {
  order: SalesOrderDetail;
  id: string;
  returnTo?: string;
  canEditOrder: boolean;
  canConfirmOrder: boolean;
  canQuickReturn: boolean;
  withdrawConfirmationDisabledReason?: string;
  isUpdatingStatus: boolean;
  onConfirmOrder: () => void;
  onWithdrawConfirmation: () => void;
  onConfirmShipment: () => void;
  onShowToast: (
    title: string,
    description: string,
    variant?: 'destructive' | 'default'
  ) => void;
  density: 'compact' | 'comfortable';
  onDensityChange: (value: 'compact' | 'comfortable') => void;
}

interface HeaderActionsProps {
  canEditOrder: boolean;
  canConfirmOrder: boolean;
  canQuickReturn: boolean;
  isDraft: boolean;
  isConfirmed: boolean;
  withdrawConfirmationDisabledReason?: string;
  isUpdatingStatus: boolean;
  isExportingImage: boolean;
  isExportingExcel: boolean;
  onBack: () => void;
  onEdit: () => void;
  onConfirmOrder: () => void;
  onRequestWithdrawConfirmation: () => void;
  onConfirmShipment: () => void;
  onQuickReturn: () => void;
  onPrint: () => void;
  onExportImage: () => void;
  onExportExcel: () => void;
  onExportCompleteExcel: () => void;
  onDuplicate: () => void;
}

interface SalesOrderMetaProps {
  order: SalesOrderDetail;
}

const TRANSFER_MODE_BADGE_STYLES = {
  MIXED: 'border-sky-200 bg-sky-50 text-sky-700',
  SUPPLIER_ONLY: 'border-amber-200 bg-amber-50 text-amber-700',
} as const;

type TransferModeKey = keyof typeof TRANSFER_MODE_BADGE_STYLES;

const getOrderTypeBadge = (orderType: string) =>
  orderType === 'TRANSFER' ? (
    <Badge variant="secondary">{SALES_ORDER_TYPE_LABELS.TRANSFER}</Badge>
  ) : (
    <Badge variant="outline">{SALES_ORDER_TYPE_LABELS.NORMAL}</Badge>
  );

const getSampleBadge = (
  isSampleOrder: boolean | undefined,
  sampleSettlementType: 'FREE' | 'CHARGEABLE' | undefined
) =>
  isSampleOrder ? (
    <Badge
      variant="outline"
      className="border-amber-200 bg-amber-50 text-amber-700"
    >
      {SAMPLE_SETTLEMENT_TYPE_LABELS[sampleSettlementType ?? 'FREE']}
    </Badge>
  ) : null;

const getTransferModeBadge = (mode: string | undefined) => {
  if (!mode) {
    return null;
  }

  const resolvedMode: TransferModeKey =
    mode === 'MIXED' ? 'MIXED' : 'SUPPLIER_ONLY';
  const label =
    TRANSFER_MODE_LABELS[resolvedMode as keyof typeof TRANSFER_MODE_LABELS];

  return (
    <Badge
      variant="outline"
      className={TRANSFER_MODE_BADGE_STYLES[resolvedMode]}
    >
      {label}
    </Badge>
  );
};

function SalesOrderMeta({ order }: SalesOrderMetaProps) {
  return (
    <div className="flex items-center gap-5">
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-100/40 text-blue-600 transition-colors hover:bg-blue-100/60">
        <Truck className="h-7 w-7" />
      </div>
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
          销售订单
        </h1>
        <div className="mt-1.5 flex flex-wrap items-center gap-2.5">
          <span className="text-sm font-bold text-slate-500">
            {order.orderNumber}
          </span>
          <div className="h-3.5 w-px bg-slate-200" />
          <Badge
            variant={getSalesOrderStatusBadgeVariant(order.status)}
            className="rounded-lg px-2 py-0.5"
          >
            {SALES_ORDER_STATUS_LABELS[
              order.status as keyof typeof SALES_ORDER_STATUS_LABELS
            ] || order.status}
          </Badge>
          {getSampleBadge(order.isSampleOrder, order.sampleSettlementType)}
          {getOrderTypeBadge(order.orderType)}
          {order.orderType === 'TRANSFER' &&
            getTransferModeBadge(order.transferMode)}
        </div>
      </div>
    </div>
  );
}

function HeaderActions({
  canEditOrder,
  canConfirmOrder,
  canQuickReturn,
  isDraft,
  isConfirmed,
  withdrawConfirmationDisabledReason,
  isUpdatingStatus,
  isExportingImage,
  isExportingExcel,
  onBack,
  onEdit,
  onConfirmOrder,
  onRequestWithdrawConfirmation,
  onConfirmShipment,
  onQuickReturn,
  onPrint,
  onExportImage,
  onExportExcel,
  onExportCompleteExcel,
  onDuplicate,
}: HeaderActionsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
      <Button
        variant="outline"
        size="sm"
        onClick={onBack}
        className="h-8 px-3 text-xs sm:h-9 sm:px-4"
      >
        <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
        返回
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={onEdit}
        title={!canEditOrder ? '只有草稿订单支持直接编辑' : undefined}
        className="h-8 px-3 text-xs sm:h-9 sm:px-4"
      >
        <Edit className="mr-1.5 h-3.5 w-3.5" />
        编辑
      </Button>
      {isDraft && (
        <Button
          variant="default"
          size="sm"
          onClick={onConfirmOrder}
          disabled={!canConfirmOrder || isUpdatingStatus}
          className="h-8 bg-[hsl(var(--color-primary))] px-3 text-xs text-[hsl(var(--color-text-on-primary))] hover:bg-[hsl(var(--color-primary-hover))] disabled:bg-[hsl(var(--color-primary))] disabled:text-[hsl(var(--color-text-on-primary))] disabled:opacity-60 sm:h-9 sm:px-4"
        >
          <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
          {isUpdatingStatus ? '处理中...' : '确认订单'}
        </Button>
      )}
      {isConfirmed && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRequestWithdrawConfirmation}
          disabled={isUpdatingStatus}
          title={withdrawConfirmationDisabledReason}
          className="h-8 px-3 text-xs sm:h-9 sm:px-4"
        >
          <Undo2 className="mr-1.5 h-3.5 w-3.5" />
          {isUpdatingStatus ? '处理中...' : '撤回确认'}
        </Button>
      )}
      {isConfirmed && (
        <Button
          variant="default"
          size="sm"
          onClick={onConfirmShipment}
          disabled={isUpdatingStatus}
          className="h-8 bg-[hsl(var(--color-primary))] px-3 text-xs text-[hsl(var(--color-text-on-primary))] hover:bg-[hsl(var(--color-primary-hover))] disabled:bg-[hsl(var(--color-primary))] disabled:text-[hsl(var(--color-text-on-primary))] disabled:opacity-60 sm:h-9 sm:px-4"
        >
          <Truck className="mr-1.5 h-3.5 w-3.5" />
          {isUpdatingStatus ? '处理中...' : '确认发货'}
        </Button>
      )}
      {canQuickReturn && (
        <Button
          variant="outline"
          size="sm"
          onClick={onQuickReturn}
          className="h-8 px-3 text-xs sm:h-9 sm:px-4"
        >
          <PackageX className="mr-1.5 h-3.5 w-3.5" />
          快速退货
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            disabled={isExportingImage || isExportingExcel}
            className="h-8 px-2 sm:h-9"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-56 rounded-xl border-slate-100 shadow-xl"
        >
          <DropdownMenuItem onClick={onPrint} className="cursor-pointer py-2.5">
            <Printer className="mr-3 h-4 w-4 text-slate-500" />
            <span className="font-semibold text-slate-700">打印订单单据</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={onExportImage}
            disabled={isExportingImage}
            className="cursor-pointer py-2.5"
          >
            <Download className="mr-3 h-4 w-4 text-slate-500" />
            <span className="font-semibold text-slate-700">
              {isExportingImage ? '正在生成报表...' : '导出为专业图片'}
            </span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={onExportExcel}
            disabled={isExportingExcel}
            className="cursor-pointer py-2.5"
          >
            <Download className="mr-3 h-4 w-4 text-slate-500" />
            <span className="font-semibold text-slate-700">
              {isExportingExcel ? '正在生成Excel...' : '导出经营数据报表'}
            </span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={onExportCompleteExcel}
            disabled={isExportingExcel}
            className="cursor-pointer py-2.5"
          >
            <Download className="mr-3 h-4 w-4 text-slate-500" />
            <span className="font-semibold text-slate-700">
              导出完整业务明细
            </span>
          </DropdownMenuItem>
          <div className="my-1.5 h-px bg-slate-100" />
          <DropdownMenuItem
            onClick={onDuplicate}
            className="cursor-pointer py-2.5 font-bold text-blue-600 focus:bg-blue-50 focus:text-blue-700"
          >
            复制并创建新订单
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function HeaderCard({
  order,
  id,
  returnTo,
  canEditOrder,
  canConfirmOrder,
  canQuickReturn,
  withdrawConfirmationDisabledReason,
  isUpdatingStatus,
  onConfirmOrder,
  onWithdrawConfirmation,
  onConfirmShipment,
  onShowToast,
}: Props) {
  const router = useRouter();
  const {
    exportToImage,
    exportToExcel,
    exportToCompleteExcel,
    isExportingImage,
    isExportingExcel,
  } = useSalesOrderExport();

  const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false);
  const [isWithdrawConfirmOpen, setIsWithdrawConfirmOpen] = useState(false);

  const handleExportImage = useCallback(async () => {
    await exportToImage({
      orderId: order.id,
      orderNumber: order.orderNumber || '',
      backgroundColor: '#ffffff',
      scale: 2,
    });
  }, [order, exportToImage]);

  const handleExportExcel = useCallback(
    () => exportToExcel(order),
    [order, exportToExcel]
  );

  const handleExportCompleteExcel = useCallback(
    () => exportToCompleteExcel(order),
    [order, exportToCompleteExcel]
  );

  const handleEdit = useCallback(() => {
    if (canEditOrder) {
      router.push(withReturnTo(`/sales-orders/${id}/edit`, returnTo));
      return;
    }

    onShowToast(
      '无法编辑',
      '只有草稿状态的订单才能直接编辑，如需调整请先撤回确认或复制新订单。',
      'destructive'
    );
  }, [canEditOrder, id, onShowToast, returnTo, router]);

  const handleDuplicateOrder = useCallback(() => {
    router.push(
      withReturnTo(`/sales-orders/create?copyFrom=${order.id}`, returnTo)
    );
  }, [order.id, returnTo, router]);

  const handlePrint = useCallback(() => {
    setIsPrintDialogOpen(true);
  }, []);

  const handleQuickReturn = useCallback(() => {
    const currentPath =
      getCurrentPathWithSearch() ?? withReturnTo(`/sales-orders/${id}`, returnTo);

    router.push(
      buildQuickReturnPath(order.id, {
        customerId: order.customerId,
        returnTo: currentPath,
      })
    );
  }, [id, order.customerId, order.id, returnTo, router]);

  const handleRequestWithdrawConfirmation = useCallback(() => {
    if (withdrawConfirmationDisabledReason) {
      onShowToast(
        '暂不能撤回确认',
        withdrawConfirmationDisabledReason,
        'destructive'
      );
      return;
    }

    setIsWithdrawConfirmOpen(true);
  }, [onShowToast, withdrawConfirmationDisabledReason]);

  return (
    <Card className="overflow-hidden rounded-2xl border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
      <CardContent className="bg-white p-6 sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <SalesOrderMeta order={order} />
          <div className="h-px w-full bg-slate-100 lg:hidden" />
          <HeaderActions
            canEditOrder={canEditOrder}
            canConfirmOrder={canConfirmOrder}
            canQuickReturn={canQuickReturn}
            isDraft={order.status === 'draft'}
            isConfirmed={order.status === 'confirmed'}
            withdrawConfirmationDisabledReason={
              withdrawConfirmationDisabledReason
            }
            isUpdatingStatus={isUpdatingStatus}
            isExportingImage={isExportingImage}
            isExportingExcel={isExportingExcel}
            onBack={() => router.push(returnTo ?? '/sales-orders')}
            onEdit={handleEdit}
            onConfirmOrder={onConfirmOrder}
            onRequestWithdrawConfirmation={handleRequestWithdrawConfirmation}
            onConfirmShipment={onConfirmShipment}
            onQuickReturn={handleQuickReturn}
            onPrint={handlePrint}
            onExportImage={handleExportImage}
            onExportExcel={handleExportExcel}
            onExportCompleteExcel={handleExportCompleteExcel}
            onDuplicate={handleDuplicateOrder}
          />
        </div>
      </CardContent>
      {isPrintDialogOpen && (
        <PrintTemplatePreviewDialog
          open={isPrintDialogOpen}
          onOpenChange={setIsPrintDialogOpen}
          templateType="sales-order"
          documentId={id}
          title="销售订单打印"
        />
      )}
      <AlertDialog
        open={isWithdrawConfirmOpen}
        onOpenChange={setIsWithdrawConfirmOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-50">
                <AlertCircle className="h-5 w-5 text-amber-600" />
              </div>
              <AlertDialogTitle>确认撤回为草稿</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="pt-4 text-sm leading-6 text-slate-600">
              撤回后，订单会回到
              <strong>草稿</strong>
              状态，可重新修改后再确认。
              <br />
              这张订单预留的库存会恢复，相关待收记录也会一并关闭。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>暂不撤回</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setIsWithdrawConfirmOpen(false);
                onWithdrawConfirmation();
              }}
            >
              确认撤回
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
