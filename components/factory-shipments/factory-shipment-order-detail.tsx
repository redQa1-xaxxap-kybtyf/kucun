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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回列表
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-[hsl(var(--color-text-primary))]">
              厂家发货订单详情
            </h1>
            <p className="mt-1 text-sm text-[hsl(var(--color-text-secondary))]">
              订单编号：{order.orderNumber}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {canConfirmShipment(order.status) && (
            <Button
              variant="default"
              onClick={() => setConfirmDialogOpen(true)}
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
            >
              <Anchor className="mr-2 h-4 w-4" />
              确认到港
            </Button>
          )}
          {canConfirmInbound(order.status, hasPendingSelfInbound) && (
            <Button
              variant="default"
              onClick={() => setInboundDialogOpen(true)}
            >
              <PackageCheck className="mr-2 h-4 w-4" />
              确认入库
            </Button>
          )}
          <Button variant="outline" onClick={onEdit}>
            <Edit className="mr-2 h-4 w-4" />
            编辑订单
          </Button>
        </div>
      </div>

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
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            基本信息
          </CardTitle>
        </CardHeader>
        <CardContent className="bg-[hsl(var(--color-bg-card))]">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="text-sm font-medium text-[hsl(var(--color-text-tertiary))]">
                订单编号
              </label>
              <p className="mt-1 text-sm text-[hsl(var(--color-text-primary))]">
                {order.orderNumber}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-[hsl(var(--color-text-tertiary))]">
                集装箱号码
              </label>
              <p className="mt-1 text-sm text-[hsl(var(--color-text-primary))]">
                {order.containerNumber || (
                  <span className="text-[hsl(var(--color-text-tertiary))]">
                    待填写
                  </span>
                )}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-[hsl(var(--color-text-tertiary))]">
                订单状态
              </label>
              <div className="mt-1">
                <Badge
                  variant={getFactoryShipmentStatusBadgeVariant(order.status)}
                  className="text-xs font-medium"
                >
                  {FACTORY_SHIPMENT_STATUS_LABELS[order.status]}
                </Badge>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-[hsl(var(--color-text-tertiary))]">
                创建时间
              </label>
              <p className="mt-1 flex items-center gap-1 text-sm text-[hsl(var(--color-text-primary))]">
                <Calendar className="h-3 w-3" />
                {formatDate(order.createdAt)}
              </p>
            </div>

            {order.shipmentDate && (
              <div>
                <label className="text-sm font-medium text-[hsl(var(--color-text-tertiary))]">
                  实际发货日期
                </label>
                <p className="mt-1 flex items-center gap-1 text-sm text-[hsl(var(--color-text-primary))]">
                  <Calendar className="h-3 w-3" />
                  {formatDate(order.shipmentDate)}
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
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            客户信息
          </CardTitle>
        </CardHeader>
        <CardContent className="bg-[hsl(var(--color-bg-card))]">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-[hsl(var(--color-text-tertiary))]">
                客户名称
              </label>
              <p className="mt-1 text-sm text-[hsl(var(--color-text-primary))]">
                {order.customer?.name || '-'}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-[hsl(var(--color-text-tertiary))]">
                联系电话
              </label>
              <p className="mt-1 text-sm text-[hsl(var(--color-text-primary))]">
                {order.customer?.phone || '-'}
              </p>
            </div>
            <div className="sm:col-span-2">
              <label className="text-sm font-medium text-[hsl(var(--color-text-tertiary))]">
                客户地址
              </label>
              <p className="mt-1 text-sm text-[hsl(var(--color-text-primary))]">
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
          <CardTitle className="flex items-center gap-2">
            <ChineseYuan className="h-5 w-5" />
            金额信息
          </CardTitle>
        </CardHeader>
        <CardContent className="bg-[hsl(var(--color-bg-card))]">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <label className="text-sm font-medium text-[hsl(var(--color-text-tertiary))]">
                订单总金额
              </label>
              <p className="mt-1 text-lg font-semibold text-[hsl(var(--color-text-primary))]">
                {formatAmount(order.totalAmount)}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-[hsl(var(--color-text-tertiary))]">
                客户货金额
              </label>
              <p className="mt-1 text-lg font-semibold text-[hsl(var(--color-primary))]">
                {formatAmount(customerOwnedAmount)}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-[hsl(var(--color-text-tertiary))]">
                自用补货金额
              </label>
              <p className="mt-1 text-lg font-semibold text-[hsl(var(--color-text-secondary))]">
                {formatAmount(selfOwnedAmount)}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-[hsl(var(--color-text-tertiary))]">
                应收金额
              </label>
              <p className="mt-1 text-lg font-semibold text-[hsl(var(--color-primary))]">
                {formatAmount(order.receivableAmount)}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-[hsl(var(--color-text-tertiary))]">
                定金金额
              </label>
              <p className="mt-1 text-lg font-semibold text-[hsl(var(--color-success))]">
                {formatAmount(order.depositAmount)}
              </p>
            </div>
          </div>
          {order.remarks && (
            <>
              <Separator className="my-4" />
              <div>
                <label className="text-sm font-medium text-[hsl(var(--color-text-tertiary))]">
                  备注
                </label>
                <p className="mt-1 text-sm text-[hsl(var(--color-text-primary))]">
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
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            产品明细
          </CardTitle>
        </CardHeader>
        <CardContent className="bg-[hsl(var(--color-bg-card))]">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader style={{ boxShadow: 'var(--shadow-light)' }}>
                <TableRow>
                  <TableHead>序号</TableHead>
                  <TableHead>产品名称</TableHead>
                  <TableHead>供应商</TableHead>
                  <TableHead>归属</TableHead>
                  <TableHead>履约状态</TableHead>
                  <TableHead>规格</TableHead>
                  <TableHead className="text-right">数量</TableHead>
                  <TableHead>单位</TableHead>
                  <TableHead className="text-right">单价</TableHead>
                  <TableHead className="text-right">小计</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.items?.map((item, index) => {
                  const ownership =
                    (item.ownership as FactoryShipmentItemOwnership) ??
                    FACTORY_SHIPMENT_ITEM_OWNERSHIP.CUSTOMER;
                  const ownershipStatus = formatOwnershipStatus(item);
                  const ownershipBadgeVariant =
                    getFactoryShipmentStatusBadgeVariant(ownership as any);
                  const ownershipLabel =
                    FACTORY_SHIPMENT_OWNERSHIP_LABELS[ownership];
                  return (
                    <TableRow
                      key={item.id ?? index}
                      className="border-b border-[hsl(var(--color-border-primary))] transition-colors hover:bg-[hsl(var(--color-primary-light))]"
                    >
                      <TableCell className="text-[hsl(var(--color-text-secondary))]">
                        {index + 1}
                      </TableCell>
                      <TableCell className="font-medium text-[hsl(var(--color-text-primary))]">
                        {item.displayName}
                      </TableCell>
                      <TableCell className="text-[hsl(var(--color-text-secondary))]">
                        {item.supplier?.name || '-'}
                      </TableCell>
                      <TableCell>
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
                      <TableCell>
                        <Badge
                          variant={ownershipStatus.variant}
                          className="text-xs font-medium"
                        >
                          {ownershipStatus.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-[hsl(var(--color-text-secondary))]">
                        {item.specification || '-'}
                      </TableCell>
                      <TableCell className="text-right text-[hsl(var(--color-text-primary))]">
                        {item.quantity}
                      </TableCell>
                      <TableCell className="text-[hsl(var(--color-text-secondary))]">
                        {formatUnit(item.unit)}
                      </TableCell>
                      <TableCell className="text-right text-[hsl(var(--color-text-primary))]">
                        {formatAmount(item.unitPrice)}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-[hsl(var(--color-text-primary))]">
                        {formatAmount(item.quantity * item.unitPrice)}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {order.items && order.items.length > 0 && (
                  <TableRow className="border-t-2 border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-table-header))] font-semibold">
                    <TableCell
                      colSpan={9}
                      className="text-right text-[hsl(var(--color-text-primary))]"
                    >
                      合计金额：
                    </TableCell>
                    <TableCell className="text-right text-lg text-[hsl(var(--color-primary))]">
                      {formatAmount(order.totalAmount)}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* 确认发货对话框 */}
      <ConfirmShipmentDialog
        orderId={orderId}
        orderNumber={order.orderNumber}
        containerNumber={order.containerNumber}
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
