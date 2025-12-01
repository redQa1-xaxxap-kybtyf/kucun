'use client';

import {
  ArrowLeft,
  Download,
  Edit,
  MoreHorizontal,
  Printer,
  Truck,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';

import { PrintPreviewDialog } from '@/components/print/PrintPreviewDialog';
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
import { salesOrderPrintConfig } from '@/lib/config/print-fields/sales-order-fields';
import {
  SALES_ORDER_STATUS_LABELS,
  TRANSFER_MODE_LABELS,
} from '@/lib/types/sales-order';
import { getSalesOrderStatusBadgeVariant } from '@/lib/utils/badge-helpers';

import { SalesOrderPrintContent } from './SalesOrderPrintContent';
import type { SalesOrderDetail } from './types';

interface Props {
  order: SalesOrderDetail;
  id: string;
  canEditOrder: boolean;
  isUpdatingStatus: boolean;
  onConfirmShipment: () => void;
  onShowToast: (
    title: string,
    description: string,
    variant?: 'destructive' | 'default'
  ) => void;
}

interface HeaderActionsProps {
  canEditOrder: boolean;
  isConfirmed: boolean;
  isUpdatingStatus: boolean;
  isExportingImage: boolean;
  isExportingExcel: boolean;
  onBack: () => void;
  onEdit: () => void;
  onConfirmShipment: () => void;
  onPrint: () => void;
  onExportImage: () => void;
  onExportExcel: () => void;
  onExportCompleteExcel: () => void;
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
    <Badge variant="secondary">调货销售</Badge>
  ) : (
    <Badge variant="outline">正常销售</Badge>
  );

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
    <div className="flex items-center gap-4">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[hsl(var(--color-primary))] shadow-lg">
        {/* Icon space kept for visual parity */}
        <Truck className="h-6 w-6 text-white" />
      </div>
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[hsl(var(--color-text-primary))]">
          销售订单详情
        </h1>
        <div className="mt-1 flex items-center gap-2 text-sm text-[hsl(var(--color-text-secondary))]">
          <span className="font-medium">订单号：{order.orderNumber}</span>
          <Badge variant={getSalesOrderStatusBadgeVariant(order.status)}>
            {SALES_ORDER_STATUS_LABELS[
              order.status as keyof typeof SALES_ORDER_STATUS_LABELS
            ] || order.status}
          </Badge>
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
  isConfirmed,
  isUpdatingStatus,
  isExportingImage,
  isExportingExcel,
  onBack,
  onEdit,
  onConfirmShipment,
  onPrint,
  onExportImage,
  onExportExcel,
  onExportCompleteExcel,
}: HeaderActionsProps) {
  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="lg" onClick={onBack} className="h-11">
        <ArrowLeft className="mr-2 h-4 w-4" />
        返回
      </Button>
      <Button
        variant="outline"
        size="lg"
        onClick={onEdit}
        disabled={!canEditOrder}
      >
        <Edit className="mr-2 h-4 w-4" />
        编辑
      </Button>
      {isConfirmed && (
        <Button
          variant="default"
          size="lg"
          onClick={onConfirmShipment}
          disabled={isUpdatingStatus}
          className="bg-[hsl(var(--color-primary))] text-[hsl(var(--color-text-on-primary))] hover:bg-[hsl(var(--color-primary-hover))] disabled:bg-[hsl(var(--color-primary))] disabled:text-[hsl(var(--color-text-on-primary))] disabled:opacity-60"
        >
          <Truck className="mr-2 h-4 w-4" />
          {isUpdatingStatus ? '处理中...' : '确认发货'}
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="lg"
            disabled={isExportingImage || isExportingExcel}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onPrint}>
            <Printer className="mr-2 h-4 w-4" />
            打印订单
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onExportImage} disabled={isExportingImage}>
            <Download className="mr-2 h-4 w-4" />
            {isExportingImage ? '生成图片中...' : '导出为图片'}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onExportExcel} disabled={isExportingExcel}>
            <Download className="mr-2 h-4 w-4" />
            {isExportingExcel ? '生成Excel中...' : '导出Excel'}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={onExportCompleteExcel}
            disabled={isExportingExcel}
          >
            <Download className="mr-2 h-4 w-4" />
            {isExportingExcel ? '生成Excel中...' : '导出完整Excel'}
          </DropdownMenuItem>
          <DropdownMenuItem>复制订单</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function HeaderCard({
  order,
  id,
  canEditOrder,
  isUpdatingStatus,
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

  const handleExportImage = useCallback(async () => {
    const printTemplate = document.getElementById('sales-order-print-template');

    if (!printTemplate) {
      onShowToast('导出失败', '打印模板未加载', 'destructive');
      return;
    }

    await exportToImage(printTemplate, {
      orderId: order.id,
      orderNumber: order.orderNumber || '',
      backgroundColor: '#ffffff',
      scale: 2,
    });
  }, [order, exportToImage, onShowToast]);

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
      router.push(`/sales-orders/${id}/edit`);
      return;
    }

    onShowToast('无法编辑', '只有草稿状态的订单才能编辑', 'destructive');
  }, [canEditOrder, id, onShowToast, router]);

  const handlePrint = useCallback(() => {
    setIsPrintDialogOpen(true);
  }, []);

  return (
    <Card
      className="overflow-hidden border border-[hsl(var(--color-border-primary))]"
      style={{ boxShadow: 'var(--shadow-medium)' }}
    >
      <CardContent className="bg-gradient-to-r from-[hsl(var(--color-primary-light))] to-[hsl(var(--color-primary-lighter))] p-6">
        <div className="flex items-center justify-between">
          <SalesOrderMeta order={order} />
          <HeaderActions
            canEditOrder={canEditOrder}
            isConfirmed={order.status === 'confirmed'}
            isUpdatingStatus={isUpdatingStatus}
            isExportingImage={isExportingImage}
            isExportingExcel={isExportingExcel}
            onBack={() => router.back()}
            onEdit={handleEdit}
            onConfirmShipment={onConfirmShipment}
            onPrint={handlePrint}
            onExportImage={handleExportImage}
            onExportExcel={handleExportExcel}
            onExportCompleteExcel={handleExportCompleteExcel}
          />
        </div>
      </CardContent>
      {isPrintDialogOpen && (
        <PrintPreviewDialog
          open={isPrintDialogOpen}
          onClose={() => setIsPrintDialogOpen(false)}
          documentType="sales-order"
          printConfig={salesOrderPrintConfig}
          renderContent={(styleConfig, fieldSelection) => (
            <SalesOrderPrintContent
              order={order}
              styleConfig={styleConfig}
              fieldSelection={fieldSelection}
            />
          )}
          title="销售订单打印"
        />
      )}
    </Card>
  );
}
