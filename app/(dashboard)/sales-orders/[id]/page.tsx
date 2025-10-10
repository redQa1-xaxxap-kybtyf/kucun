'use client';

import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Download,
  Edit,
  MoreHorizontal,
  Printer,
  ShoppingCart,
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';

import { ContentLoading } from '@/components/common/loading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ErrorMessage } from '@/components/ui/error-message';
import { Separator } from '@/components/ui/separator';
import { queryKeys } from '@/lib/queryKeys';
import { SALES_ORDER_STATUS_LABELS } from '@/lib/types/sales-order';
import { formatCurrency, formatDate } from '@/lib/utils';
import { getErrorMessage } from '@/lib/utils/error-handler';
import { getSalesOrderStatusBadgeVariant } from '@/lib/utils/badge-helpers';

interface SalesOrderDetail {
  id: string;
  orderNumber: string;
  customerId: string;
  userId: string;
  supplierId?: string;
  status: string;
  orderType: string;
  totalAmount: number;
  costAmount: number;
  profitAmount: number;
  remarks?: string;
  createdAt: string;
  updatedAt: string;
  customer: {
    id: string;
    name: string;
    phone?: string;
  };
  user: {
    id: string;
    name: string;
  };
  supplier?: {
    id: string;
    name: string;
  };
  items: Array<{
    id: string;
    productId: string;
    batchNumber?: string;
    colorCode?: string;
    productionDate?: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
    unitCost?: number;
    costSubtotal?: number;
    profitAmount?: number;
    isManualProduct: boolean;
    manualProductName?: string;
    manualSpecification?: string;
    manualWeight?: number;
    manualUnit?: string;
    piecesPerUnit?: number;
    remarks?: string;
    product?: {
      id: string;
      code: string;
      name: string;
      unit: string;
      specification?: string;
      piecesPerUnit?: number;
      weight?: number;
    };
  }>;
}

async function fetchSalesOrderDetail(id: string): Promise<SalesOrderDetail> {
  const response = await fetch(`/api/sales-orders/${id}`, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('获取销售订单详情失败');
  }

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || '获取销售订单详情失败');
  }

  return result.data;
}

function formatDecimal(value: number | undefined | null): string {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '-';
  }
  if (Number.isInteger(value)) {
    return value.toString();
  }
  return value.toFixed(4).replace(/(?:\.0+|(\.\d+?)0+)$/, '$1');
}

/**
 * 格式化数量显示，优先使用录入时的显示数量
 */
function formatQuantityDisplay(item: SalesOrderDetail['items'][0]): string {
  const value =
    typeof item.displayQuantity === 'number'
      ? item.displayQuantity
      : item.quantity;

  return formatDecimal(value);
}

function formatPiecesBreakdown(item: SalesOrderDetail['items'][0]): string | null {
  const quantity = item.quantity;
  const piecesPerUnit = item.piecesPerUnit ?? item.product?.piecesPerUnit;

  if (typeof quantity !== 'number' || Number.isNaN(quantity)) {
    return null;
  }

  if (!piecesPerUnit || piecesPerUnit <= 1) {
    // 如果没有件/片换算，则直接返回片数
    return `${formatDecimal(quantity)}片`;
  }

  const fullUnits = Math.floor(quantity / piecesPerUnit);
  const remainder = quantity % piecesPerUnit;

  if (remainder === 0) {
    return `${fullUnits}件`;
  }

  if (fullUnits === 0) {
    return `${remainder}片`;
  }

  return `${fullUnits}件${remainder}片`;
}

function resolveUnitLabel(item: SalesOrderDetail['items'][0]): string {
  if (typeof item.displayUnit === 'string' && item.displayUnit.trim()) {
    return item.displayUnit.trim();
  }

  if (item.isManualProduct && typeof item.manualUnit === 'string' && item.manualUnit.trim()) {
    return item.manualUnit.trim();
  }

  if (item.product?.unit) {
    return item.product.unit;
  }

  return '片';
}

