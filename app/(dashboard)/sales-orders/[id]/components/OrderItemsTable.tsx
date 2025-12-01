/* eslint-disable max-lines-per-function */
'use client';

import { ShoppingCart } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import { formatDate } from '@/lib/utils/datetime';
import { calculatePieceDisplay } from '@/lib/utils/piece-calculation';

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
  if (item.displayUnit) return item.displayUnit;
  if (item.isManualProduct) return item.manualUnit || '-';
  return item.product?.unit || '-';
}

function formatQuantityDisplay(item: SalesOrderDetail['items'][number]) {
  // quantity 始终以“片”存储，displayUnit/displayQuantity 记录销售员使用的录入单位
  const totalPieces = (item.quantity ?? 0) || 0;
  const piecesPerUnit = item.piecesPerUnit ?? item.product?.piecesPerUnit;
  const displayUnit = item.displayUnit || item.product?.unit;

  if (!displayUnit) {
    // 回退：只知道总片数
    if (piecesPerUnit && Number.isInteger(piecesPerUnit) && piecesPerUnit > 0) {
      const result = calculatePieceDisplay(
        Math.floor(totalPieces),
        piecesPerUnit
      );
      return `${result.totalPieces}片 (约${result.displayText})`;
    }
    return `${formatDecimal(totalPieces)}片`;
  }

  // 销售员按“件”录入：主显示用件数，附带总片数
  if (displayUnit === '件' && piecesPerUnit && piecesPerUnit > 0) {
    const unitsRaw =
      typeof item.displayQuantity === 'number'
        ? item.displayQuantity
        : totalPieces / piecesPerUnit;
    const units = Number.isFinite(unitsRaw)
      ? unitsRaw
      : totalPieces / piecesPerUnit;
    return `${formatDecimal(units)}件（共${totalPieces}片）`;
  }

  // 销售员按“片”录入：主显示用片数，附带近似件数
  if (displayUnit === '片') {
    if (piecesPerUnit && Number.isInteger(piecesPerUnit) && piecesPerUnit > 0) {
      const result = calculatePieceDisplay(
        Math.floor(totalPieces),
        piecesPerUnit
      );
      return `${result.totalPieces}片 (约${result.displayText})`;
    }
    return `${formatDecimal(totalPieces)}片`;
  }

  // 其他单位（如箱等）：优先显示录入单位 + 总片数
  if (piecesPerUnit && piecesPerUnit > 0 && totalPieces > 0) {
    const unitsRaw =
      typeof item.displayQuantity === 'number'
        ? item.displayQuantity
        : totalPieces / piecesPerUnit;
    const units = Number.isFinite(unitsRaw)
      ? unitsRaw
      : totalPieces / piecesPerUnit;
    return `${formatDecimal(units)}${displayUnit}（共${totalPieces}片）`;
  }

  return `${formatDecimal(totalPieces)}${displayUnit}`;
}

function formatPiecesBreakdown(item: SalesOrderDetail['items'][number]) {
  const piecesPerUnit = item.piecesPerUnit ?? item.product?.piecesPerUnit;
  const displayUnit = item.displayUnit || item.product?.unit;
  const quantity = item.displayQuantity ?? item.quantity;

  if (!displayUnit || !quantity) return '';

  // 如果单位是"件"，直接显示件数
  if (displayUnit === '件') {
    return `${formatDecimal(quantity)}件`;
  }

  // 如果单位是"片"，计算件数和余片
  if (displayUnit === '片' && piecesPerUnit) {
    const fullBoxes = Math.floor(quantity / piecesPerUnit);
    const remainingPieces = quantity % piecesPerUnit;

    if (remainingPieces === 0) {
      // 能整除，只显示件数
      return `${formatDecimal(fullBoxes)}件`;
    } else {
      // 有余数，显示件数+片数
      return `${formatDecimal(fullBoxes)}件${formatDecimal(remainingPieces)}片`;
    }
  }

  // 其他单位情况，直接显示数量+单位
  return `${formatDecimal(quantity)}${displayUnit}`;
}

