"use client";

import { ArrowLeft, Edit, MoreHorizontal, Printer, Download, Truck } from "lucide-react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SALES_ORDER_STATUS_LABELS, TRANSFER_MODE_LABELS } from "@/lib/types/sales-order";
import { getSalesOrderStatusBadgeVariant } from "@/lib/utils/badge-helpers";

import type { SalesOrderDetail } from "./types";

interface Props {
  order: SalesOrderDetail;
  id: string;
  canEditOrder: boolean;
  isUpdatingStatus: boolean;
  onConfirmShipment: () => void;
  onShowToast: (title: string, description: string, variant?: "destructive" | "default") => void;
}

export function HeaderCard({ order, id, canEditOrder, isUpdatingStatus, onConfirmShipment, onShowToast }: Props) {
  const router = useRouter();

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
      <CardContent className="bg-gradient-to-r from-[hsl(var(--color-primary-light))] to-[hsl(var(--color-primary-lighter))] p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[hsl(var(--color-primary))] shadow-lg">
              {/* Icon space kept for visual parity */}
              <Truck className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[hsl(var(--color-text-primary))]">销售订单详情</h1>
              <div className="mt-1 flex items-center gap-2 text-sm text-[hsl(var(--color-text-secondary))]">
                <span className="font-medium">订单号：{order.orderNumber}</span>
                <Badge variant={getSalesOrderStatusBadgeVariant(order.status)}>
                  {SALES_ORDER_STATUS_LABELS[order.status as keyof typeof SALES_ORDER_STATUS_LABELS] || order.status}
                </Badge>
                {getOrderTypeBadge(order.orderType)}
                {order.orderType === "TRANSFER" && getTransferModeBadge(order.transferMode)}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="lg" onClick={() => router.back()} className="h-11">
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => {
                if (canEditOrder) {
                  router.push(`/sales-orders/${id}/edit`);
                } else {
                  onShowToast("无法编辑", "只有草稿状态的订单才能编辑", "destructive");
                }
              }}
              disabled={!canEditOrder}
            >
              <Edit className="mr-2 h-4 w-4" />
              编辑
            </Button>
            {order.status === "confirmed" && (
              <Button
                variant="default"
                size="lg"
                onClick={onConfirmShipment}
                disabled={isUpdatingStatus}
                className="bg-[hsl(var(--color-primary))] hover:bg-[hsl(var(--color-primary-dark))]"
              >
                <Truck className="mr-2 h-4 w-4" />
                {isUpdatingStatus ? "处理中..." : "确认发货"}
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="lg">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>
                  <Printer className="mr-2 h-4 w-4" />
                  打印订单
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Download className="mr-2 h-4 w-4" />
                  导出订单
                </DropdownMenuItem>
                <DropdownMenuItem>复制订单</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
