'use client';

import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import {
  ArrowLeft,
  Calendar,
  DollarSign,
  Edit,
  Package,
  Ship,
  Truck,
  User,
} from 'lucide-react';
import { useState } from 'react';

import { ContentLoading } from '@/components/common/loading';
import { ConfirmShipmentDialog } from '@/components/factory-shipments/confirm-shipment-dialog';
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
  FACTORY_SHIPMENT_STATUS_LABELS,
  type FactoryShipmentOrder,
  type FactoryShipmentStatus,
} from '@/lib/types/factory-shipment';
import { getFactoryShipmentStatusBadgeVariant } from '@/lib/utils/badge-helpers';

interface FactoryShipmentOrderDetailProps {
  orderId: string;
  onEdit?: () => void;
  onBack?: () => void;
}

// 获取状态徽章样式 - 与列表页面保持一致
const getStatusBadgeVariant = (
  status: FactoryShipmentStatus
):
  | 'default'
  | 'secondary'
  | 'destructive'
  | 'outline'
  | 'success'
  | 'warning'
  | 'info' => {
  switch (status) {
    case 'draft':
      return 'secondary';
    case 'planning':
    case 'factory_shipped':
    case 'in_transit':
      return 'info';
    case 'waiting_deposit':
      return 'warning';
    case 'deposit_paid':
    case 'arrived':
    case 'delivered':
    case 'completed':
      return 'success';
    default:
      return 'secondary';
  }
};

// 格式化金额
const formatAmount = (amount: number): string =>
  `¥${amount.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

// 格式化日期
const formatDate = (date: Date | string): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return format(dateObj, 'yyyy-MM-dd', { locale: zhCN });
};

// 单位中英文映射
const UNIT_MAP: Record<string, string> = {
  piece: '件',
  box: '箱',
  pcs: '个',
  kg: '千克',
  g: '克',
  ton: '吨',
  m: '米',
  cm: '厘米',
  mm: '毫米',
  sqm: '平方米',
  cbm: '立方米',
  set: '套',
  pair: '对',
  dozen: '打',
  pack: '包',
  bag: '袋',
  bottle: '瓶',
  can: '罐',
  roll: '卷',
  sheet: '张',
};

// 格式化单位 - 将英文单位转换为中文
const formatUnit = (unit: string): string =>
  UNIT_MAP[unit.toLowerCase()] || unit;

// 判断是否可以确认发货
const canConfirmShipment = (status: FactoryShipmentStatus): boolean =>
  ['draft', 'planning', 'waiting_deposit', 'deposit_paid'].includes(status);

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
          <Button variant="outline" onClick={onEdit}>
            <Edit className="mr-2 h-4 w-4" />
            编辑订单
          </Button>
        </div>
      </div>

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
              <p className="mt-1 text-sm text-[hsl(var(--color-text-primary))]">{order.orderNumber}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-[hsl(var(--color-text-tertiary))]">
                集装箱号码
              </label>
              <p className="mt-1 text-sm text-[hsl(var(--color-text-primary))]">
                {order.containerNumber || (
                  <span className="text-[hsl(var(--color-text-tertiary))]">待填写</span>
                )}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-[hsl(var(--color-text-tertiary))]">
                订单状态
              </label>
              <div className="mt-1">
                <Badge variant={getStatusBadgeVariant(order.status)} className="text-xs font-medium">
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
            {order.planDate && (
              <div>
                <label className="text-sm font-medium text-[hsl(var(--color-text-tertiary))]">
                  计划发货日期
                </label>
                <p className="mt-1 flex items-center gap-1 text-sm text-[hsl(var(--color-text-primary))]">
                  <Calendar className="h-3 w-3" />
                  {formatDate(order.planDate)}
                </p>
              </div>
            )}
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
            <DollarSign className="h-5 w-5" />
            金额信息
          </CardTitle>
        </CardHeader>
        <CardContent className="bg-[hsl(var(--color-bg-card))]">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
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
                <p className="mt-1 text-sm text-[hsl(var(--color-text-primary))]">{order.remarks}</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* 商品明细 */}
      <Card
        className="border border-[hsl(var(--color-border-primary))]"
        style={{ boxShadow: 'var(--shadow-medium)' }}
      >
        <CardHeader className="border-b border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-secondary))]">
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            商品明细
          </CardTitle>
        </CardHeader>
        <CardContent className="bg-[hsl(var(--color-bg-card))]">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader
                className="bg-[hsl(var(--color-bg-table-header))]"
                style={{ boxShadow: 'var(--shadow-light)' }}
              >
                <TableRow className="bg-[hsl(var(--color-bg-table-header))]">
                  <TableHead className="font-semibold text-[hsl(var(--color-text-secondary))]">序号</TableHead>
                  <TableHead className="font-semibold text-[hsl(var(--color-text-secondary))]">商品名称</TableHead>
                  <TableHead className="font-semibold text-[hsl(var(--color-text-secondary))]">供应商</TableHead>
                  <TableHead className="font-semibold text-[hsl(var(--color-text-secondary))]">规格</TableHead>
                  <TableHead className="text-right font-semibold text-[hsl(var(--color-text-secondary))]">
                    数量
                  </TableHead>
                  <TableHead className="font-semibold text-[hsl(var(--color-text-secondary))]">单位</TableHead>
                  <TableHead className="text-right font-semibold text-[hsl(var(--color-text-secondary))]">
                    单价
                  </TableHead>
                  <TableHead className="text-right font-semibold text-[hsl(var(--color-text-secondary))]">
                    小计
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.items?.map((item, index) => (
                  <TableRow
                    key={index}
                    className="border-b border-[hsl(var(--color-border-primary))] transition-colors hover:bg-[hsl(var(--color-primary-light))]"
                  >
                    <TableCell className="text-[hsl(var(--color-text-secondary))]">{index + 1}</TableCell>
                    <TableCell className="font-medium text-[hsl(var(--color-text-primary))]">
                      {item.displayName}
                    </TableCell>
                    <TableCell className="text-[hsl(var(--color-text-secondary))]">
                      {item.supplier?.name || '-'}
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
                ))}
                {order.items && order.items.length > 0 && (
                  <TableRow className="border-t-2 border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-table-header))] font-semibold">
                    <TableCell colSpan={7} className="text-right text-[hsl(var(--color-text-primary))]">
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
        open={confirmDialogOpen}
        onOpenChange={setConfirmDialogOpen}
      />
    </div>
  );
}