function resolveDisplayUnitPrice(item: SalesOrderDetail['items'][number]) {
  const piecesPerUnit = item.piecesPerUnit ?? item.product?.piecesPerUnit;
  const displayUnit = item.displayUnit || item.product?.unit;
  const unitPricePiece = item.unitPrice; // 数据库存储的片单价

  // 销售员按“件”录入：优先用小计 ÷ 件数，还原原始“每件单价”
  if (displayUnit === '件') {
    const units =
      typeof item.displayQuantity === 'number' && item.displayQuantity > 0
        ? item.displayQuantity
        : piecesPerUnit && piecesPerUnit > 0 && item.quantity
          ? item.quantity / piecesPerUnit
          : undefined;

    if (units && item.subtotal) {
      const perUnit = item.subtotal / units;
      if (Number.isFinite(perUnit)) {
        return perUnit;
      }
    }

    // 回退：用片价 * 每件片数近似
    if (piecesPerUnit && piecesPerUnit > 0) {
      return unitPricePiece * piecesPerUnit;
    }
  }

  // 按片或其他单位录入：直接显示片单价
  return unitPricePiece;
}

interface Props {
  order: SalesOrderDetail;
  totalDisplayQuantity: number;
  totalLocalQuantity: number;
  totalTransferQuantity: number;
  productSubtotal: number;
}

