import {
  ArrowLeft,
  CalendarDays,
  Package,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  Users,
  Warehouse,
} from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { requirePagePermission } from '@/lib/auth/page-permission';
import {
  getProductFlowTracking,
  type ProductFlowTrackingResult,
} from '@/lib/services/product-flow-tracking-service';
import { FACTORY_SHIPMENT_STATUS_LABELS } from '@/lib/types/factory-shipment';
import { INBOUND_REASON_LABELS } from '@/lib/types/inbound';
import { OUTBOUND_REASON_LABELS } from '@/lib/types/inventory';
import { SALES_ORDER_STATUS_LABELS } from '@/lib/types/sales-order';
import { formatDateTimeCN } from '@/lib/utils/datetime';
import { formatNumber } from '@/lib/utils/format';
import { formatPieceSummary } from '@/lib/utils/piece-calculation';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const runtime = 'nodejs';
export const revalidate = 0;

type PageParams = { id: string };
type PageSearchParams = Record<string, string | string[] | undefined>;

const getSingleParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

const formatQuantity = (
  quantity: number,
  product: ProductFlowTrackingResult['product']
) =>
  product.piecesPerUnit && product.piecesPerUnit > 0
    ? formatPieceSummary(quantity, product.piecesPerUnit, {
        fallbackUnit: '片',
      })
    : `${formatNumber(quantity)}片`;

const getOutboundReasonLabel = (reason: string) =>
  OUTBOUND_REASON_LABELS[reason as keyof typeof OUTBOUND_REASON_LABELS] ??
  reason;

const getInboundReasonLabel = (reason: string) =>
  INBOUND_REASON_LABELS[reason as keyof typeof INBOUND_REASON_LABELS] ?? reason;

type CustomerPullRecord =
  ProductFlowTrackingResult['customerPullRecords'][number];

const getFlowStatusLabel = (record: CustomerPullRecord) => {
  if (!record.status) return '—';

  return record.sourceType === 'factory_shipment'
    ? (FACTORY_SHIPMENT_STATUS_LABELS[
        record.status as keyof typeof FACTORY_SHIPMENT_STATUS_LABELS
      ] ?? record.status)
    : (SALES_ORDER_STATUS_LABELS[
        record.status as keyof typeof SALES_ORDER_STATUS_LABELS
      ] ?? record.status);
};

export default async function ProductTrackingPage({
  params,
  searchParams,
}: {
  params: Promise<PageParams> | PageParams;
  searchParams?: Promise<PageSearchParams> | PageSearchParams;
}) {
  await requirePagePermission('products:view');

  const { id } = await Promise.resolve(params);
  const resolvedSearchParams = await Promise.resolve(searchParams ?? {});
  const tracking = await getProductFlowTracking(id, {
    startDate: getSingleParam(resolvedSearchParams.startDate),
    endDate: getSingleParam(resolvedSearchParams.endDate),
    customerId: getSingleParam(resolvedSearchParams.customerId),
  });

  if (!tracking) {
    notFound();
  }

  return <ProductTrackingScreen tracking={tracking} />;
}