export default function SalesOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const {
    data: order,
    isLoading,
    error,
  } = useQuery<SalesOrderDetail>({
    queryKey: queryKeys.salesOrders.detail(id),
    queryFn: () => fetchSalesOrderDetail(id),
    enabled: !!id,
  });

  if (isLoading) {
    return <ContentLoading />;
  }

  if (error) {
    return (
      <ErrorMessage
        title="加载失败"
        message={getErrorMessage(error)}
        onRetry={() => window.location.reload()}
      />
    );
  }

  if (!order) {
    return (
      <ErrorMessage
        title="订单不存在"
        message="未找到指定的销售订单"
        onRetry={() => router.push('/sales-orders')}
      />
    );
  }

  const getOrderTypeBadge = (orderType: string) =>
    orderType === 'TRANSFER' ? (
      <Badge variant="secondary">调货销售</Badge>
    ) : (
      <Badge variant="outline">正常销售</Badge>
    );

  const totalDisplayQuantity = order.items.reduce(
    (sum, item) =>
      sum +
      (typeof item.displayQuantity === 'number'
        ? item.displayQuantity
        : item.quantity || 0),
    0
  );

  return (
    <div className="flex h-full flex-col overflow-hidden p-6">
      <div className="space-y-6">
        {/* 页面标题卡片 */}
        <Card className="overflow-hidden shadow-lg shadow-gray-200/50">
          <CardContent className="bg-gradient-to-r from-slate-50 to-gray-50 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 shadow-lg shadow-blue-600/30">
                  <ShoppingCart className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                    销售订单详情
                  </h1>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <span>订单号：{order.orderNumber}</span>
                    <Badge variant={getSalesOrderStatusBadgeVariant(order.status)}>
                      {SALES_ORDER_STATUS_LABELS[
                        order.status as keyof typeof SALES_ORDER_STATUS_LABELS
                      ] || order.status}
                    </Badge>
                    {getOrderTypeBadge(order.orderType)}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => router.back()}
                  className="h-11 shadow-md transition-all hover:scale-105 hover:shadow-lg"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  返回
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="h-11 shadow-md transition-all hover:scale-105 hover:shadow-lg"
                >
                  <Printer className="mr-2 h-4 w-4" />
                  打印
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="h-11 shadow-md transition-all hover:scale-105 hover:shadow-lg"
                >
                  <Download className="mr-2 h-4 w-4" />
                  导出
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="h-11 shadow-md transition-all hover:scale-105 hover:shadow-lg"
                  onClick={() => {
                    if (order.status === 'draft') {
                      router.push(`/sales-orders/${id}/edit`);
                    } else {
                      alert('只有草稿状态的订单才能编辑');
                    }
                  }}
                  disabled={order.status !== 'draft'}
                >
                  <Edit className="mr-2 h-4 w-4" />
                  编辑
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="lg"
                      className="h-11 shadow-md transition-all hover:scale-105 hover:shadow-lg"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>复制订单</DropdownMenuItem>
                    <DropdownMenuItem>发送邮件</DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive">
                      删除订单
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* 基本信息 */}
          <div className="space-y-6 lg:col-span-2">
            <Card className="overflow-hidden shadow-lg shadow-gray-200/50">
              <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-gray-50 py-3">
                <CardTitle className="flex items-center text-base text-gray-900">
                  <ShoppingCart className="mr-2 h-4 w-4 text-blue-600" />
                  基本信息
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  <div>
                    <div className="text-xs font-medium text-gray-500">
                      订单状态
                    </div>
                    <div className="mt-2">
                      <Badge variant={getSalesOrderStatusBadgeVariant(order.status)} className="text-xs">
                        {SALES_ORDER_STATUS_LABELS[
                          order.status as keyof typeof SALES_ORDER_STATUS_LABELS
                        ] || order.status}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-gray-500">
                      订单类型
                    </div>
                    <div className="mt-2">
                      {getOrderTypeBadge(order.orderType)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-gray-500">
                      客户名称
                    </div>
                    <div className="mt-2 font-medium text-gray-900">{order.customer.name}</div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-gray-500">
                      客户电话
                    </div>
                    <div className="mt-2 text-sm text-gray-700">{order.customer.phone || '-'}</div>
                  </div>
                  {order.supplier && (
                    <div>
                      <div className="text-xs font-medium text-gray-500">
                        供应商
                      </div>
                      <div className="mt-2 text-sm text-gray-700">{order.supplier.name}</div>
                    </div>
                  )}
                  <div>
                    <div className="text-xs font-medium text-gray-500">
                      创建人
                    </div>
                    <div className="mt-2 text-sm text-gray-700">{order.user.name}</div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-gray-500">
                      创建时间
                    </div>
                    <div className="mt-2 text-sm text-gray-700">{formatDate(order.createdAt)}</div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-gray-500">
                      更新时间
                    </div>
                    <div className="mt-2 text-sm text-gray-700">{formatDate(order.updatedAt)}</div>
                  </div>
                </div>
                {order.remarks && (
                  <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50/50 p-4">
                    <div className="text-xs font-medium text-gray-500">
                      备注信息
                    </div>
                    <div className="mt-2 text-sm text-gray-700">{order.remarks}</div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 订单明细 */}
            <Card className="overflow-hidden shadow-lg shadow-gray-200/50">
              <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-gray-50">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center text-gray-900">
                    <ShoppingCart className="mr-2 h-5 w-5 text-blue-600" />
                    订单明细
                  </CardTitle>
                  <div className="flex items-center gap-4 text-xs text-gray-600">
                    <span>
                      共 <strong className="text-blue-600">{order.items.length}</strong> 种产品
                    </span>
                       <span>
                        总数量：
                        <strong className="text-blue-600">
                          {formatDecimal(totalDisplayQuantity)}
                        </strong>
                      </span>
                    </div>
                  </div>
              </CardHeader>
              <CardContent className="p-0">
                {/* ERP风格表格 */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b bg-gray-50/80">
                      <tr className="text-xs text-gray-600">
                        <th className="px-4 py-3 text-left font-medium">产品信息</th>
                        <th className="px-4 py-3 text-left font-medium">产品编码</th>
                        <th className="px-4 py-3 text-center font-medium">每件片数</th>
                        <th className="px-4 py-3 text-center font-medium">
                          批次 / 生产日期
                        </th>
                        <th className="px-4 py-3 text-left font-medium">规格</th>
                        <th className="px-4 py-3 text-center font-medium">单位</th>
                        <th className="px-4 py-3 text-right font-medium">数量</th>
                        <th className="px-4 py-3 text-right font-medium">单价</th>
                        <th className="px-4 py-3 text-right font-medium">小计</th>
                        {order.orderType === 'TRANSFER' && (
                          <>
                            <th className="px-4 py-3 text-right font-medium">成本</th>
                            <th className="px-4 py-3 text-right font-medium">毛利</th>
                          </>
                        )}
                        <th className="px-4 py-3 text-left font-medium">备注</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                       {order.items.map((item, index) => {
                         const unitLabel = resolveUnitLabel(item);
                         const quantityDisplay = formatQuantityDisplay(item);
                         const piecesPerUnitDisplay =
                           item.piecesPerUnit ?? item.product?.piecesPerUnit;

                         const remarkParts: string[] = [];
                         const piecesBreakdown = formatPiecesBreakdown(item);
                         if (piecesBreakdown) {
                           remarkParts.push(piecesBreakdown);
                         }
                         if (typeof item.remarks === 'string' && item.remarks.trim()) {
                           remarkParts.push(item.remarks.trim());
                         }
                         if (typeof item.manualWeight === 'number') {
                           remarkParts.push(
                             `重量：${formatDecimal(item.manualWeight)}${
                               item.manualUnit ? item.manualUnit : ''
                             }`
                           );
                         }
                         const remarkText = remarkParts.length > 0 ? remarkParts.join('；') : '-';
                         const specificationText = item.isManualProduct
                           ? item.manualSpecification ||
                             item.specification ||
                             '-'
                          : item.specification ||
                            item.product?.specification ||
                            '-';

                        return (
                          <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                            <td className="px-4 py-3">
                              <div className="font-medium text-gray-900">
                                {item.isManualProduct
                                  ? item.manualProductName
                                  : item.product?.name}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-gray-700">
                              <div className="text-sm font-mono">
                                {!item.isManualProduct ? item.product?.code : '-'}
                              </div>
                            </td>
                             <td className="px-4 py-3 text-center text-gray-600">
                               {typeof piecesPerUnitDisplay === 'number'
                                 ? formatDecimal(piecesPerUnitDisplay)
                                 : '-'}
                             </td>
                            <td className="px-4 py-3 text-center text-gray-700">
                              <div className="text-xs font-medium text-gray-900">
                                {item.batchNumber || '-'}
                              </div>
                              {item.productionDate && (
                                <div className="mt-0.5 text-[11px] text-gray-500">
                                  {formatDate(item.productionDate)}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-gray-700">
                              <div className="text-sm">
                                {specificationText}
                              </div>
                              {item.colorCode && (
                                <div className="mt-0.5 text-[11px] text-gray-500">
                                  色号：{item.colorCode}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center text-gray-700">
                               {unitLabel || '-'}
                             </td>
                            <td className="px-4 py-3 text-right font-medium text-gray-900">
                              {quantityDisplay}
                            </td>
                            <td className="px-4 py-3 text-right text-gray-700">
                              {formatCurrency(item.unitPrice)}
                            </td>
                            <td className="px-4 py-3 text-right font-medium text-gray-900">
                              {formatCurrency(item.subtotal)}
                            </td>
                            {order.orderType === 'TRANSFER' && (
                              <>
                                <td className="px-4 py-3 text-right text-gray-600">
                                  {item.costSubtotal
                                    ? formatCurrency(item.costSubtotal)
                                    : '-'}
                                </td>
                                <td className="px-4 py-3 text-right font-medium text-green-600">
                                  {item.profitAmount
                                    ? formatCurrency(item.profitAmount)
                                    : '-'}
                                </td>
                              </>
                            )}
                             <td className="px-4 py-3 text-gray-700">
                               <div className="text-sm">{remarkText}</div>
                             </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    {/* 合计行 */}
                    <tfoot className="border-t-2 bg-gray-50/80 font-medium">
                      <tr>
                        <td colSpan={7} className="px-4 py-3 text-right text-gray-700">
                          合计
                        </td>
                        <td className="px-4 py-3 text-right text-gray-900">
                          <div>{formatDecimal(totalDisplayQuantity)}</div>
                        </td>
                        <td className="px-4 py-3"></td>
                        <td className="px-4 py-3 text-right text-lg text-blue-600">
                          {formatCurrency(order.totalAmount)}
                        </td>
                        {order.orderType === 'TRANSFER' && (
                          <>
                            <td className="px-4 py-3 text-right text-gray-900">
                              {formatCurrency(order.costAmount)}
                            </td>
                            <td className="px-4 py-3 text-right text-lg text-green-600">
                              {formatCurrency(order.profitAmount)}
                            </td>
                          </>
                        )}
                        <td className="px-4 py-3"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 金额汇总 */}
          <div className="space-y-6">
            <Card className="overflow-hidden shadow-lg shadow-gray-200/50">
              <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-gray-50 py-3">
                <CardTitle className="flex items-center text-base text-gray-900">
                  <ShoppingCart className="mr-2 h-4 w-4 text-blue-600" />
                  金额汇总
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="rounded-lg border-2 border-blue-100 bg-blue-50/50 p-4">
                    <div className="text-xs font-medium text-gray-600">订单总金额</div>
                    <div className="mt-2 text-2xl font-bold text-blue-600">
                      {formatCurrency(order.totalAmount)}
                    </div>
                  </div>
                  {order.orderType === 'TRANSFER' && (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-lg border bg-gray-50/50 p-3">
                          <div className="text-xs font-medium text-gray-500">总成本</div>
                          <div className="mt-2 text-lg font-semibold text-gray-900">
                            {formatCurrency(order.costAmount)}
                          </div>
                        </div>
                        <div className="rounded-lg border border-green-100 bg-green-50/50 p-3">
                          <div className="text-xs font-medium text-gray-600">总毛利</div>
                          <div className="mt-2 text-lg font-semibold text-green-600">
                            {formatCurrency(order.profitAmount)}
                          </div>
                        </div>
                      </div>
                      <div className="rounded-lg border border-green-100 bg-green-50/30 p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-gray-600">毛利率</span>
                          <span className="text-xl font-bold text-green-600">
                            {order.totalAmount > 0
                              ? (
                                  (order.profitAmount / order.totalAmount) *
                                  100
                                ).toFixed(1)
                              : '0.0'}
                            %
                          </span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* 操作历史 */}
            <Card className="overflow-hidden shadow-lg shadow-gray-200/50">
              <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-gray-50 py-3">
                <CardTitle className="flex items-center text-base text-gray-900">
                  <ShoppingCart className="mr-2 h-4 w-4 text-blue-600" />
                  操作历史
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-blue-500"></div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900">订单创建</div>
                      <div className="mt-0.5 text-xs text-gray-500">
                        {formatDate(order.createdAt)}
                      </div>
                      <div className="mt-0.5 text-xs text-gray-400">
                        创建人：{order.user.name}
                      </div>
                    </div>
                  </div>
                  {order.updatedAt !== order.createdAt && (
                    <div className="flex items-start gap-3">
                      <div className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-green-500"></div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900">订单更新</div>
                        <div className="mt-0.5 text-xs text-gray-500">
                          {formatDate(order.updatedAt)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

