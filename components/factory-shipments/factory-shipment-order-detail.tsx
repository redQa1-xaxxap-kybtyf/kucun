'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  Anchor,
  ArrowLeft,
  Calendar,
  Edit,
  Package,
  PackageCheck,
  Ship,
  Truck,
  User,
} from 'lucide-react';
import { useState } from 'react';

import { ContentLoading } from '@/components/common/loading';
import { ConfirmArrivalDialog } from '@/components/factory-shipments/confirm-arrival-dialog';
import { ConfirmInboundDialog } from '@/components/factory-shipments/confirm-inbound-dialog';
import { ConfirmShipmentDialog } from '@/components/factory-shipments/confirm-shipment-dialog';
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
import {
  factoryShipmentQueryKeys,
  getFactoryShipmentOrder,
} from '@/lib/api/factory-shipments';
import {
  FACTORY_SHIPMENT_ITEM_OWNERSHIP,
  FACTORY_SHIPMENT_STATUS_LABELS,
  type FactoryShipmentItemOwnership,
  type FactoryShipmentOrder,
} from '@/lib/types/factory-shipment';
import {
  canConfirmArrival,
  canConfirmInbound,
  canConfirmShipment,
  FACTORY_SHIPMENT_OWNERSHIP_LABELS,
  formatAmount,
  formatDate,
  formatOwnershipStatus,
  formatUnit,
  getFactoryShipmentStatusBadgeVariant,
} from '@/lib/utils/factory-shipment-helpers';

interface FactoryShipmentOrderDetailProps {
  orderId: string;
  onEdit?: () => void;
  onBack?: () => void;
}

/**
 * 厂家发货订单详情组件
 * 改进后的版本，符合ERP风格，添加确认发货功能
 */