function ProductTrackingScreen({
  tracking,
}: {
  tracking: ProductFlowTrackingResult;
}) {
  const { product, dateRange, summary } = tracking;

  return (
    <div className="flex h-full flex-col overflow-auto bg-slate-50/30 p-3 sm:p-4 lg:p-6">
      <div className="mx-auto w-full max-w-7xl space-y-4">
        <Card className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <CardContent className="p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                  <Package className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-xl font-semibold text-slate-900">
                      {product.name}
                    </h1>
                    <Badge variant="secondary" className="rounded-md">
                      {product.code}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm font-medium text-slate-500">
                    {product.specification || '未填写规格'}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <DateRangeForm
                  productId={product.id}
                  startDate={dateRange.startDate}
                  endDate={dateRange.endDate}
                />
                <Button variant="outline" asChild className="h-9 gap-2">
                  <Link href={`/products/${product.id}`}>
                    <ArrowLeft className="h-4 w-4" />
                    返回产品
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-7">
          <SummaryCard
            title="当前库存"
            value={formatQuantity(summary.currentQuantity, product)}
            icon={<Warehouse className="h-5 w-5" />}
          />
          <SummaryCard
            title="可用库存"
            value={formatQuantity(summary.availableQuantity, product)}
            icon={<Warehouse className="h-5 w-5" />}
          />
          <SummaryCard
            title="已锁定"
            value={formatQuantity(summary.reservedQuantity, product)}
            icon={<Package className="h-5 w-5" />}
          />
          <SummaryCard
            title="期间入库"
            value={formatQuantity(summary.totalInboundQuantity, product)}
            icon={<TrendingUp className="h-5 w-5" />}
          />
          <SummaryCard
            title="期间发走"
            value={formatQuantity(summary.totalOutboundQuantity, product)}
            icon={<TrendingDown className="h-5 w-5" />}
          />
          <SummaryCard
            title="发走客户"
            value={`${summary.outboundCustomerCount} 个`}
            icon={<Users className="h-5 w-5" />}
          />
          <SummaryCard
            title="相关单据"
            value={`${summary.outboundOrderCount + summary.factoryShipmentOrderCount} 单`}
            icon={<ShoppingCart className="h-5 w-5" />}
          />
        </div>

        <CustomerPullRecordCard tracking={tracking} />

        <MonthlyCustomerFlowCard tracking={tracking} />

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <FactoryShipmentDetailCard tracking={tracking} />
          <OutboundDetailCard tracking={tracking} />
          <InboundDetailCard tracking={tracking} />
        </div>
      </div>
    </div>
  );
}

function DateRangeForm({
  productId,
  startDate,
  endDate,
}: {
  productId: string;
  startDate: string;
  endDate: string;
}) {
  return (
    <form
      action={`/products/${productId}/tracking`}
      className="flex flex-col gap-2 sm:flex-row sm:items-center"
    >
      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-1.5">
        <CalendarDays className="h-4 w-4 text-slate-400" />
        <Input
          type="date"
          name="startDate"
          defaultValue={startDate}
          className="h-8 w-[136px] border-0 px-1 text-xs shadow-none focus-visible:ring-0"
        />
        <span className="text-xs font-semibold text-slate-400">至</span>
        <Input
          type="date"
          name="endDate"
          defaultValue={endDate}
          className="h-8 w-[136px] border-0 px-1 text-xs shadow-none focus-visible:ring-0"
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit" className="h-9">
          筛选
        </Button>
        <Button variant="outline" asChild className="h-9">
          <Link href={`/products/${productId}/tracking`}>重置</Link>
        </Button>
      </div>
    </form>
  );
}

function SummaryCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: string;
  icon: ReactNode;
}) {
  return (
    <Card className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <CardContent className="p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium text-slate-500">{title}</p>
            <p className="mt-1 font-mono text-base font-semibold text-slate-900">
              {value}
            </p>
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-50 text-slate-500">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MonthlyCustomerFlowCard({
  tracking,
}: {
  tracking: ProductFlowTrackingResult;
}) {
  return (
    <Card className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <CardHeader className="border-b border-slate-100 bg-slate-50/60 px-4 py-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-slate-700">
            按月客户发走
          </CardTitle>
          <Badge variant="secondary">
            {tracking.summary.outboundOrderCount +
              tracking.summary.factoryShipmentOrderCount}{' '}
            单 / {tracking.summary.flowRecordCount} 条
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {tracking.monthlyCustomerFlows.length === 0 ? (
          <EmptyState label="当前时间范围内没有出库记录" />
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[820px]">
              <TableHeader className="bg-slate-50/50">
                <TableRow>
                  <TableHead className="pl-4">月份</TableHead>
                  <TableHead>客户</TableHead>
                  <TableHead className="text-right">发走数量</TableHead>
                  <TableHead className="text-right">相关单据</TableHead>
                  <TableHead className="text-right">发走记录</TableHead>
                  <TableHead className="pr-4 text-right">最近出库</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tracking.monthlyCustomerFlows.map(item => (
                  <TableRow key={`${item.month}-${item.customerId ?? 'none'}`}>
                    <TableCell className="pl-4 font-mono text-xs font-semibold text-slate-900">
                      {item.month}
                    </TableCell>
                    <TableCell className="text-xs font-semibold text-slate-700">
                      {item.customerId ? (
                        <Link
                          href={`/customers/${item.customerId}`}
                          className="text-blue-600 hover:underline"
                        >
                          {item.customerName}
                        </Link>
                      ) : (
                        item.customerName
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs font-semibold text-rose-600">
                      {formatQuantity(item.quantity, tracking.product)}
                    </TableCell>
                    <TableCell className="text-right text-xs font-semibold">
                      {item.salesOrderCount}
                    </TableCell>
                    <TableCell className="text-right text-xs font-semibold">
                      {item.outboundRecordCount}
                    </TableCell>
                    <TableCell className="pr-4 text-right text-xs text-slate-500">
                      {formatDateTimeCN(item.lastOutboundAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CustomerPullRecordCard({
  tracking,
}: {
  tracking: ProductFlowTrackingResult;
}) {
  const isTruncated =
    tracking.summary.flowRecordCount > tracking.customerPullRecords.length;

  return (
    <Card className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <CardHeader className="border-b border-slate-100 bg-slate-50/60 px-4 py-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-sm font-semibold text-slate-800">
              客户拉货明细
            </CardTitle>
            <p className="mt-1 text-xs font-medium text-slate-500">
              按产品编码、名称、批次和客户核对销售去向
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">
              {tracking.summary.outboundCustomerCount} 个客户
            </Badge>
            {isTruncated && <Badge variant="secondary">显示最近 800 条</Badge>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {tracking.customerPullRecords.length === 0 ? (
          <EmptyState label="当前时间范围内没有客户拉货记录" />
        ) : (
          <div className="max-h-[620px] overflow-auto">
            <Table className="min-w-[980px]">
              <TableHeader className="sticky top-0 bg-slate-50">
                <TableRow>
                  <TableHead className="pl-4">日期</TableHead>
                  <TableHead>产品编码/名称</TableHead>
                  <TableHead>批次/色号</TableHead>
                  <TableHead>拉货客户</TableHead>
                  <TableHead>来源单据</TableHead>
                  <TableHead>状态/经办</TableHead>
                  <TableHead className="pr-4 text-right">数量</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tracking.customerPullRecords.map(record => (
                  <TableRow key={`${record.sourceType}-${record.id}`}>
                    <TableCell className="pl-4 text-xs whitespace-nowrap text-slate-500">
                      {formatDateTimeCN(record.flowDate)}
                    </TableCell>
                    <TableCell>
                      <div className="flex min-w-0 flex-col gap-1">
                        <span className="font-mono text-xs font-bold text-slate-900">
                          {record.productCode}
                        </span>
                        <span className="max-w-[240px] truncate text-xs font-semibold text-slate-700">
                          {record.productName}
                        </span>
                        {record.specification && (
                          <span className="max-w-[240px] truncate text-[10px] font-semibold text-slate-400">
                            {record.specification}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 text-xs text-slate-500">
                        <span className="font-mono font-semibold text-slate-700">
                          {record.batchNumber || '未填批次'}
                        </span>
                        <span>
                          {record.variantName || record.location || '—'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs font-semibold text-slate-700">
                      {record.customerId ? (
                        <Link
                          href={`/customers/${record.customerId}`}
                          className="text-blue-600 hover:underline"
                        >
                          {record.customerName}
                        </Link>
                      ) : (
                        record.customerName
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {record.sourceType === 'factory_shipment' &&
                        record.orderId ? (
                          <Link
                            href={`/factory-shipments/${record.orderId}`}
                            className="font-mono text-xs font-bold text-blue-600 hover:underline"
                          >
                            {record.orderNumber || '厂家发货单'}
                          </Link>
                        ) : record.recordNumber ? (
                          <Link
                            href={`/inventory/outbound/${record.recordNumber}`}
                            className="font-mono text-xs font-bold text-blue-600 hover:underline"
                          >
                            {record.recordNumber}
                          </Link>
                        ) : (
                          <span className="font-mono text-xs font-bold text-slate-500">
                            {record.orderNumber || '—'}
                          </span>
                        )}
                        <span className="text-[10px] font-semibold text-slate-400">
                          {record.sourceLabel}
                          {record.orderId &&
                            record.sourceType === 'warehouse_outbound' &&
                            record.orderNumber && (
                              <>
                                {' / '}
                                <Link
                                  href={`/sales-orders/${record.orderId}`}
                                  className="text-blue-600 hover:underline"
                                >
                                  {record.orderNumber}
                                </Link>
                              </>
                            )}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 text-xs">
                        <span className="font-semibold text-slate-700">
                          {getFlowStatusLabel(record)}
                        </span>
                        <span className="text-[10px] font-semibold text-slate-400">
                          {record.operatorName ||
                            record.supplierName ||
                            record.location ||
                            '—'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="pr-4 text-right font-mono text-xs font-semibold text-rose-600">
                      {formatQuantity(record.quantity, tracking.product)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function OutboundDetailCard({
  tracking,
}: {
  tracking: ProductFlowTrackingResult;
}) {
  const isTruncated =
    tracking.summary.outboundRecordCount > tracking.outboundRecords.length;

  return (
    <Card className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <CardHeader className="border-b border-slate-100 bg-slate-50/60 px-4 py-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-slate-700">
            出库明细
          </CardTitle>
          {isTruncated && <Badge variant="secondary">显示最近 500 条</Badge>}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {tracking.outboundRecords.length === 0 ? (
          <EmptyState label="没有出库明细" />
        ) : (
          <div className="max-h-[520px] overflow-auto">
            <Table className="min-w-[760px]">
              <TableHeader className="sticky top-0 bg-slate-50">
                <TableRow>
                  <TableHead className="pl-4">日期</TableHead>
                  <TableHead>出库单</TableHead>
                  <TableHead>客户/订单</TableHead>
                  <TableHead>批次/色号</TableHead>
                  <TableHead className="text-right">数量</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tracking.outboundRecords.map(record => (
                  <TableRow key={record.id}>
                    <TableCell className="pl-4 text-xs whitespace-nowrap text-slate-500">
                      {formatDateTimeCN(record.createdAt)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Link
                          href={`/inventory/outbound/${record.recordNumber}`}
                          className="font-mono text-xs font-bold text-blue-600 hover:underline"
                        >
                          {record.recordNumber}
                        </Link>
                        <span className="text-[10px] font-semibold text-slate-400">
                          {getOutboundReasonLabel(record.reason)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-semibold text-slate-700">
                          {record.customerName}
                        </span>
                        {record.salesOrderId && record.salesOrderNumber && (
                          <Link
                            href={`/sales-orders/${record.salesOrderId}`}
                            className="font-mono text-[10px] font-bold text-blue-600 hover:underline"
                          >
                            {record.salesOrderNumber}
                          </Link>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 text-xs text-slate-500">
                        <span>{record.batchNumber || '—'}</span>
                        <span>
                          {record.variantName || record.location || '—'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs font-semibold text-rose-600">
                      {formatQuantity(record.quantity, tracking.product)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FactoryShipmentDetailCard({
  tracking,
}: {
  tracking: ProductFlowTrackingResult;
}) {
  const isTruncated =
    tracking.summary.factoryShipmentRecordCount >
    tracking.factoryShipmentRecords.length;

  return (
    <Card className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <CardHeader className="border-b border-slate-100 bg-slate-50/60 px-4 py-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-slate-700">
            厂家直发
          </CardTitle>
          {isTruncated && <Badge variant="secondary">显示最近 500 条</Badge>}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {tracking.factoryShipmentRecords.length === 0 ? (
          <EmptyState label="没有厂家直发记录" />
        ) : (
          <div className="max-h-[520px] overflow-auto">
            <Table className="min-w-[760px]">
              <TableHeader className="sticky top-0 bg-slate-50">
                <TableRow>
                  <TableHead className="pl-4">日期</TableHead>
                  <TableHead>厂家发货单</TableHead>
                  <TableHead>客户/供应商</TableHead>
                  <TableHead>批次</TableHead>
                  <TableHead className="text-right">数量</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tracking.factoryShipmentRecords.map(record => (
                  <TableRow key={record.id}>
                    <TableCell className="pl-4 text-xs whitespace-nowrap text-slate-500">
                      {formatDateTimeCN(record.flowDate)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Link
                          href={`/factory-shipments/${record.orderId}`}
                          className="font-mono text-xs font-bold text-blue-600 hover:underline"
                        >
                          {record.orderNumber}
                        </Link>
                        <span className="text-[10px] font-semibold text-slate-400">
                          {FACTORY_SHIPMENT_STATUS_LABELS[
                            record.status as keyof typeof FACTORY_SHIPMENT_STATUS_LABELS
                          ] ?? record.status}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-semibold text-slate-700">
                          {record.customerName}
                        </span>
                        <span className="text-[10px] font-semibold text-slate-400">
                          {record.supplierName || '未关联供应商'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">
                      {record.batchNumber || '—'}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs font-semibold text-rose-600">
                      {formatQuantity(record.quantity, tracking.product)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function InboundDetailCard({
  tracking,
}: {
  tracking: ProductFlowTrackingResult;
}) {
  return (
    <Card className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <CardHeader className="border-b border-slate-100 bg-slate-50/60 px-4 py-3">
        <CardTitle className="text-sm font-semibold text-slate-700">
          入库明细
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {tracking.inboundRecords.length === 0 ? (
          <EmptyState label="没有入库明细" />
        ) : (
          <div className="max-h-[520px] overflow-auto">
            <Table className="min-w-[680px]">
              <TableHeader className="sticky top-0 bg-slate-50">
                <TableRow>
                  <TableHead className="pl-4">日期</TableHead>
                  <TableHead>入库单</TableHead>
                  <TableHead>来源</TableHead>
                  <TableHead>批次/色号</TableHead>
                  <TableHead className="text-right">数量</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tracking.inboundRecords.map(record => (
                  <TableRow key={record.id}>
                    <TableCell className="pl-4 text-xs whitespace-nowrap text-slate-500">
                      {formatDateTimeCN(record.createdAt)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Link
                          href={`/inventory/inbound/${record.recordNumber}`}
                          className="font-mono text-xs font-bold text-blue-600 hover:underline"
                        >
                          {record.recordNumber}
                        </Link>
                        <span className="text-[10px] font-semibold text-slate-400">
                          {getInboundReasonLabel(record.reason)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs font-semibold text-slate-700">
                      {record.supplierName ||
                        record.purchaseOrderNumber ||
                        record.operatorName ||
                        '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 text-xs text-slate-500">
                        <span>{record.batchNumber || '—'}</span>
                        <span>{record.variantName || '—'}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs font-semibold text-emerald-600">
                      {formatQuantity(record.quantity, tracking.product)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex min-h-44 items-center justify-center p-8 text-center text-sm font-semibold text-slate-400">
      {label}
    </div>
  );
}
