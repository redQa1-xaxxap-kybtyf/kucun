/* eslint-disable max-lines-per-function */
'use client';

import { ShoppingCart } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import { formatCostPrice } from '@/lib/utils/cost-price';
import { formatDate } from '@/lib/utils/datetime';
import {
  getSalesOrderDisplayUnitPrice,
  getSalesOrderItemQuantityText,
  getSalesOrderItemWeightKg,
  getSalesOrderNormalizedDisplayUnit,
  getSalesOrderTotalQuantitySummary,
  getSalesOrderTotalWeightKg,
} from '@/lib/utils/sales-order-display';

import type { SalesOrderDetail } from './types';

function formatDecimal(value: number | undefined | null): string {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '-';
  }
  if (Number.isInteger(value)) {
    return value.toString();
  }
  return value.toFixed(4).replace(/(?:\.0+|(\.\d+?)0+)$/, '$1');
}

function resolveUnitLabel(item: SalesOrderDetail['items'][number]) {
  return getSalesOrderNormalizedDisplayUnit(item);
}

function formatQuantityDisplay(item: SalesOrderDetail['items'][number]) {
  return getSalesOrderItemQuantityText(item);
}

function formatPiecesBreakdown(item: SalesOrderDetail['items'][number]) {
  return getSalesOrderItemQuantityText(item);
}

function formatItemWeightKg(weightKg: number | null): string {
  if (!weightKg || !Number.isFinite(weightKg) || weightKg <= 0) {
    return '-';
  }

  // 保留最多 3 位小数，去掉多余的 0
  const rounded = Math.round(weightKg * 1000) / 1000;
  return `${formatDecimal(rounded)}kg`;
}

function resolveDisplayUnitPrice(item: SalesOrderDetail['items'][number]) {
  return getSalesOrderDisplayUnitPrice(item);
}

function formatTotalQuantitySummary(
  items: SalesOrderDetail['items'],
  _totalDisplayQuantity: number
) {
  return getSalesOrderTotalQuantitySummary(items);
}

interface Props {
  order: SalesOrderDetail;
  totalDisplayQuantity: number;
  totalLocalQuantity: number;
  totalTransferQuantity: number;
  productSubtotal: number;
  density?: 'compact' | 'comfortable';
}

