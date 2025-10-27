"use client";

import { Receipt } from "lucide-react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RETURN_ORDER_STATUS_LABELS, RETURN_ORDER_STATUS_VARIANTS, type ReturnOrderStatus } from "@/lib/types/return-order";
import { formatDate } from "@/lib/utils/datetime";

import type { SalesOrderDetail } from "./types";

export function RelatedReturnOrdersCard({ order }: { order: SalesOrderDetail }) {
  const router = useRouter();
  const relatedReturnOrders = order.returnOrders ?? [];
  if (relatedReturnOrders.length === 0) return null;

  const isReturnOrderStatus = (value: unknown): value is ReturnOrderStatus =>
    typeof value === "string" && value in RETURN_ORDER_STATUS_LABELS;

  return (
    <Card className="overflow-hidden border border-[hsl(var(--color-border-primary))]" style={{ boxShadow: "var(--shadow-medium)" }}>
      <CardHeader className="border-b border-[hsl(var(--color-border-secondary))] bg-[hsl(var(--color-bg-secondary))] py-3">
        <CardTitle className="flex items-center text-base text-[hsl(var(--color-text-primary))]">
          <Receipt className="mr-2 h-4 w-4 text-[hsl(var(--color-primary))]" />
          关联退货单
        </CardTitle>
      </CardHeader>
      <CardContent className="bg-[hsl(var(--color-bg-card))] p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-[hsl(var(--color-border-secondary))] bg-[hsl(var(--color-bg-secondary))] text-xs text-[hsl(var(--color-text-secondary))]">
              <tr>
                <th className="px-4 py-3 text-left font-medium">退货单号</th>
                <th className="px-4 py-3 text-left font-medium">状态</th>
                <th className="px-4 py-3 text-left font-medium">创建时间</th>
                <th className="px-4 py-3 text-center font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[hsl(var(--color-border-secondary))]">
              {relatedReturnOrders.map(returnOrder => {
                const status = isReturnOrderStatus(returnOrder.status) ? returnOrder.status : "draft";
                return (
                  <tr key={returnOrder.id} className="text-[hsl(var(--color-text-primary))]">
                    <td className="px-4 py-3 font-mono text-[hsl(var(--color-primary))]">{returnOrder.returnNumber}</td>
                    <td className="px-4 py-3">
                      <Badge variant={RETURN_ORDER_STATUS_VARIANTS[status] ?? "secondary"} className="text-xs">
                        {RETURN_ORDER_STATUS_LABELS[status] ?? status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-[hsl(var(--color-text-secondary))]">{formatDate(returnOrder.createdAt)}</td>
                    <td className="px-4 py-3 text-center">
                      <Button
                        variant="link"
                        size="sm"
                        className="px-0 text-[hsl(var(--color-primary))]"
                        onClick={() => router.push(`/return-orders/${returnOrder.id}`)}
                      >
                        查看详情
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
