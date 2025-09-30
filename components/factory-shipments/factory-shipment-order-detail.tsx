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
  FACTORY_SHIPMENT_STATUS_LABELS,
  type FactoryShipmentOrder,
  type FactoryShipmentStatus,
} from '@/lib/types/factory-shipment';

interface FactoryShipmentOrderDetailProps {
  orderId: string;
  onEdit?: () => void;
  onBack?: () => void;
}

// 模拟API调用 - 后续替换为真实API
const getFactoryShipmentOrder = async (
  _id: string
): Promise<FactoryShipmentOrder | null> =>
  // TODO: 实现真实API调用
  null;

// 获取状态徽章样式 - 与列表页面保持一致
const getStatusBadgeVariant = (
  status: FactoryShipmentStatus
): 'default' | 'secondary' | 'destructive' | 'outline' => {
  switch (status) {
    case 'draft':
      return 'secondary';
    case 'planning':
      return 'outline';
    case 'waiting_deposit':
      return 'destructive';
    case 'deposit_paid':
    case 'factory_shipped':
    case 'in_transit':
    case 'arrived':
    case 'delivered':
    case 'completed':
      return 'default';
    default:
      return 'secondary';
  }
};

// 格式化金额
const formatAmount = (amount: number): string => `¥${amount.toLocaleString('zh-CN', {
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
const formatUnit = (unit: string): string => UNIT_MAP[unit.toLowerCase()] || unit;

// 判断是否可以确认发货
const canConfirmShipment = (status: FactoryShipmentStatus): boolean => ['draft', 'planning', 'waiting_deposit', 'deposit_paid'].includes(
    status
  );

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

  // 查询订单详情
  const {
    data: order,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['factory-shipment-order', orderId],
    queryFn: () => getFactoryShipmentOrder(orderId),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-red-600">
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
            <h1 className="text-2xl font-bold text-gray-900">
              厂家发货订单详情
            </h1>
            <p className="mt-1 text-sm text-gray-600">
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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            基本信息
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="text-sm font-medium text-gray-500">
                订单编号
              </label>
              <p className="mt-1 text-sm text-gray-900">{order.orderNumber}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">
                集装箱号码
              </label>
              <p className="mt-1 text-sm text-gray-900">
                {order.containerNumber || (
                  <span className="text-gray-400">待填写</span>
                )}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">
                订单状态
              </label>
              <div className="mt-1">
                <Badge variant={getStatusBadgeVariant(order.status)}>
                  {FACTORY_SHIPMENT_STATUS_LABELS[order.status]}
                </Badge>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">
                创建时间
              </label>
              <p className="mt-1 flex items-center gap-1 text-sm text-gray-900">
                <Calendar className="h-3 w-3" />
                {formatDate(order.createdAt)}
              </p>
            </div>
            {order.planDate && (
              <div>
                <label className="text-sm font-medium text-gray-500">
                  计划发货日期
                </label>
                <p className="mt-1 flex items-center gap-1 text-sm text-gray-900">
                  <Calendar className="h-3 w-3" />
                  {formatDate(order.planDate)}
                </p>
              </div>
            )}
            {order.shipmentDate && (
              <div>
                <label className="text-sm font-medium text-gray-500">
                  实际发货日期
                </label>
                <p className="mt-1 flex items-center gap-1 text-sm text-gray-900">
                  <Calendar className="h-3 w-3" />
                  {formatDate(order.shipmentDate)}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 客户信息 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            客户信息
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-gray-500">
                客户名称
              </label>
              <p className="mt-1 text-sm text-gray-900">
                {order.customer?.name || '-'}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">
                联系电话
              </label>
              <p className="mt-1 text-sm text-gray-900">
                {order.customer?.phone || '-'}
              </p>
            </div>
            <div className="sm:col-span-2">
              <label className="text-sm font-medium text-gray-500">
                客户地址
              </label>
              <p className="mt-1 text-sm text-gray-900">
                {order.customer?.address || '-'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 金额信息 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            金额信息
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            <div>
              <label className="text-sm font-medium text-gray-500">
                订单总金额
              </label>
              <p className="mt-1 text-lg font-semibold text-gray-900">
                {formatAmount(order.totalAmount)}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">
                应收金额
              </label>
              <p className="mt-1 text-lg font-semibold text-blue-600">
                {formatAmount(order.receivableAmount)}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">
                定金金额
              </label>
              <p className="mt-1 text-lg font-semibold text-green-600">
                {formatAmount(order.depositAmount)}
              </p>
            </div>
          </div>
          {order.remarks && (
            <>
              <Separator className="my-4" />
              <div>
                <label className="text-sm font-medium text-gray-500">
                  备注
                </label>
                <p className="mt-1 text-sm text-gray-900">{order.remarks}</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* 商品明细 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            商品明细
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="font-semibold">序号</TableHead>
                  <TableHead className="font-semibold">商品名称</TableHead>
                  <TableHead className="font-semibold">供应商</TableHead>
                  <TableHead className="font-semibold">规格</TableHead>
                  <TableHead className="text-right font-semibold">
                    数量
                  </TableHead>
                  <TableHead className="font-semibold">单位</TableHead>
                  <TableHead className="text-right font-semibold">
                    单价
                  </TableHead>
                  <TableHead className="text-right font-semibold">
                    小计
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.items?.map((item, index) => (
                  <TableRow key={index} className="hover:bg-gray-50">
                    <TableCell className="text-gray-600">{index + 1}</TableCell>
                    <TableCell className="font-medium text-gray-900">
                      {item.displayName}
                    </TableCell>
                    <TableCell className="text-gray-700">
                      {item.supplier?.name || '-'}
                    </TableCell>
                    <TableCell className="text-gray-700">
                      {item.specification || '-'}
                    </TableCell>
                    <TableCell className="text-right text-gray-900">
                      {item.quantity}
                    </TableCell>
                    <TableCell className="text-gray-700">
                      {formatUnit(item.unit)}
                    </TableCell>
                    <TableCell className="text-right text-gray-900">
                      {formatAmount(item.unitPrice)}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-gray-900">
                      {formatAmount(item.quantity * item.unitPrice)}
                    </TableCell>
                  </TableRow>
                ))}
                {order.items && order.items.length > 0 && (
                  <TableRow className="border-t-2 bg-gray-50 font-semibold">
                    <TableCell colSpan={7} className="text-right">
                      合计金额：
                    </TableCell>
                    <TableCell className="text-right text-lg text-blue-600">
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
