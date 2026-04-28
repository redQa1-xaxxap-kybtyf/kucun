'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  Anchor,
  ArrowLeft,
  Calendar,
  Edit,
  Package,
  Printer,
  Ship,
  Truck,
  User,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { useState } from 'react';

import { useBreadcrumbTitle } from '@/components/common/BreadcrumbContext';
import { ContentLoading } from '@/components/common/loading';
import { ConfirmArrivalDialog } from '@/components/factory-shipments/confirm-arrival-dialog';
import { ConfirmShipmentDialog } from '@/components/factory-shipments/confirm-shipment-dialog';
import { FeeItemsSection } from '@/components/factory-shipments/fee-items-section';
import { SupplementShippingInfoDialog } from '@/components/factory-shipments/supplement-shipping-info-dialog';
import { ChineseYuan } from '@/components/icons/chinese-yuan';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getFactoryShipmentOrder } from '@/lib/api/factory-shipments';
import { queryKeys } from '@/lib/queryKeys';
import {
  FACTORY_SHIPMENT_STATUS_LABELS,
  type FactoryShipmentOrder,
} from '@/lib/types/factory-shipment';
import { formatCostPrice } from '@/lib/utils/cost-price';
import {
  canConfirmArrival,
  canConfirmShipment,
  formatAmount,
  formatDate,
  getFactoryShipmentStatusBadgeVariant,
} from '@/lib/utils/factory-shipment-helpers';
import { toPieceOrSheetLabel } from '@/lib/utils/inventory-unit-conversion';

const PrintTemplatePreviewDialog = dynamic(
  () =>
    import(
      '@/components/print-designer/renderer/PrintTemplatePreviewDialog'
    ).then(mod => mod.PrintTemplatePreviewDialog),
  { ssr: false, loading: () => null }
);

interface FactoryShipmentOrderDetailProps {
  orderId: string;
  onEdit?: () => void;
  onBack?: () => void;
}

/**
 * 厂家发货订单详情组件
 * 客户直发场景：所有货物归属客户
 */