export function FactoryShipmentOrderDetail({
  orderId,
  onEdit,
  onBack,
}: FactoryShipmentOrderDetailProps) {
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [arrivalDialogOpen, setArrivalDialogOpen] = useState(false);
  const [inboundDialogOpen, setInboundDialogOpen] = useState(false);
  const [supplementDialogOpen, setSupplementDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const handleOrderRefresh = () => {
    queryClient.invalidateQueries({
      queryKey: factoryShipmentQueryKeys.detail(orderId),
    });
    queryClient.invalidateQueries({
      queryKey: factoryShipmentQueryKeys.lists(),
    });
  };

  // 查询订单详情 - 使用真实API
  const {
    data: order,
    isLoading,
    error,
  } = useQuery<FactoryShipmentOrder>({
    queryKey: factoryShipmentQueryKeys.detail(orderId),
    queryFn: () => getFactoryShipmentOrder(orderId),
    enabled: !!orderId,
  });

  if (isLoading) {
    return <ContentLoading text="加载订单详情中..." />;
  }

  if (error || !order) {
    return (
      <Card
        className="overflow-hidden border border-[hsl(var(--color-border-primary))]"
        style={{ boxShadow: 'var(--shadow-light)' }}
      >
        <CardContent className="bg-[hsl(var(--color-error-light))] pt-6">
          <div className="text-center text-[hsl(var(--color-error))]">
            {error ? '加载订单详情失败' : '订单不存在'}
          </div>
        </CardContent>
      </Card>
    );
  }

  const customerOwnedAmount =
    order.fulfillmentSummary?.customerOwnedAmount ??
    order.items
      ?.filter(
        item => item.ownership === FACTORY_SHIPMENT_ITEM_OWNERSHIP.CUSTOMER
      )
      .reduce((sum, item) => sum + (item.totalPrice ?? 0), 0) ??
    0;
  const selfOwnedAmount =
    order.fulfillmentSummary?.selfOwnedAmount ??
    order.items
      ?.filter(item => item.ownership === FACTORY_SHIPMENT_ITEM_OWNERSHIP.SELF)
      .reduce((sum, item) => sum + item.totalPrice, 0) ??
    0;
  const hasPendingSelfInbound =
    order.items?.some(
      item =>
        item.ownership === FACTORY_SHIPMENT_ITEM_OWNERSHIP.SELF &&
        item.selfInboundStatus !== 'received'
    ) ?? false;

  return (
    <div className="space-y-6">
      {/* 页面标题和操作 */}
      <Card className="overflow-hidden shadow-[var(--shadow-medium)]">
        <CardContent className="bg-gradient-to-r from-[hsl(var(--color-primary-light))] to-[hsl(var(--color-primary-lighter))] p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
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
                <h1 className="text-2xl font-bold tracking-tight text-[hsl(var(--color-text-primary))]">
                  厂家发货订单详情
                </h1>
                <div className="mt-1 flex items-center gap-2">
                  <p className="text-sm text-[hsl(var(--color-text-secondary))]">
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
            <div className="flex flex-wrap gap-2">
              {canConfirmShipment(order.status) && (
                <Button
                  variant="default"
                  onClick={() => setConfirmDialogOpen(true)}
                  className="shadow-[var(--shadow-light)]"
                >
                  <Ship className="mr-2 h-4 w-4" />
                  确认发货
                </Button>
              )}
              {canConfirmArrival(order.status) && (
                <Button
                  variant="outline"
                  onClick={() => setArrivalDialogOpen(true)}
                  disabled={!order.containerNumber}
                  className="bg-white/50"
                >
                  <Anchor className="mr-2 h-4 w-4" />
                  确认到港
                </Button>
              )}
              {canConfirmInbound(order.status, hasPendingSelfInbound) && (
                <Button
                  variant="default"
                  onClick={() => setInboundDialogOpen(true)}
                  className="shadow-[var(--shadow-light)]"
                >
                  <PackageCheck className="mr-2 h-4 w-4" />
                  确认入库
                </Button>
              )}
              <Button
                variant="outline"
                onClick={onEdit}
                className="bg-white/50"
              >
                <Edit className="mr-2 h-4 w-4" />
                编辑订单
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
            className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950"
          >
            <AlertCircle className="h-4 w-4 text-yellow-600" />
            <AlertTitle className="text-yellow-900 dark:text-yellow-100">
              需要补充船公司信息
            </AlertTitle>
            <AlertDescription className="space-y-2">
              <p className="text-yellow-800 dark:text-yellow-200">
                请向货运公司询问船公司名称,以便追踪货物运输状态
              </p>
              <div className="mt-2 flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="border-yellow-600 text-yellow-700 hover:bg-yellow-100"
                  onClick={() => setSupplementDialogOpen(true)}
                >
                  <Ship className="mr-2 h-4 w-4" />
                  补充船公司信息
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

      {/* 基本信息 */}
      <Card
        className="border border-[hsl(var(--color-border-primary))]"
        style={{ boxShadow: 'var(--shadow-medium)' }}
      >
        <CardHeader className="border-b border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-secondary))]">
          <CardTitle className="flex items-center gap-2 text-base">
            <Truck className="h-5 w-5 text-[hsl(var(--color-primary))]" />
            基本信息
          </CardTitle>
        </CardHeader>
        <CardContent className="bg-[hsl(var(--color-bg-card))] pt-6">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <label className="text-xs font-medium tracking-wide text-[hsl(var(--color-text-tertiary))] uppercase">
                订单编号
              </label>
              <p className="text-sm font-medium text-[hsl(var(--color-text-primary))]">
                {order.orderNumber}
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium tracking-wide text-[hsl(var(--color-text-tertiary))] uppercase">
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
            <div className="space-y-2">
              <label className="text-xs font-medium tracking-wide text-[hsl(var(--color-text-tertiary))] uppercase">
                创建时间
              </label>
              <p className="flex items-center gap-1.5 text-sm font-medium text-[hsl(var(--color-text-primary))]">
                <Calendar className="h-3.5 w-3.5 text-[hsl(var(--color-text-tertiary))]" />
                {formatDate(order.createdAt)}
              </p>
            </div>

            {order.shipmentDate && (
              <div className="space-y-2">
                <label className="text-xs font-medium tracking-wide text-[hsl(var(--color-text-tertiary))] uppercase">
                  实际发货日期
                </label>
                <p className="flex items-center gap-1.5 text-sm font-medium text-[hsl(var(--color-text-primary))]">
                  <Calendar className="h-3.5 w-3.5 text-[hsl(var(--color-text-tertiary))]" />
                  {formatDate(order.shipmentDate)}
                </p>
              </div>
            )}

            {order.arrivalDate && (
              <div className="space-y-2">
                <label className="text-xs font-medium tracking-wide text-[hsl(var(--color-text-tertiary))] uppercase">
                  到港日期
                </label>
                <p className="flex items-center gap-1.5 text-sm font-medium text-[hsl(var(--color-text-primary))]">
                  <Calendar className="h-3.5 w-3.5 text-[hsl(var(--color-text-tertiary))]" />
                  {formatDate(order.arrivalDate)}
                </p>
              </div>
            )}

            {order.shippingCompany && (
              <div className="space-y-2">
                <label className="text-xs font-medium tracking-wide text-[hsl(var(--color-text-tertiary))] uppercase">
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
      <Card
        className="border border-[hsl(var(--color-border-primary))]"
        style={{ boxShadow: 'var(--shadow-medium)' }}
      >
        <CardHeader className="border-b border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-secondary))]">
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-5 w-5 text-[hsl(var(--color-primary))]" />
            客户信息
          </CardTitle>
        </CardHeader>
        <CardContent className="bg-[hsl(var(--color-bg-card))] pt-6">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-medium tracking-wide text-[hsl(var(--color-text-tertiary))] uppercase">
                客户名称
              </label>
              <p className="text-sm font-medium text-[hsl(var(--color-text-primary))]">
                {order.customer?.name || '-'}
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium tracking-wide text-[hsl(var(--color-text-tertiary))] uppercase">
                联系电话
              </label>
              <p className="text-sm font-medium text-[hsl(var(--color-text-primary))]">
                {order.customer?.phone || '-'}
              </p>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <label className="text-xs font-medium tracking-wide text-[hsl(var(--color-text-tertiary))] uppercase">
                客户地址
              </label>
              <p className="text-sm font-medium text-[hsl(var(--color-text-primary))]">
                {order.customer?.address || '-'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 金额信息 */}
      <Card
        className="border border-[hsl(var(--color-border-primary))]"
        style={{ boxShadow: 'var(--shadow-medium)' }}
      >
        <CardHeader className="border-b border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-secondary))]">
          <CardTitle className="flex items-center gap-2 text-base">
            <ChineseYuan className="h-5 w-5 text-[hsl(var(--color-primary))]" />
            金额信息
          </CardTitle>
        </CardHeader>
        <CardContent className="bg-[hsl(var(--color-bg-card))] pt-6">
          {/* 主要金额指标 - 使用渐变卡片突出显示 */}
          <div className="mb-6 rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 p-6 shadow-inner">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <p className="text-xs font-medium tracking-wide text-[hsl(var(--color-text-tertiary))] uppercase">
                  订单总金额
                </p>
                <p className="text-2xl font-bold text-[hsl(var(--color-text-primary))]">
                  {formatAmount(order.totalAmount)}
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium tracking-wide text-[hsl(var(--color-text-tertiary))] uppercase">
                  应收金额
                </p>
                <p className="text-2xl font-bold text-blue-700">
                  {formatAmount(order.receivableAmount)}
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium tracking-wide text-[hsl(var(--color-text-tertiary))] uppercase">
                  应付金额（成本）
                </p>
                <p className="text-2xl font-bold text-amber-600">
                  {formatAmount(order.costAmount || 0)}
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium tracking-wide text-[hsl(var(--color-text-tertiary))] uppercase">
                  利润金额
                </p>
                <p
                  className={`text-2xl font-bold ${
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
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <label className="text-xs font-medium tracking-wide text-[hsl(var(--color-text-tertiary))] uppercase">
                客户货金额
              </label>
              <p className="text-lg font-semibold text-[hsl(var(--color-primary))]">
                {formatAmount(customerOwnedAmount)}
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium tracking-wide text-[hsl(var(--color-text-tertiary))] uppercase">
                自用补货金额
              </label>
              <p className="text-lg font-semibold text-[hsl(var(--color-text-secondary))]">
                {formatAmount(selfOwnedAmount)}
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium tracking-wide text-[hsl(var(--color-text-tertiary))] uppercase">
                定金金额
              </label>
              <p className="text-lg font-semibold text-emerald-600">
                {formatAmount(order.depositAmount)}
              </p>
            </div>
          </div>

          {order.remarks && (
            <>
              <Separator className="my-6" />
              <div className="space-y-2">
                <label className="text-xs font-medium tracking-wide text-[hsl(var(--color-text-tertiary))] uppercase">
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
      <Card
        className="border border-[hsl(var(--color-border-primary))]"
        style={{ boxShadow: 'var(--shadow-medium)' }}
      >
        <CardHeader className="border-b border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-secondary))]">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Package className="h-5 w-5 text-[hsl(var(--color-primary))]" />
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
                  <TableRow className="border-b-2 border-[hsl(var(--color-border-primary))]">
                    <TableHead className="w-[60px] text-xs font-semibold">
                      序号
                    </TableHead>
                    <TableHead className="min-w-[180px] text-xs font-semibold">
                      产品名称
                    </TableHead>
                    <TableHead className="min-w-[120px] text-xs font-semibold">
                      供应商
                    </TableHead>
                    <TableHead className="w-[100px] text-xs font-semibold">
                      归属
                    </TableHead>
                    <TableHead className="w-[120px] text-xs font-semibold">
                      履约状态
                    </TableHead>
                    <TableHead className="min-w-[120px] text-xs font-semibold">
                      规格
                    </TableHead>
                    <TableHead className="min-w-[120px] text-xs font-semibold">
                      批次
                    </TableHead>
                    <TableHead className="w-[100px] text-right text-xs font-semibold">
                      数量
                    </TableHead>
                    <TableHead className="w-[80px] text-xs font-semibold">
                      单位
                    </TableHead>
                    <TableHead className="w-[110px] text-right text-xs font-semibold">
                      每件片数
                    </TableHead>
                    <TableHead className="w-[110px] text-right text-xs font-semibold">
                      进货价
                    </TableHead>
                    <TableHead className="w-[110px] text-right text-xs font-semibold">
                      销售价
                    </TableHead>
                    <TableHead className="w-[120px] text-right text-xs font-semibold">
                      小计
                    </TableHead>
                    <TableHead className="w-[120px] text-right text-xs font-semibold">
                      利润
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.items?.map((item, index) => {
                    const ownership =
                      (item.ownership as FactoryShipmentItemOwnership) ??
                      FACTORY_SHIPMENT_ITEM_OWNERSHIP.CUSTOMER;
                    const ownershipStatus = formatOwnershipStatus(item);
                    // 使用 ownership 映射到对应的 badge variant
                    const ownershipBadgeVariant =
                      ownership === FACTORY_SHIPMENT_ITEM_OWNERSHIP.CUSTOMER
                        ? 'default'
                        : 'secondary';
                    const ownershipLabel =
                      FACTORY_SHIPMENT_OWNERSHIP_LABELS[ownership];
                    return (
                      <TableRow
                        key={item.id ?? index}
                        className="border-b border-[hsl(var(--color-border-primary))] transition-colors hover:bg-[hsl(var(--color-primary-light))/50]"
                      >
                        <TableCell className="py-4 text-center text-sm text-[hsl(var(--color-text-tertiary))]">
                          {index + 1}
                        </TableCell>
                        <TableCell className="py-4 text-sm font-medium text-[hsl(var(--color-text-primary))]">
                          {item.displayName}
                        </TableCell>
                        <TableCell className="py-4 text-sm text-[hsl(var(--color-text-secondary))]">
                          {item.supplier?.name || '-'}
                        </TableCell>
                        <TableCell className="py-4">
                          <Badge
                            variant={ownershipBadgeVariant}
                            className="text-xs font-medium"
                          >
                            {ownershipLabel}
                          </Badge>
                          {item.ownershipRemarks && (
                            <p className="mt-1 text-xs text-[hsl(var(--color-text-tertiary))]">
                              {item.ownershipRemarks}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="py-4">
                          <Badge
                            variant={ownershipStatus.variant}
                            className="text-xs font-medium"
                          >
                            {ownershipStatus.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-4 text-sm text-[hsl(var(--color-text-secondary))]">
                          {item.specification || '-'}
                        </TableCell>
                        <TableCell className="py-4 text-sm text-[hsl(var(--color-text-secondary))]">
                          {item.batchNumber || '-'}
                        </TableCell>
                        <TableCell className="py-4 text-right text-sm font-medium text-[hsl(var(--color-text-primary))]">
                          {item.quantity}
                        </TableCell>
                        <TableCell className="py-4 text-sm text-[hsl(var(--color-text-secondary))]">
                          {formatUnit(item.unit)}
                        </TableCell>
                        <TableCell className="py-4 text-right text-sm text-[hsl(var(--color-text-secondary))]">
                          {item.piecesPerUnit ?? '-'}
                        </TableCell>
                        <TableCell className="py-4 text-right text-sm text-[hsl(var(--color-text-secondary))]">
                          {formatAmount(item.unitCost || 0)}
                        </TableCell>
                        <TableCell className="py-4 text-right text-sm font-medium text-[hsl(var(--color-text-primary))]">
                          {formatAmount(item.unitPrice)}
                        </TableCell>
                        <TableCell className="py-4 text-right text-sm font-semibold text-[hsl(var(--color-text-primary))]">
                          {formatAmount(item.quantity * item.unitPrice)}
                        </TableCell>
                        <TableCell
                          className={`py-4 text-right text-sm font-semibold ${
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
                    );
                  })}
                  {order.items && order.items.length > 0 && (
                    <TableRow className="border-t-2 border-[hsl(var(--color-border-primary))] bg-gradient-to-r from-blue-50 to-indigo-50">
                      <TableCell
                        colSpan={11}
                        className="py-4 text-right text-sm font-semibold text-[hsl(var(--color-text-primary))]"
                      >
                        合计金额：
                      </TableCell>
                      <TableCell className="py-4 text-right text-base font-bold text-blue-700">
                        {formatAmount(order.totalAmount)}
                      </TableCell>
                      <TableCell
                        className={`py-4 text-right text-base font-bold ${
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

      <ConfirmInboundDialog
        orderId={orderId}
        orderNumber={order.orderNumber}
        items={order.items}
        open={inboundDialogOpen}
        onOpenChange={setInboundDialogOpen}
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
    </div>
  );
}