export function OrderItemsTable({
  order,
  totalDisplayQuantity,
  totalLocalQuantity,
  totalTransferQuantity,
  productSubtotal,
}: Props) {
  const orderItems = order.items ?? [];
  const totalWeightKg = getSalesOrderTotalWeightKg(orderItems);

  return (
    <Card className="overflow-hidden rounded-2xl border-slate-100 shadow-sm ring-1 ring-slate-100/50">
      <CardHeader className="border-b border-slate-100 bg-slate-50/50 py-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <CardTitle className="flex items-center gap-3 text-sm font-semibold text-slate-900">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100/50 text-blue-600 shadow-sm">
              <ShoppingCart className="h-5 w-5" />
            </div>
            业务订购明细
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2 text-xs text-[hsl(var(--color-text-tertiary))] sm:justify-end sm:text-sm">
            <span>产品种类</span>
            <span className="font-bold text-[hsl(var(--color-text-primary))]">
              {orderItems.length}
            </span>
            <span className="mx-1 text-[hsl(var(--color-text-tertiary))]">
              |
            </span>
            <span>总数量</span>
            <span className="font-bold text-[hsl(var(--color-text-primary))]">
              {formatTotalQuantitySummary(orderItems, totalDisplayQuantity)}
            </span>
            {totalWeightKg > 0 && (
              <>
                <span className="mx-1 text-[hsl(var(--color-text-tertiary))]">
                  |
                </span>
                <span>总重量</span>
                <span className="font-bold text-[hsl(var(--color-text-primary))]">
                  {formatDecimal(totalWeightKg)}kg
                </span>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="bg-[hsl(var(--color-bg-card))] p-0">
        {/* 桌面端：表格视图 */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-sm text-slate-600">
            <thead className="sticky top-0 z-10 border-b border-slate-100 bg-slate-50/80 text-table-header backdrop-blur-md">
              <tr>
                <th className="h-11 px-3 py-3 text-left align-middle font-semibold leading-none whitespace-nowrap">
                  产品编码
                </th>
                <th className="h-11 px-3 py-3 text-left align-middle font-semibold leading-none whitespace-nowrap">
                  产品名称
                </th>
                <th className="h-11 px-3 py-3 text-left align-middle font-semibold leading-none whitespace-nowrap">
                  规格
                </th>
                {order.orderType !== 'TRANSFER' && (
                  <th className="h-11 px-3 py-3 text-center align-middle font-semibold leading-none whitespace-nowrap">
                    批次/日期
                  </th>
                )}
                <th className="h-11 min-w-[90px] px-3 py-3 text-center align-middle font-semibold leading-none whitespace-nowrap">
                  装箱数
                </th>
                <th className="h-11 px-3 py-3 text-center align-middle font-semibold leading-none whitespace-nowrap">
                  单位
                </th>
                <th className="h-11 px-3 py-3 text-right align-middle font-semibold leading-none whitespace-nowrap">
                  数量
                </th>
                <th className="h-11 px-3 py-3 text-right align-middle font-semibold leading-none whitespace-nowrap">
                  重量(kg)
                </th>
                {order.orderType === 'TRANSFER' && (
                  <>
                    <th className="h-11 px-3 py-3 text-right align-middle font-semibold leading-none whitespace-nowrap">
                      本地发货
                    </th>
                    <th className="h-11 px-3 py-3 text-right align-middle font-semibold leading-none whitespace-nowrap">
                      调货发货
                    </th>
                  </>
                )}
                <th className="h-11 px-3 py-3 text-right align-middle font-semibold leading-none whitespace-nowrap">
                  单价
                </th>
                <th className="h-11 px-3 py-3 text-right align-middle font-semibold leading-none whitespace-nowrap">
                  小计
                </th>
                {order.orderType === 'TRANSFER' && (
                  <>
                    <th className="h-11 px-3 py-3 text-right align-middle font-semibold leading-none whitespace-nowrap">
                      单位成本
                    </th>
                    <th className="h-11 px-3 py-3 text-right align-middle font-semibold leading-none whitespace-nowrap">
                      成本小计
                    </th>
                    <th className="h-11 px-3 py-3 text-right align-middle font-semibold leading-none whitespace-nowrap">
                      毛利
                    </th>
                  </>
                )}
                <th className="h-11 min-w-[120px] px-3 py-3 text-left align-middle font-semibold leading-none whitespace-nowrap">
                  备注说明
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white text-[hsl(var(--color-text-primary))]">
              {orderItems.map((item, index) => {
                const unitLabel = resolveUnitLabel(item);
                const quantityDisplay = formatQuantityDisplay(item);
                const piecesPerUnitDisplay =
                  item.piecesPerUnit ??
                  item.batchPiecesPerUnit ??
                  item.product?.piecesPerUnit;
                // 备注只显示：片数转换信息（x件y片）
                const piecesBreakdown = formatPiecesBreakdown(item);
                const remarkText = piecesBreakdown || '-';
                const specificationText = item.isManualProduct
                  ? item.manualSpecification || item.specification || '-'
                  : item.specification || item.product?.specification || '-';
                const manualName =
                  typeof item.manualProductName === 'string'
                    ? item.manualProductName.trim()
                    : '';
                const manualCode =
                  typeof item.productCode === 'string'
                    ? item.productCode.trim()
                    : '';
                const displayProductName = item.isManualProduct
                  ? manualName || manualCode || '临时产品'
                  : item.product?.name || '-';
                const displayProductCode = item.isManualProduct
                  ? manualCode || '-'
                  : item.product?.code || '-';
                const localQuantityDisplay = formatDecimal(item.localQuantity ?? 0);
                const transferQuantityDisplay = formatDecimal(item.transferQuantity ?? 0);
                const itemWeightKg = getSalesOrderItemWeightKg(item);

                return (
                  <tr
                    key={item.id}
                    className="group transition-colors duration-150 hover:bg-blue-50/50"
                  >
                    <td className="px-3 py-3.5 align-top whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <div className="flex h-5 w-5 items-center justify-center rounded bg-gray-100 text-xs font-medium text-gray-600 group-hover:bg-blue-100 group-hover:text-blue-700">
                          {index + 1}
                        </div>
                        <span className="font-mono text-sm font-medium text-[hsl(var(--color-text-primary))]">
                          {displayProductCode}
                        </span>
                        {item.isManualProduct && (
                          <span className="rounded border border-orange-300 bg-orange-50 px-1 py-0.5 text-[10px] font-semibold text-orange-700">
                            临时
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3.5 align-top whitespace-nowrap">
                      <span className="text-sm font-medium text-[hsl(var(--color-text-primary))]">
                        {displayProductName}
                      </span>
                    </td>
                    <td className="px-3 py-3.5 align-top whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm text-gray-600">
                          {specificationText}
                        </span>
                        {item.colorCode && (
                          <span className="inline-flex items-center gap-1 rounded bg-orange-50 px-1.5 py-0.5 text-[10px] text-orange-700">
                            <div className="h-1.5 w-1.5 rounded-full bg-orange-400"></div>
                            {item.colorCode}
                          </span>
                        )}
                      </div>
                    </td>
                    {order.orderType !== 'TRANSFER' && (
                      <td className="px-3 py-3.5 text-center align-middle whitespace-nowrap">
                        <div className="inline-flex flex-col items-center gap-1">
                          <span className="rounded bg-slate-100/50 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-500">
                            {item.batchNumber || '-'}
                          </span>
                          {item.productionDate && (
                            <span className="text-[9px] font-medium text-slate-400">
                              {formatDate(item.productionDate)}
                            </span>
                          )}
                        </div>
                      </td>
                    )}
                    <td className="px-3 py-3.5 text-center align-top whitespace-nowrap">
                      <span className="text-sm text-gray-600">
                        {typeof piecesPerUnitDisplay === 'number'
                          ? formatDecimal(piecesPerUnitDisplay)
                          : '-'}
                      </span>
                    </td>
                    <td className="px-3 py-3.5 text-center align-top whitespace-nowrap">
                      <span className="text-sm text-gray-600">
                        {unitLabel || '-'}
                      </span>
                    </td>
                    <td className="px-3 py-3.5 text-right align-top whitespace-nowrap">
                      <span className="text-sm font-semibold text-[hsl(var(--color-text-primary))]">
                        {quantityDisplay}
                      </span>
                    </td>
                    <td className="px-3 py-3.5 text-right align-top whitespace-nowrap">
                      <span className="text-sm text-gray-700">
                        {formatItemWeightKg(itemWeightKg)}
                      </span>
                    </td>
                    {order.orderType === 'TRANSFER' && (
                      <>
                        <td className="px-3 py-3.5 text-right align-top whitespace-nowrap">
                          <span className="text-sm text-gray-600">
                            {localQuantityDisplay}
                          </span>
                        </td>
                        <td className="px-3 py-3.5 text-right align-top whitespace-nowrap">
                          <span className="text-sm text-gray-600">
                            {transferQuantityDisplay}
                          </span>
                        </td>
                      </>
                    )}
                    <td className="px-3 py-3.5 text-right align-top whitespace-nowrap">
                      <span className="text-sm text-gray-700">
                        {formatCurrency(resolveDisplayUnitPrice(item))}
                      </span>
                    </td>
                    <td className="px-3 py-3.5 text-right align-top whitespace-nowrap">
                      <span className="text-sm font-bold text-[hsl(var(--color-text-primary))]">
                        {formatCurrency(item.subtotal)}
                      </span>
                    </td>
                    {order.orderType === 'TRANSFER' && (
                      <>
                        <td className="px-3 py-3.5 text-right align-top whitespace-nowrap">
                          <span className="text-sm text-gray-600">
                            {item.unitCost !== null && item.unitCost !== undefined
                              ? formatCostPrice(item.unitCost)
                              : '-'}
                          </span>
                        </td>
                        <td className="px-3 py-3.5 text-right align-top whitespace-nowrap">
                          <span className="text-sm text-gray-700">
                            {item.costSubtotal
                              ? formatCurrency(item.costSubtotal)
                              : '-'}
                          </span>
                        </td>
                        <td className="px-3 py-3.5 text-right align-top whitespace-nowrap">
                          <span className="text-sm font-bold text-[hsl(var(--color-success))]">
                            {item.profitAmount
                              ? formatCurrency(item.profitAmount)
                              : '-'}
                          </span>
                        </td>
                      </>
                    )}
                    <td className="px-3 py-3.5 align-top whitespace-nowrap">
                      <div className="flex h-full min-w-[100px] items-center text-xs text-gray-500">
                        {remarkText !== '-' ? (
                          <div className="inline-flex rounded border border-blue-100 bg-blue-50/50 px-2 py-0.5 font-bold tracking-tight whitespace-nowrap text-blue-600">
                            {remarkText}
                          </div>
                        ) : (
                          <span className="text-gray-300">/</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t border-slate-100 bg-slate-50/30">
              <tr className="font-bold">
                <td
                  colSpan={order.orderType === 'TRANSFER' ? 3 : 4}
                  className="px-4 py-4 text-right text-slate-500"
                >
                  <span className="text-[10px] font-semibold tracking-[0.2em]">
                    合计统计
                  </span>
                </td>
                <td className="px-3 py-4 text-center whitespace-nowrap">
                  <span className="text-[10px] font-bold text-slate-300">
                    -
                  </span>
                </td>
                <td className="px-3 py-4 text-center whitespace-nowrap">
                  <span className="text-[10px] font-bold text-slate-300">
                    -
                  </span>
                </td>
                <td className="px-3 py-4 text-right whitespace-nowrap">
                  <span className="font-mono text-base font-semibold text-slate-900">
                    {formatTotalQuantitySummary(orderItems, totalDisplayQuantity)}
                  </span>
                </td>
                <td className="px-3 py-4 text-right whitespace-nowrap">
                  <span className="font-mono text-sm font-bold text-slate-600">
                    {totalWeightKg > 0
                      ? `${formatDecimal(totalWeightKg)}kg`
                      : '-'}
                  </span>
                </td>
                {order.orderType === 'TRANSFER' && (
                  <>
                    <td className="px-3 py-4 text-right whitespace-nowrap">
                      <span className="font-mono text-sm font-medium text-slate-600">
                        {formatDecimal(totalLocalQuantity)}
                      </span>
                    </td>
                    <td className="px-3 py-4 text-right whitespace-nowrap">
                      <span className="font-mono text-sm font-medium text-slate-600">
                        {formatDecimal(totalTransferQuantity)}
                      </span>
                    </td>
                  </>
                )}
                <td className="px-3 py-4 text-right whitespace-nowrap">
                  <span className="text-[10px] font-bold text-slate-300">
                    -
                  </span>
                </td>
                <td className="px-3 py-4 text-right whitespace-nowrap">
                  <span className="font-mono text-xl font-semibold text-blue-700">
                    {formatCurrency(productSubtotal)}
                  </span>
                </td>
                {order.orderType === 'TRANSFER' && (
                  <>
                    <td className="px-3 py-4 text-right whitespace-nowrap">
                      <span className="text-[10px] font-bold text-slate-300">
                        -
                      </span>
                    </td>
                    <td className="px-3 py-4 text-right whitespace-nowrap">
                      <span className="font-mono text-sm font-semibold text-slate-700">
                        {formatCurrency(order.costAmount)}
                      </span>
                    </td>
                    <td className="px-3 py-4 text-right whitespace-nowrap">
                      <span className="font-mono text-lg font-semibold text-emerald-600">
                        {formatCurrency(order.profitAmount)}
                      </span>
                    </td>
                  </>
                )}
                <td className="px-3 py-4">
                  <span className="text-[10px] font-bold text-slate-200">
                    #
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* 移动端：卡片视图 */}
        <div className="space-y-3 border-t border-[hsl(var(--color-border-secondary))] bg-white p-3 md:hidden">
          {orderItems.map((item, index) => {
            const unitLabel = resolveUnitLabel(item);
            const quantityDisplay = formatQuantityDisplay(item);
            const piecesPerUnitDisplay =
              item.piecesPerUnit ??
              item.batchPiecesPerUnit ??
              item.product?.piecesPerUnit;
            const piecesBreakdown = formatPiecesBreakdown(item);
            const specificationText = item.isManualProduct
              ? item.manualSpecification || item.specification || '-'
              : item.specification || item.product?.specification || '-';
            const manualName =
              typeof item.manualProductName === 'string'
                ? item.manualProductName.trim()
                : '';
            const manualCode =
              typeof item.productCode === 'string'
                ? item.productCode.trim()
                : '';
            const displayProductName = item.isManualProduct
              ? manualName || manualCode || '临时产品'
              : item.product?.name || '-';
            const displayProductCode = item.isManualProduct
              ? manualCode || '-'
              : item.product?.code || '-';
            const localQuantityDisplay = formatDecimal(item.localQuantity ?? 0);
            const transferQuantityDisplay = formatDecimal(
              item.transferQuantity ?? 0
            );
            const itemWeightKg = getSalesOrderItemWeightKg(item);

            return (
              <div
                key={item.id}
                className="rounded-lg border border-[hsl(var(--color-border-secondary))] bg-white p-3 shadow-[var(--shadow-light)]"
              >
                {/* 顶部：名称 + 编码 */}
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-gray-100 text-[11px] font-medium text-gray-700">
                        {index + 1}
                      </span>
                      <span className="font-mono text-[12px] text-[hsl(var(--color-text-primary))]">
                        {displayProductCode}
                      </span>
                      {item.isManualProduct && (
                        <span className="rounded border border-orange-300 bg-orange-50 px-1 py-0.5 text-[10px] font-semibold text-orange-700">
                          临时
                        </span>
                      )}
                    </div>
                    <div className="text-sm font-medium text-[hsl(var(--color-text-primary))]">
                      {displayProductName}
                    </div>
                    <div className="flex flex-wrap items-center gap-1 text-[11px] text-gray-600">
                      <span>{specificationText}</span>
                      {item.colorCode && (
                        <span className="inline-flex items-center gap-1 rounded bg-orange-50 px-1.5 py-0.5 text-[10px] text-orange-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />
                          {item.colorCode}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* 单价 + 小计 */}
                  <div className="space-y-1 text-right text-[11px] text-gray-500">
                    <div>单价</div>
                    <div className="font-mono text-[13px] font-semibold text-[hsl(var(--color-primary))]">
                      {typeof item.unitPrice === 'number'
                        ? formatCurrency(resolveDisplayUnitPrice(item))
                        : '-'}
                    </div>
                    <div className="text-[10px] text-gray-500">小计</div>
                    <div className="font-mono text-[13px] font-bold text-[hsl(var(--color-primary))]">
                      {typeof item.subtotal === 'number'
                        ? formatCurrency(item.subtotal)
                        : '-'}
                    </div>
                  </div>
                </div>

                {/* 数量 / 单位 / 重量等 */}
                <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-gray-600">
                  <div className="space-y-0.5">
                    <div className="text-[10px] text-gray-500">出货数量</div>
                    <div className="font-medium text-[hsl(var(--color-text-primary))]">
                      {piecesBreakdown || quantityDisplay}
                    </div>
                    <div className="text-[10px] text-gray-500">
                      总片数：
                      <span className="font-semibold">
                        {formatDecimal(item.quantity ?? 0)}片
                      </span>
                    </div>
                  </div>
                  <div className="space-y-0.5 text-right">
                    <div className="text-[10px] text-gray-500">
                      单位 / 装箱数
                    </div>
                    <div>
                      <span className="mr-1">{unitLabel}</span>
                      {typeof piecesPerUnitDisplay === 'number' && (
                        <span className="text-gray-500">
                          · {formatDecimal(piecesPerUnitDisplay)}片/件
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-gray-500">
                      重量(kg)：
                      <span className="font-mono text-[12px] text-[hsl(var(--color-text-primary))]">
                        {typeof itemWeightKg === 'number'
                          ? `${formatDecimal(itemWeightKg)}kg`
                          : '-'}
                      </span>
                    </div>
                  </div>
                  {order.orderType === 'TRANSFER' && (
                    <div className="col-span-2 space-y-0.5">
                      <div className="text-[10px] text-gray-500">
                        本地 / 调货
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-gray-700">
                        <span>本地 {localQuantityDisplay}</span>
                        <span>调货 {transferQuantityDisplay}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* 备注：仅在有备注时展示 */}
                {item.remarks && item.remarks.trim().length > 0 && (
                  <div className="mt-2 rounded border border-dashed border-gray-200 bg-gray-50 px-2 py-1 text-[11px] text-gray-600">
                    备注：{item.remarks}
                  </div>
                )}
              </div>
            );
          })}

          {/* 小结 */}
          <div className="rounded-lg border border-dashed border-[hsl(var(--color-border-secondary))] bg-[hsl(var(--color-bg-secondary))] p-3 text-[11px] text-[hsl(var(--color-text-secondary))]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="mr-1 font-medium text-[hsl(var(--color-text-primary))]">
                  产品小计
                </span>
                <span className="font-mono text-[13px] font-bold text-[hsl(var(--color-primary))]">
                  {formatCurrency(productSubtotal)}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span>
                  总数量：
                  <span className="font-semibold">
                    {formatTotalQuantitySummary(orderItems, totalDisplayQuantity)}
                  </span>
                </span>
                {totalWeightKg > 0 && (
                  <span>
                    总重量：
                    <span className="font-semibold">
                      {formatDecimal(totalWeightKg)}kg
                    </span>
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