export function FactoryShipmentOrderDetail({
  orderId,
  onEdit,
  onBack,
}: FactoryShipmentOrderDetailProps) {
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [arrivalDialogOpen, setArrivalDialogOpen] = useState(false);
  const [supplementDialogOpen, setSupplementDialogOpen] = useState(false);
  const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const handleOrderRefresh = () => {
    queryClient.invalidateQueries({
      queryKey: queryKeys.factoryShipments.detail(orderId),
    });
    queryClient.invalidateQueries({
      queryKey: queryKeys.factoryShipments.lists(),
    });
  };

  // 查询订单详情 - 使用真实API
  const {
    data: order,
    isLoading,
    error,
  } = useQuery<FactoryShipmentOrder>({
    queryKey: queryKeys.factoryShipments.detail(orderId),
    queryFn: () => getFactoryShipmentOrder(orderId),
    enabled: !!orderId,
  });

  // 设置动态面包屑标题：显示发货单号
  useBreadcrumbTitle(order ? `发货单 ${order.orderNumber}` : null);

  if (isLoading) {
    return <ContentLoading text="加载订单详情中..." />;
  }

  if (error || !order) {
    return (
      <Card className="overflow-hidden rounded-md border border-[hsl(var(--color-border-primary))] shadow-sm">
        <CardContent className="bg-[hsl(var(--color-error-light))] pt-6">
          <div className="text-center text-[hsl(var(--color-error))]">
            {error ? '加载订单详情失败' : '订单不存在'}
          </div>
        </CardContent>
      </Card>
    );
  }

  // 客户直发场景：所有货物归属客户
  const customerOwnedAmount =
    order.fulfillmentSummary?.customerOwnedAmount ??
    order.items?.reduce((sum, item) => sum + (item.totalPrice ?? 0), 0) ??
    0;
  const payableAmount = Math.max(
    0,
    (order.costAmount ?? 0) - (order.depositAmount ?? 0)
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* 页面标题和操作 */}
      <Card className="border-border overflow-hidden rounded-md border shadow-sm">
        <CardContent className="bg-card p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3 sm:gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={onBack}
                className="hover:bg-white/50"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                返回列表
              </Button>
              <Separator orientation="vertical" className="h-8" />
              <div>
                <h1 className="text-lg font-bold tracking-tight text-[hsl(var(--color-text-primary))] sm:text-xl">
                  厂家发货订单详情
                </h1>
                <div className="mt-1 flex items-center gap-2">
                  <p className="text-[10px] text-[hsl(var(--color-text-secondary))] sm:text-xs">
                    订单编号：{order.orderNumber}
                  </p>
                  <Badge
                    variant={getFactoryShipmentStatusBadgeVariant(order.status)}
                    className="text-xs"
                  >
                    {FACTORY_SHIPMENT_STATUS_LABELS[order.status]}
                  </Badge>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap justify-start gap-2 sm:justify-end">
              {canConfirmShipment(order.status) && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setConfirmDialogOpen(true)}
                  className="shadow-[var(--shadow-light)]"
                >
                  <Ship className="mr-2 h-3.5 w-3.5" />
                  确认发货
                </Button>
              )}
              {canConfirmArrival(order.status) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setArrivalDialogOpen(true)}
                  disabled={!order.containerNumber}
                  className="bg-white/50"
                >
                  <Anchor className="mr-2 h-3.5 w-3.5" />
                  确认到港
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsPrintDialogOpen(true)}
                className="bg-white/50"
              >
                <Printer className="mr-2 h-3.5 w-3.5" />
                打印
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onEdit}
                className="bg-white/50"
              >
                <Edit className="mr-2 h-3.5 w-3.5" />
                编辑
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 补充船公司信息提醒 */}
      {order.status === 'shipped' &&
        order.containerNumber &&
        !order.shippingCompany && (
          <Alert
            variant="default"
            className="border-yellow-500 bg-yellow-50 py-2 dark:bg-yellow-950"
          >
            <AlertCircle className="h-4 w-4 text-yellow-600" />
            <AlertTitle className="text-sm text-yellow-900 dark:text-yellow-100">
              需要补充船公司信息
            </AlertTitle>
            <AlertDescription className="flex items-center justify-between">
              <p className="text-xs text-yellow-800 dark:text-yellow-200">
                补充后可继续跟踪运输状态
              </p>
              <Button
                size="sm"
                variant="outline"
                className="h-7 border-yellow-600 text-xs text-yellow-700 hover:bg-yellow-100"
                onClick={() => setSupplementDialogOpen(true)}
              >
                <Ship className="mr-2 h-3 w-3" />
                补充信息
              </Button>
            </AlertDescription>
          </Alert>
        )}

      {/* 合并基本信息和客户信息 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* 基本信息 */}
        <Card className="rounded-md border border-[hsl(var(--color-border-primary))] shadow-sm">
          <CardHeader className="border-b border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-secondary))] py-3">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Truck className="h-4 w-4 text-[hsl(var(--color-primary))]" />
              基本信息
            </CardTitle>
          </CardHeader>
          <CardContent className="bg-[hsl(var(--color-bg-card))] p-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
                  订单编号
                </label>
                <p className="text-sm font-medium text-[hsl(var(--color-text-primary))]">
                  {order.orderNumber}
                </p>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
                  集装箱号码
                </label>
                <p className="text-sm font-medium text-[hsl(var(--color-text-primary))]">
                  {order.containerNumber || (
                    <span className="text-[hsl(var(--color-text-tertiary))]">
                      待填写
                    </span>
                  )}
                </p>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
                  创建时间
                </label>
                <p className="flex items-center gap-1.5 text-sm font-medium text-[hsl(var(--color-text-primary))]">
                  <Calendar className="h-3 w-3 text-[hsl(var(--color-text-tertiary))]" />
                  {formatDate(order.createdAt)}
                </p>
              </div>

              {order.shipmentDate && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
                    实际发货日期
                  </label>
                  <p className="flex items-center gap-1.5 text-sm font-medium text-[hsl(var(--color-text-primary))]">
                    <Calendar className="h-3 w-3 text-[hsl(var(--color-text-tertiary))]" />
                    {formatDate(order.shipmentDate)}
                  </p>
                </div>
              )}

              {order.arrivalDate && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
                    到港日期
                  </label>
                  <p className="flex items-center gap-1.5 text-sm font-medium text-[hsl(var(--color-text-primary))]">
                    <Calendar className="h-3 w-3 text-[hsl(var(--color-text-tertiary))]" />
                    {formatDate(order.arrivalDate)}
                  </p>
                </div>
              )}

              {order.shippingCompany && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
                    船运公司
                  </label>
                  <p className="text-sm font-medium text-[hsl(var(--color-text-primary))]">
                    {order.shippingCompany}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 客户信息 */}
        <Card className="rounded-md border border-[hsl(var(--color-border-primary))] shadow-sm">
          <CardHeader className="border-b border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-secondary))] py-3">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <User className="h-4 w-4 text-[hsl(var(--color-primary))]" />
              客户信息
            </CardTitle>
          </CardHeader>
          <CardContent className="bg-[hsl(var(--color-bg-card))] p-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
                  客户名称
                </label>
                <p className="text-sm font-medium text-[hsl(var(--color-text-primary))]">
                  {order.customer?.name || '-'}
                </p>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
                  联系电话
                </label>
                <p className="text-sm font-medium text-[hsl(var(--color-text-primary))]">
                  {order.customer?.phone || '-'}
                </p>
              </div>
              <div className="col-span-2 space-y-1">
                <label className="text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
                  客户地址
                </label>
                <p className="text-sm font-medium text-[hsl(var(--color-text-primary))]">
                  {order.customer?.address || '-'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 费用明细 */}
      <FeeItemsSection feeItems={order.feeItems} />

      {/* 金额信息 */}
      <Card className="rounded-md border border-[hsl(var(--color-border-primary))] shadow-sm">
        <CardHeader className="border-b border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-secondary))] py-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <ChineseYuan className="h-4 w-4 text-[hsl(var(--color-primary))]" />
            金额信息
          </CardTitle>
        </CardHeader>
        <CardContent className="bg-[hsl(var(--color-bg-card))] p-4">
          {/* 主要金额指标 - 使用渐变卡片突出显示 */}
          <div className="mb-4 rounded-lg border bg-[hsl(var(--color-bg-card))] p-4">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <div className="space-y-1">
                <p className="text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
                  订单总金额
                </p>
                <p className="text-lg font-bold text-[hsl(var(--color-text-primary))]">
                  {formatAmount(order.totalAmount)}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
                  应收金额
                </p>
                <p className="text-lg font-bold text-[hsl(var(--color-primary))]">
                  {formatAmount(order.receivableAmount)}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
                  应付金额（成本）
                </p>
                <p className="text-xl font-bold text-amber-600">
                  {formatAmount(payableAmount)}
                </p>
                {order.depositAmount > 0 && (
                  <p className="text-xs text-[hsl(var(--color-success))]">
                    已付定金 {formatAmount(order.depositAmount)}
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
                  利润金额
                </p>
                <p
                  className={`text-xl font-bold ${
                    (order.profitAmount || 0) >= 0
                      ? 'text-emerald-600'
                      : 'text-red-600'
                  }`}
                >
                  {formatAmount(order.profitAmount || 0)}
                </p>
                <p className="text-xs text-[hsl(var(--color-text-tertiary))]">
                  利润率:{' '}
                  {order.receivableAmount > 0
                    ? (
                        ((order.profitAmount || 0) / order.receivableAmount) *
                        100
                      ).toFixed(2)
                    : '0.00'}
                  %
                </p>
              </div>
            </div>
          </div>

          {/* 次要金额指标 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
                货物总金额
              </label>
              <p className="text-base font-semibold text-[hsl(var(--color-primary))]">
                {formatAmount(customerOwnedAmount)}
              </p>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
                定金金额
              </label>
              <p className="text-base font-semibold text-emerald-600">
                {formatAmount(order.depositAmount)}
              </p>
            </div>
          </div>

          {order.remarks && (
            <>
              <Separator className="my-4" />
              <div className="space-y-1">
                <label className="text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
                  备注
                </label>
                <p className="text-sm text-[hsl(var(--color-text-primary))]">
                  {order.remarks}
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* 产品明细 */}
      <Card className="rounded-md border border-[hsl(var(--color-border-primary))] shadow-sm">
        <CardHeader className="border-b border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-secondary))] py-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Package className="h-4 w-4 text-[hsl(var(--color-primary))]" />
              产品明细
            </CardTitle>
            <Badge variant="outline" className="text-xs">
              共 {order.items?.length || 0} 项
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="bg-[hsl(var(--color-bg-card))] p-0">
          <div className="overflow-x-auto">
            <div className="min-w-[1200px]">
              <Table>
                <TableHeader className="bg-[hsl(var(--color-bg-table-header))]">
                  <TableRow className="border-b border-[hsl(var(--color-border-primary))]">
                    <TableHead className="w-[50px]">序号</TableHead>
                    <TableHead className="min-w-[180px]">产品名称</TableHead>
                    <TableHead className="min-w-[120px]">供应商</TableHead>
                    <TableHead className="min-w-[120px]">规格</TableHead>
                    <TableHead className="min-w-[120px]">批次</TableHead>
                    <TableHead className="w-[120px]">数量</TableHead>
                    <TableHead className="w-[80px]">单位</TableHead>
                    <TableHead className="w-[110px] text-right">
                      装箱数
                    </TableHead>
                    <TableHead className="w-[110px] text-right">
                      进货价
                    </TableHead>
                    <TableHead className="w-[110px] text-right">
                      销售价
                    </TableHead>
                    <TableHead className="w-[120px] text-right">小计</TableHead>
                    <TableHead className="w-[120px] text-right">利润</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.items?.map((item, index) => (
                    <TableRow
                      key={item.id ?? index}
                      className="border-b border-[hsl(var(--color-border-primary))] transition-colors hover:bg-[hsl(var(--color-primary-light))/50]"
                    >
                      <TableCell className="py-3 text-center text-sm text-[hsl(var(--color-text-tertiary))]">
                        {index + 1}
                      </TableCell>
                      <TableCell className="py-3 text-sm font-medium text-[hsl(var(--color-text-primary))]">
                        {item.displayName}
                      </TableCell>
                      <TableCell className="py-3 text-sm text-[hsl(var(--color-text-secondary))]">
                        {item.supplier?.name || '-'}
                      </TableCell>
                      <TableCell className="py-3 text-sm text-[hsl(var(--color-text-secondary))]">
                        {item.specification || '-'}
                      </TableCell>
                      <TableCell className="py-3 text-sm text-[hsl(var(--color-text-secondary))]">
                        {item.batchNumber || '-'}
                      </TableCell>
                      <TableCell className="py-3 text-left text-sm font-medium whitespace-nowrap text-[hsl(var(--color-text-primary))]">
                        {(() => {
                          const qty = Math.floor(item.quantity || 0);
                          const unit = toPieceOrSheetLabel(item.unit);
                          const ppu = item.piecesPerUnit || 0;
                          if (unit === '件') {
                            return ppu > 1
                              ? `${qty}件（共${qty * ppu}片）`
                              : `${qty}片`;
                          }
                          if (unit === '片') {
                            if (ppu > 1) {
                              const units = Math.floor(qty / ppu);
                              const pieces = qty % ppu;
                              if (units === 0) return `${pieces}片`;
                              if (pieces === 0)
                                return `${units}件（共${qty}片）`;
                              return `${units}件${pieces}片（共${qty}片）`;
                            }
                            return `${qty}片`;
                          }
                          return `${qty}${unit}`;
                        })()}
                      </TableCell>
                      <TableCell className="py-3 text-sm text-[hsl(var(--color-text-secondary))]">
                        {toPieceOrSheetLabel(item.unit)}
                      </TableCell>
                      <TableCell className="py-3 text-right text-sm text-[hsl(var(--color-text-secondary))]">
                        {item.piecesPerUnit ?? '-'}
                      </TableCell>
                      <TableCell className="py-3 text-right text-sm text-[hsl(var(--color-text-secondary))]">
                        {formatCostPrice(item.unitCost || 0)}
                      </TableCell>
                      <TableCell className="py-3 text-right text-sm font-medium text-[hsl(var(--color-text-primary))]">
                        {formatAmount(item.unitPrice)}
                      </TableCell>
                      <TableCell className="py-3 text-right text-sm font-semibold text-[hsl(var(--color-text-primary))]">
                        {formatAmount(item.quantity * item.unitPrice)}
                      </TableCell>
                      <TableCell
                        className={`py-2 text-right text-sm font-semibold ${
                          (item.profitAmount || 0) >= 0
                            ? 'text-emerald-600'
                            : 'text-red-600'
                        }`}
                      >
                        {formatAmount(
                          item.profitAmount ||
                            (item.unitPrice - (item.unitCost || 0)) *
                              item.quantity
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {order.items && order.items.length > 0 && (
                    <TableRow className="border-t border-[hsl(var(--color-border-primary))] bg-slate-50">
                      <TableCell
                        colSpan={11}
                        className="py-3 text-right text-sm font-semibold text-[hsl(var(--color-text-primary))]"
                      >
                        合计金额：
                      </TableCell>
                      <TableCell className="py-3 text-right text-base font-bold text-[hsl(var(--color-primary))]">
                        {formatAmount(order.totalAmount)}
                      </TableCell>
                      <TableCell
                        className={`py-3 text-right text-base font-bold ${
                          (order.profitAmount || 0) >= 0
                            ? 'text-emerald-600'
                            : 'text-red-600'
                        }`}
                      >
                        {formatAmount(order.profitAmount || 0)}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 确认发货对话框 */}
      <ConfirmShipmentDialog
        orderId={orderId}
        orderNumber={order.orderNumber}
        containerNumber={order.containerNumber}
        shippingCompany={order.shippingCompany}
        open={confirmDialogOpen}
        onOpenChange={setConfirmDialogOpen}
        onSuccess={handleOrderRefresh}
      />

      <ConfirmArrivalDialog
        orderId={orderId}
        orderNumber={order.orderNumber}
        containerNumber={order.containerNumber}
        open={arrivalDialogOpen}
        onOpenChange={setArrivalDialogOpen}
        onSuccess={handleOrderRefresh}
      />

      <SupplementShippingInfoDialog
        orderId={orderId}
        orderNumber={order.orderNumber}
        containerNumber={order.containerNumber || ''}
        open={supplementDialogOpen}
        onOpenChange={setSupplementDialogOpen}
        onSuccess={handleOrderRefresh}
      />

      {isPrintDialogOpen && (
        <PrintTemplatePreviewDialog
          open={isPrintDialogOpen}
          onOpenChange={setIsPrintDialogOpen}
          templateType="factory-shipment"
          documentId={orderId}
          title="厂家发货单打印"
        />
      )}
    </div>
  );
}
