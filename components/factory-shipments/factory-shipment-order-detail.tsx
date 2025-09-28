'use client';

import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import {
  ArrowLeft,
  Calendar,
  DollarSign,
  Edit,
  MapPin,
  Package,
  Phone,
  Truck,
  User,
} from 'lucide-react';

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
  // 这里应该调用真实的API
  null;
export function FactoryShipmentOrderDetail({
  orderId: _orderId,
  onEdit,
  onBack,
}: FactoryShipmentOrderDetailProps) {
  // 查询订单详情
  const {
    data: order,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['factory-shipment-order', orderId],
    queryFn: () => getFactoryShipmentOrder(orderId),
  });

  // 获取状态徽章样式
  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'draft':
        return 'secondary';
      case 'planning':
        return 'outline';
      case 'waiting_deposit':
        return 'destructive';
      case 'deposit_paid':
        return 'default';
      case 'factory_shipped':
        return 'default';
      case 'in_transit':
        return 'default';
      case 'arrived':
        return 'default';
      case 'delivered':
        return 'default';
      case 'completed':
        return 'default';
      default:
        return 'secondary';
    }
  };

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
      <div className="flex items-center justify-between">
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
        <Button onClick={onEdit}>
          <Edit className="mr-2 h-4 w-4" />
          编辑订单
        </Button>
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
                {order.containerNumber}
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
                {format(new Date(order.createdAt), 'yyyy-MM-dd HH:mm', {
                  locale: zhCN,
                })}
              </p>
            </div>
            {order.planDate && (
              <div>
                <label className="text-sm font-medium text-gray-500">
                  计划发货日期
                </label>
                <p className="mt-1 flex items-center gap-1 text-sm text-gray-900">
                  <Calendar className="h-3 w-3" />
                  {format(new Date(order.planDate), 'yyyy-MM-dd', {
                    locale: zhCN,
                  })}
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
                  {format(new Date(order.shipmentDate), 'yyyy-MM-dd', {
                    locale: zhCN,
                  })}
                </p>
              </div>
            )}
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

      {/* 客户信息 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            客户信息
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-gray-500">
                客户名称
              </label>
              <p className="mt-1 text-sm text-gray-900">
                {order.customer.name}
              </p>
            </div>
            {order.customer.phone && (
              <div>
                <label className="text-sm font-medium text-gray-500">
                  联系电话
                </label>
                <p className="mt-1 flex items-center gap-1 text-sm text-gray-900">
                  <Phone className="h-3 w-3" />
                  {order.customer.phone}
                </p>
              </div>
            )}
            {order.customer.address && (
              <div className="sm:col-span-2">
                <label className="text-sm font-medium text-gray-500">
                  客户地址
                </label>
                <p className="mt-1 flex items-center gap-1 text-sm text-gray-900">
                  <MapPin className="h-3 w-3" />
                  {order.customer.address}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 商品明细 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            商品明细
            <Badge variant="outline">共 {order.items.length} 个商品</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>商品信息</TableHead>
                  <TableHead>供应商</TableHead>
                  <TableHead>规格</TableHead>
                  <TableHead>单位</TableHead>
                  <TableHead>数量</TableHead>
                  <TableHead>单价</TableHead>
                  <TableHead>小计</TableHead>
                  <TableHead>备注</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.items.map(item => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{item.displayName}</p>
                        {item.isManualProduct && (
                          <Badge variant="outline" className="mt-1 text-xs">
                            临时商品
                          </Badge>
                        )}
                        {item.product && (
                          <p className="text-xs text-gray-500">
                            编码: {item.product.code}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{item.supplier.name}</TableCell>
                    <TableCell>{item.specification || '-'}</TableCell>
                    <TableCell>{item.unit}</TableCell>
                    <TableCell>{item.quantity}</TableCell>
                    <TableCell>¥{item.unitPrice.toLocaleString()}</TableCell>
                    <TableCell>¥{item.totalPrice.toLocaleString()}</TableCell>
                    <TableCell>{item.remarks || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* 财务信息 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            财务信息
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="text-sm font-medium text-gray-500">
                订单总金额
              </label>
              <p className="mt-1 text-lg font-semibold text-gray-900">
                ¥{order.totalAmount.toLocaleString()}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">
                应收金额
              </label>
              <p className="mt-1 text-lg font-semibold text-blue-600">
                ¥{order.receivableAmount.toLocaleString()}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">
                定金金额
              </label>
              <p className="mt-1 text-lg font-semibold text-orange-600">
                ¥{order.depositAmount.toLocaleString()}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">
                已付金额
              </label>
              <p className="mt-1 text-lg font-semibold text-green-600">
                ¥{order.paidAmount.toLocaleString()}
              </p>
            </div>
          </div>

          {/* 付款进度 */}
          <Separator className="my-4" />
          <div>
            <label className="text-sm font-medium text-gray-500">
              付款进度
            </label>
            <div className="mt-2">
              <div className="flex justify-between text-sm">
                <span>已付款</span>
                <span>
                  {((order.paidAmount / order.receivableAmount) * 100).toFixed(
                    1
                  )}
                  %
                </span>
              </div>
              <div className="mt-1 h-2 w-full rounded-full bg-gray-200">
                <div
                  className="h-2 rounded-full bg-green-500"
                  style={{
                    width: `${Math.min((order.paidAmount / order.receivableAmount) * 100, 100)}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
