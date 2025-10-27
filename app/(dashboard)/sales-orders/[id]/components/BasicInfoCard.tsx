"use client";

import { ShoppingCart } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SALES_ORDER_STATUS_LABELS, TRANSFER_MODE_LABELS } from "@/lib/types/sales-order";
import { getSalesOrderStatusBadgeVariant } from "@/lib/utils/badge-helpers";
import { formatDateTime } from "@/lib/utils/datetime";

import type { SalesOrderDetail } from "./types";

export function BasicInfoCard({ order }: { order: SalesOrderDetail }) {
  const customerName = order.customer?.name ?? "未关联客户";
  const customerPhone = order.customer?.phone ?? "-";
  const userName = order.user?.name ?? "-";

  const getOrderTypeBadge = (orderType: string) =>
    orderType === "TRANSFER" ? (
      <Badge variant="secondary">调货销售</Badge>
    ) : (
      <Badge variant="outline">正常销售</Badge>
    );
  const getTransferModeBadge = (mode: string | undefined) => {
    const label = mode === "MIXED" ? TRANSFER_MODE_LABELS.MIXED : TRANSFER_MODE_LABELS.SUPPLIER_ONLY;
    return mode === "MIXED" ? (
      <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-700">
        {label}
      </Badge>
    ) : (
      <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
        {label}
      </Badge>
    );
  };

  return (
    <Card className="overflow-hidden border border-[hsl(var(--color-border-primary))]" style={{ boxShadow: "var(--shadow-medium)" }}>
      <CardHeader className="border-b border-[hsl(var(--color-border-secondary))] bg-[hsl(var(--color-bg-secondary))] py-3">
        <CardTitle className="flex items-center text-base text-[hsl(var(--color-text-primary))]">
          <ShoppingCart className="mr-2 h-4 w-4 text-[hsl(var(--color-primary))]" />
          基本信息
        </CardTitle>
      </CardHeader>
      <CardContent className="bg-[hsl(var(--color-bg-card))] p-6">
        <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="text-xs font-medium text-[hsl(var(--color-text-tertiary))]">客户名称</div>
            <div className="mt-2 font-medium text-[hsl(var(--color-text-primary))]">{customerName}</div>
          </div>
          <div>
            <div className="text-xs font-medium text-[hsl(var(--color-text-tertiary))]">客户电话</div>
            <div className="mt-2 text-sm text-[hsl(var(--color-text-secondary))]">{customerPhone}</div>
          </div>
          <div>
            <div className="text-xs font-medium text-[hsl(var(--color-text-tertiary))]">订单状态</div>
            <div className="mt-2">
              <Badge variant={getSalesOrderStatusBadgeVariant(order.status)} className="text-xs">
                {SALES_ORDER_STATUS_LABELS[order.status as keyof typeof SALES_ORDER_STATUS_LABELS] || order.status}
              </Badge>
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-[hsl(var(--color-text-tertiary))]">订单类型</div>
            <div className="mt-2 space-y-1">
              {getOrderTypeBadge(order.orderType)}
              {order.orderType === "TRANSFER" && <div>{getTransferModeBadge(order.transferMode)}</div>}
            </div>
          </div>
          {order.supplier && (
            <div>
              <div className="text-xs font-medium text-[hsl(var(--color-text-tertiary))]">供应商</div>
              <div className="mt-2 text-sm text-[hsl(var(--color-text-secondary))]">{order.supplier.name}</div>
            </div>
          )}
          <div>
            <div className="text-xs font-medium text-[hsl(var(--color-text-tertiary))]">创建人</div>
            <div className="mt-2 text-sm text-[hsl(var(--color-text-secondary))]">{userName}</div>
          </div>
          <div>
            <div className="text-xs font-medium text-[hsl(var(--color-text-tertiary))]">创建时间</div>
            <div className="mt-2 text-sm text-[hsl(var(--color-text-secondary))]">{formatDateTime(order.createdAt)}</div>
          </div>
          {order.shippedAt && (
            <div>
              <div className="text-xs font-medium text-[hsl(var(--color-text-tertiary))]">发货时间</div>
              <div className="mt-2 text-sm font-medium text-[hsl(var(--color-primary))]">{formatDateTime(order.shippedAt)}</div>
            </div>
          )}
          <div>
            <div className="text-xs font-medium text-[hsl(var(--color-text-tertiary))]">更新时间</div>
            <div className="mt-2 text-sm text-[hsl(var(--color-text-secondary))]">{formatDateTime(order.updatedAt)}</div>
          </div>
        </div>
        {order.remarks && (
          <div className="mt-4 rounded-lg border border-[hsl(var(--color-border-secondary))] bg-[hsl(var(--color-bg-secondary))] p-4">
            <div className="text-xs font-medium text-[hsl(var(--color-text-tertiary))]">备注信息</div>
            <div className="mt-2 text-sm text-[hsl(var(--color-text-secondary))]">{order.remarks}</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

