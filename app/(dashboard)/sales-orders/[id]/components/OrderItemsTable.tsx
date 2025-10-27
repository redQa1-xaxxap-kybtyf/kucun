/* eslint-disable max-lines-per-function */
"use client";

import { ShoppingCart } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { formatDate } from "@/lib/utils/datetime";

import type { SalesOrderDetail } from "./types";

function formatDecimal(value: number | undefined | null): string {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "-";
  }
  if (Number.isInteger(value)) {
    return value.toString();
  }
  return value.toFixed(4).replace(/(?:\.0+|(\.\d+?)0+)$/, "$1");
}

function resolveUnitLabel(item: SalesOrderDetail["items"][number]) {
  if (item.displayUnit) return item.displayUnit;
  if (item.isManualProduct) return item.manualUnit || "-";
  return item.product?.unit || "-";
}

function formatQuantityDisplay(item: SalesOrderDetail["items"][number]) {
  if (typeof item.displayQuantity === "number") return formatDecimal(item.displayQuantity);
  return formatDecimal(item.quantity || 0);
}

function formatPiecesBreakdown(item: SalesOrderDetail["items"][number]) {
  const piecesPerUnit = item.piecesPerUnit ?? item.product?.piecesPerUnit;
  if (!piecesPerUnit || !item.quantity) return "";
  const totalPieces = piecesPerUnit * item.quantity;
  return `片数：${formatDecimal(totalPieces)}片 (${formatDecimal(piecesPerUnit)}片/件 × ${formatDecimal(item.quantity)}件)`;
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
    <Card className="overflow-hidden border border-[hsl(var(--color-border-primary))]" style={{ boxShadow: "var(--shadow-medium)" }}>
      <CardHeader className="border-b border-[hsl(var(--color-border-secondary))] bg-[hsl(var(--color-bg-secondary))] py-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center text-lg font-semibold text-[hsl(var(--color-text-primary))]">
            <div className="mr-3 flex h-9 w-9 items-center justify-center rounded-lg bg-[hsl(var(--color-primary))] shadow-sm">
              <ShoppingCart className="h-5 w-5 text-white" />
            </div>
            订单明细
          </CardTitle>
          <div className="flex items-center gap-3">
            <div className="rounded-lg border border-[hsl(var(--color-border-secondary))] bg-white px-3 py-1.5">
              <span className="text-xs text-[hsl(var(--color-text-tertiary))]">产品种类</span>
              <span className="ml-2 text-sm font-bold text-[hsl(var(--color-text-primary))]">{orderItems.length}</span>
            </div>
            <div className="rounded-lg border border-[hsl(var(--color-border-secondary))] bg-white px-3 py-1.5">
              <span className="text-xs text-[hsl(var(--color-text-tertiary))]">总数量</span>
              <span className="ml-2 text-sm font-bold text-[hsl(var(--color-text-primary))]">{formatDecimal(totalDisplayQuantity)}</span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="bg-[hsl(var(--color-bg-card))] p-0">
        <div className="overflow-x-auto rounded-b-xl border-t border-[hsl(var(--color-border-secondary))]">
          <table className="w-full text-sm text-[hsl(var(--color-text-secondary))]">
            <thead className="sticky top-0 z-10 border-b border-[hsl(var(--color-border-secondary))] bg-gradient-to-b from-white to-[hsl(var(--color-bg-secondary))] text-xs font-semibold text-[hsl(var(--color-text-secondary))] shadow-sm">
              <tr>
                <th className="px-3 py-3.5 text-left font-medium whitespace-nowrap">产品编码</th>
                <th className="px-3 py-3.5 text-left font-medium whitespace-nowrap">产品名称</th>
                <th className="px-3 py-3.5 text-left font-medium whitespace-nowrap">规格</th>
                {order.orderType !== "TRANSFER" && (
                  <th className="px-3 py-3.5 text-center font-medium whitespace-nowrap">批次/日期</th>
                )}
                <th className="min-w-[90px] px-3 py-3.5 text-center font-medium whitespace-nowrap">每件片数</th>
                <th className="px-3 py-3.5 text-center font-medium whitespace-nowrap">单位</th>
                <th className="px-3 py-3.5 text-right font-medium whitespace-nowrap">数量</th>
                {order.orderType === "TRANSFER" && (
                  <>
                    <th className="px-3 py-3.5 text-right font-medium whitespace-nowrap">本地发货</th>
                    <th className="px-3 py-3.5 text-right font-medium whitespace-nowrap">调货发货</th>
                  </>
                )}
                <th className="px-3 py-3.5 text-right font-medium whitespace-nowrap">单价</th>
                <th className="px-3 py-3.5 text-right font-medium whitespace-nowrap">小计</th>
                {order.orderType === "TRANSFER" && (
                  <>
                    <th className="px-3 py-3.5 text-right font-medium whitespace-nowrap">单位成本</th>
                    <th className="px-3 py-3.5 text-right font-medium whitespace-nowrap">成本小计</th>
                    <th className="px-3 py-3.5 text-right font-medium whitespace-nowrap">毛利</th>
                  </>
                )}
                <th className="px-3 py-3.5 text-left font-medium whitespace-nowrap">备注</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[hsl(var(--color-border-secondary))]/60 bg-white text-[hsl(var(--color-text-primary))]">
              {orderItems.map((item, index) => {
                const unitLabel = resolveUnitLabel(item);
                const quantityDisplay = formatQuantityDisplay(item);
                const piecesPerUnitDisplay = item.piecesPerUnit ?? item.product?.piecesPerUnit;
                const remarkParts: string[] = [];
                const piecesBreakdown = formatPiecesBreakdown(item);
                if (piecesBreakdown) remarkParts.push(piecesBreakdown);
                const manualRemark = typeof item.remarks === "string" ? item.remarks.trim() : "";
                if (manualRemark && manualRemark !== piecesBreakdown) remarkParts.push(manualRemark);
                if (typeof item.manualWeight === "number") {
                  remarkParts.push(`重量：${formatDecimal(item.manualWeight)}${item.manualUnit ? item.manualUnit : ""}`);
                }
                const remarkText = remarkParts.length > 0 ? remarkParts.join("；") : "-";
                const specificationText = item.isManualProduct
                  ? item.manualSpecification || item.specification || "-"
                  : item.specification || item.product?.specification || "-";
                const manualName = typeof item.manualProductName === "string" ? item.manualProductName.trim() : "";
                const manualCode = typeof item.productCode === "string" ? item.productCode.trim() : "";
                const displayProductName = item.isManualProduct ? manualName || manualCode || "临时商品" : item.product?.name || "-";
                const displayProductCode = item.isManualProduct ? manualCode || "-" : item.product?.code || "-";
                const localQuantityDisplay = formatDecimal(item.localQuantity ?? 0);
                const transferQuantityDisplay = formatDecimal(item.transferQuantity ?? 0);

                return (
                  <tr key={item.id} className="group transition-colors duration-200 hover:bg-[hsl(var(--color-bg-secondary))]">
                    <td className="px-3 py-3.5 align-top whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded bg-blue-100 text-xs font-semibold text-blue-700 group-hover:bg-blue-200">
                          {index + 1}
                        </div>
                        <span className="font-mono text-sm font-medium text-[hsl(var(--color-text-primary))]">{displayProductCode}</span>
                        {item.isManualProduct && (
                          <span className="rounded border border-orange-300 bg-orange-50 px-1.5 py-0.5 text-[10px] font-semibold text-orange-700">临时</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3.5 align-top whitespace-nowrap">
                      <span className="text-sm font-medium text-[hsl(var(--color-text-primary))]">{displayProductName}</span>
                    </td>
                    <td className="px-3 py-3.5 align-top whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-[hsl(var(--color-text-secondary))]">{specificationText}</span>
                        {item.colorCode && (
                          <span className="inline-flex items-center gap-1 rounded bg-orange-50 px-1.5 py-0.5 text-[11px] text-orange-700">
                            <div className="h-2 w-2 rounded-full bg-orange-400"></div>
                            {item.colorCode}
                          </span>
                        )}
                      </div>
                    </td>
                    {order.orderType !== "TRANSFER" && (
                      <td className="px-3 py-3.5 text-center align-top whitespace-nowrap">
                        <div className="inline-flex flex-col items-center gap-1">
                          <span className="text-xs font-medium text-purple-700">{item.batchNumber || "-"}</span>
                          {item.productionDate && <span className="text-[11px] text-gray-500">{formatDate(item.productionDate)}</span>}
                        </div>
                      </td>
                    )}
                    <td className="px-3 py-3.5 text-center align-top whitespace-nowrap">
                      <span className="text-sm font-medium text-[hsl(var(--color-text-secondary))]">
                        {typeof piecesPerUnitDisplay === "number" ? formatDecimal(piecesPerUnitDisplay) : "-"}
                      </span>
                    </td>
                    <td className="px-3 py-3.5 text-center align-top whitespace-nowrap">
                      <span className="text-sm text-[hsl(var(--color-text-secondary))]">{unitLabel || "-"}</span>
                    </td>
                    <td className="px-3 py-3.5 text-right align-top whitespace-nowrap">
                      <span className="text-sm font-semibold text-[hsl(var(--color-text-primary))]">{quantityDisplay}</span>
                    </td>
                    {order.orderType === "TRANSFER" && (
                      <>
                        <td className="px-3 py-3.5 text-right align-top whitespace-nowrap">
                          <span className="text-sm font-medium text-[hsl(var(--color-text-secondary))]">{localQuantityDisplay}</span>
                        </td>
                        <td className="px-3 py-3.5 text-right align-top whitespace-nowrap">
                          <span className="text-sm font-medium text-[hsl(var(--color-text-secondary))]">{transferQuantityDisplay}</span>
                        </td>
                      </>
                    )}
                    <td className="px-3 py-3.5 text-right align-top whitespace-nowrap">
                      <span className="text-sm font-medium text-[hsl(var(--color-text-secondary))]">{formatCurrency(item.unitPrice)}</span>
                    </td>
                    <td className="px-3 py-3.5 text-right align-top whitespace-nowrap">
                      <span className="text-sm font-bold text-[hsl(var(--color-text-primary))]">{formatCurrency(item.subtotal)}</span>
                    </td>
                    {order.orderType === "TRANSFER" && (
                      <>
                        <td className="px-3 py-3.5 text-right align-top whitespace-nowrap">
                          <span className="text-sm text-[hsl(var(--color-text-secondary))]">{item.unitCost ? formatCurrency(item.unitCost) : "-"}</span>
                        </td>
                        <td className="px-3 py-3.5 text-right align-top whitespace-nowrap">
                          <span className="text-sm font-medium text-[hsl(var(--color-text-secondary))]">{item.costSubtotal ? formatCurrency(item.costSubtotal) : "-"}</span>
                        </td>
                        <td className="px-3 py-3.5 text-right align-top whitespace-nowrap">
                          <span className="text-sm font-bold text-[hsl(var(--color-success))]">{item.profitAmount ? formatCurrency(item.profitAmount) : "-"}</span>
                        </td>
                      </>
                    )}
                    <td className="px-3 py-3.5 align-top">
                      <div className="max-w-xs text-xs text-[hsl(var(--color-text-tertiary))]">
                        {remarkText !== "-" ? (
                          <div className="whitespace-normal break-words rounded-md border border-[hsl(var(--color-border-secondary))] bg-[hsl(var(--color-bg-tertiary))] px-2 py-1">
                            {remarkText}
                          </div>
                        ) : (
                          <span className="text-[hsl(var(--color-text-tertiary))]">-</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t-2 border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-secondary))]">
              <tr className="font-semibold">
                <td colSpan={order.orderType === "TRANSFER" ? 3 : 4} className="px-3 py-4 text-right text-[hsl(var(--color-text-primary))]">
                  <span className="text-base">产品小计</span>
                </td>
                <td className="px-3 py-4 text-center whitespace-nowrap">
                  <span className="text-xs text-[hsl(var(--color-text-tertiary))]">-</span>
                </td>
                <td className="px-3 py-4 text-center whitespace-nowrap">
                  <span className="text-xs text-[hsl(var(--color-text-tertiary))]">-</span>
                </td>
                <td className="px-3 py-4 text-right whitespace-nowrap">
                  <span className="text-sm font-bold text-[hsl(var(--color-text-primary))]">{formatDecimal(totalDisplayQuantity)}</span>
                </td>
                {order.orderType === "TRANSFER" && (
                  <>
                    <td className="px-3 py-4 text-right whitespace-nowrap">
                      <span className="text-sm font-medium text-[hsl(var(--color-text-secondary))]">{formatDecimal(totalLocalQuantity)}</span>
                    </td>
                    <td className="px-3 py-4 text-right whitespace-nowrap">
                      <span className="text-sm font-medium text-[hsl(var(--color-text-secondary))]">{formatDecimal(totalTransferQuantity)}</span>
                    </td>
                  </>
                )}
                <td className="px-3 py-4 text-right whitespace-nowrap">
                  <span className="text-xs text-[hsl(var(--color-text-tertiary))]">-</span>
                </td>
                <td className="px-3 py-4 text-right whitespace-nowrap">
                  <span className="text-base font-bold text-[hsl(var(--color-text-primary))]">{formatCurrency(productSubtotal)}</span>
                </td>
                {order.orderType === "TRANSFER" && (
                  <>
                    <td className="px-3 py-4 text-right whitespace-nowrap">
                      <span className="text-xs text-[hsl(var(--color-text-tertiary))]">-</span>
                    </td>
                    <td className="px-3 py-4 text-right whitespace-nowrap">
                      <span className="text-sm font-medium text-[hsl(var(--color-text-secondary))]">{formatCurrency(order.costAmount)}</span>
                    </td>
                    <td className="px-3 py-4 text-right whitespace-nowrap">
                      <span className="text-base font-bold text-[hsl(var(--color-success))]">{formatCurrency(order.profitAmount)}</span>
                    </td>
                  </>
                )}
                <td className="px-3 py-4">
                  <span className="text-xs text-[hsl(var(--color-text-tertiary))]">-</span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