export function OrderItemsTable({
  order,
  totalDisplayQuantity,
  totalLocalQuantity,
  totalTransferQuantity,
  productSubtotal,
}: Props) {
  const orderItems = order.items ?? [];

  return (
    <Card
      className="overflow-hidden border border-[hsl(var(--color-border-primary))]"
      style={{ boxShadow: 'var(--shadow-medium)' }}
    >
      <CardHeader className="border-b border-[hsl(var(--color-border-secondary))] bg-gradient-to-r from-blue-50 to-indigo-50 py-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-[hsl(var(--color-text-primary))]">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 shadow-sm">
              <ShoppingCart className="h-4 w-4 text-white" />
            </div>
            订单明细
          </CardTitle>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-[hsl(var(--color-text-tertiary))]">
              产品种类
            </span>
            <span className="font-bold text-[hsl(var(--color-text-primary))]">
              {orderItems.length}
            </span>
            <span className="mx-1 text-[hsl(var(--color-text-tertiary))]">
              |
            </span>
            <span className="text-[hsl(var(--color-text-tertiary))]">
              总数量
            </span>
            <span className="font-bold text-[hsl(var(--color-text-primary))]">
              {(() => {
                const items = order.items ?? [];
                const totalPieces = Math.floor(totalDisplayQuantity || 0);
                const uniquePpu = Array.from(
                  new Set(
                    items
                      .map(i => i.piecesPerUnit ?? i.product?.piecesPerUnit)
                      .filter(
                        ppu => typeof ppu === 'number' && (ppu as number) > 0
                      )
                  )
                ) as number[];
                if (uniquePpu.length === 1) {
                  const ppu = uniquePpu[0];
                  const units = Math.floor(totalPieces / ppu);
                  const pieces = totalPieces % ppu;
                  if (units === 0) return `${pieces}片（共${totalPieces}片）`;
                  if (pieces === 0) return `${units}件（共${totalPieces}片）`;
                  return `${units}件${pieces}片（共${totalPieces}片）`;
                }
                return `${totalPieces}片`;
              })()}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="bg-[hsl(var(--color-bg-card))] p-0">
        <div className="overflow-x-auto rounded-b-xl border-t border-[hsl(var(--color-border-secondary))]">
          <table className="w-full text-sm text-[hsl(var(--color-text-secondary))]">
            <thead className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50 text-xs font-medium text-gray-600">
              <tr>
                <th className="px-3 py-2.5 text-left font-medium whitespace-nowrap">
                  产品编码
                </th>
                <th className="px-3 py-2.5 text-left font-medium whitespace-nowrap">
                  产品名称
                </th>
                <th className="px-3 py-2.5 text-left font-medium whitespace-nowrap">
                  规格
                </th>
                {order.orderType !== 'TRANSFER' && (
                  <th className="px-3 py-2.5 text-center font-medium whitespace-nowrap">
                    批次/日期
                  </th>
                )}
                <th className="min-w-[90px] px-3 py-2.5 text-center font-medium whitespace-nowrap">
                  每件片数
                </th>
                <th className="px-3 py-2.5 text-center font-medium whitespace-nowrap">
                  单位
                </th>
                <th className="px-3 py-2.5 text-right font-medium whitespace-nowrap">
                  数量
                </th>
                {order.orderType === 'TRANSFER' && (
                  <>
                    <th className="px-3 py-2.5 text-right font-medium whitespace-nowrap">
                      本地发货
                    </th>
                    <th className="px-3 py-2.5 text-right font-medium whitespace-nowrap">
                      调货发货
                    </th>
                  </>
                )}
                <th className="px-3 py-2.5 text-right font-medium whitespace-nowrap">
                  单价
                </th>
                <th className="px-3 py-2.5 text-right font-medium whitespace-nowrap">
                  小计
                </th>
                {order.orderType === 'TRANSFER' && (
                  <>
                    <th className="px-3 py-2.5 text-right font-medium whitespace-nowrap">
                      单位成本
                    </th>
                    <th className="px-3 py-2.5 text-right font-medium whitespace-nowrap">
                      成本小计
                    </th>
                    <th className="px-3 py-2.5 text-right font-medium whitespace-nowrap">
                      毛利
                    </th>
                  </>
                )}
                <th className="px-3 py-2.5 text-left font-medium whitespace-nowrap">
                  备注
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white text-[hsl(var(--color-text-primary))]">
              {orderItems.map((item, index) => {
                const unitLabel = resolveUnitLabel(item);
                const quantityDisplay = formatQuantityDisplay(item);
                const piecesPerUnitDisplay =
                  item.piecesPerUnit ?? item.product?.piecesPerUnit;
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
                const localQuantityDisplay = formatDecimal(
                  item.localQuantity ?? 0
                );
                const transferQuantityDisplay = formatDecimal(
                  item.transferQuantity ?? 0
                );

                return (
                  <tr
                    key={item.id}
                    className="group transition-colors duration-150 hover:bg-blue-50/50"
                  >
                    <td className="px-3 py-2.5 align-top whitespace-nowrap">
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
                    <td className="px-3 py-2.5 align-top whitespace-nowrap">
                      <span className="text-sm font-medium text-[hsl(var(--color-text-primary))]">
                        {displayProductName}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 align-top whitespace-nowrap">
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
                      <td className="px-3 py-2.5 text-center align-top whitespace-nowrap">
                        <div className="inline-flex flex-col items-center gap-0.5">
                          <span className="text-xs font-medium text-purple-600">
                            {item.batchNumber || '-'}
                          </span>
                          {item.productionDate && (
                            <span className="text-[10px] text-gray-500">
                              {formatDate(item.productionDate)}
                            </span>
                          )}
                        </div>
                      </td>
                    )}
                    <td className="px-3 py-2.5 text-center align-top whitespace-nowrap">
                      <span className="text-sm text-gray-600">
                        {typeof piecesPerUnitDisplay === 'number'
                          ? formatDecimal(piecesPerUnitDisplay)
                          : '-'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center align-top whitespace-nowrap">
                      <span className="text-sm text-gray-600">
                        {unitLabel || '-'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right align-top whitespace-nowrap">
                      <span className="text-sm font-semibold text-[hsl(var(--color-text-primary))]">
                        {quantityDisplay}
                      </span>
                    </td>
                    {order.orderType === 'TRANSFER' && (
                      <>
                        <td className="px-3 py-2.5 text-right align-top whitespace-nowrap">
                          <span className="text-sm text-gray-600">
                            {localQuantityDisplay}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right align-top whitespace-nowrap">
                          <span className="text-sm text-gray-600">
                            {transferQuantityDisplay}
                          </span>
                        </td>
                      </>
                    )}
                    <td className="px-3 py-2.5 text-right align-top whitespace-nowrap">
                      <span className="text-sm text-gray-700">
                        {formatCurrency(resolveDisplayUnitPrice(item))}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right align-top whitespace-nowrap">
                      <span className="text-sm font-bold text-[hsl(var(--color-text-primary))]">
                        {formatCurrency(item.subtotal)}
                      </span>
                    </td>
                    {order.orderType === 'TRANSFER' && (
                      <>
                        <td className="px-3 py-2.5 text-right align-top whitespace-nowrap">
                          <span className="text-sm text-gray-600">
                            {item.unitCost
                              ? formatCurrency(item.unitCost)
                              : '-'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right align-top whitespace-nowrap">
                          <span className="text-sm text-gray-700">
                            {item.costSubtotal
                              ? formatCurrency(item.costSubtotal)
                              : '-'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right align-top whitespace-nowrap">
                          <span className="text-sm font-bold text-[hsl(var(--color-success))]">
                            {item.profitAmount
                              ? formatCurrency(item.profitAmount)
                              : '-'}
                          </span>
                        </td>
                      </>
                    )}
                    <td className="px-3 py-2.5 align-top">
                      <div className="max-w-xs text-xs text-gray-500">
                        {remarkText !== '-' ? (
                          <div className="rounded border border-gray-200 bg-gray-50 px-2 py-1 break-words whitespace-normal">
                            {remarkText}
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t-2 border-gray-300 bg-gradient-to-r from-gray-50 to-gray-100">
              <tr className="font-semibold">
                <td
                  colSpan={order.orderType === 'TRANSFER' ? 3 : 4}
                  className="px-3 py-3 text-right text-[hsl(var(--color-text-primary))]"
                >
                  <span className="text-sm">产品小计</span>
                </td>
                <td className="px-3 py-3 text-center whitespace-nowrap">
                  <span className="text-xs text-gray-400">-</span>
                </td>
                <td className="px-3 py-3 text-center whitespace-nowrap">
                  <span className="text-xs text-gray-400">-</span>
                </td>
                <td className="px-3 py-3 text-right whitespace-nowrap">
                  <span className="text-sm font-bold text-[hsl(var(--color-text-primary))]">
                    {formatDecimal(totalDisplayQuantity)}
                  </span>
                </td>
                {order.orderType === 'TRANSFER' && (
                  <>
                    <td className="px-3 py-3 text-right whitespace-nowrap">
                      <span className="text-sm font-medium text-gray-600">
                        {formatDecimal(totalLocalQuantity)}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right whitespace-nowrap">
                      <span className="text-sm font-medium text-gray-600">
                        {formatDecimal(totalTransferQuantity)}
                      </span>
                    </td>
                  </>
                )}
                <td className="px-3 py-3 text-right whitespace-nowrap">
                  <span className="text-xs text-gray-400">-</span>
                </td>
                <td className="px-3 py-3 text-right whitespace-nowrap">
                  <span className="text-base font-bold text-[hsl(var(--color-primary))]">
                    {formatCurrency(productSubtotal)}
                  </span>
                </td>
                {order.orderType === 'TRANSFER' && (
                  <>
                    <td className="px-3 py-3 text-right whitespace-nowrap">
                      <span className="text-xs text-gray-400">-</span>
                    </td>
                    <td className="px-3 py-3 text-right whitespace-nowrap">
                      <span className="text-sm font-medium text-gray-700">
                        {formatCurrency(order.costAmount)}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right whitespace-nowrap">
                      <span className="text-base font-bold text-[hsl(var(--color-success))]">
                        {formatCurrency(order.profitAmount)}
                      </span>
                    </td>
                  </>
                )}
                <td className="px-3 py-3">
                  <span className="text-xs text-gray-400">-</span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
