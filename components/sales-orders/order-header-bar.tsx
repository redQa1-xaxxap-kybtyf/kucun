'use client';

import { FileText, Tag, User } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import type { Customer } from '@/lib/types/customer';
import {
  SALES_ORDER_TYPE_LABELS,
  type SalesOrderStatus,
} from '@/lib/types/sales-order';

interface OrderHeaderBarProps {
  orderNumber?: string;
  customer?: Customer | null;
  orderType: 'NORMAL' | 'TRANSFER';
  totalAmount: number;
  status?: SalesOrderStatus;
}

/**
 * 销售订单顶部固定栏
 *
 * 显示订单关键信息:
 * - 订单号
 * - 客户名称
 * - 订单类型
 * - 订单总金额
 * - 订单状态
 *
 * 设计理念:
 * - 采用sticky定位,滚动时始终可见
 * - 使用固定栏，符合业务单据操作习惯
 * - 信息布局参考用友/金蝶的单据头设计
 */
export function OrderHeaderBar({
  orderNumber,
  customer,
  orderType,
  totalAmount,
  status,
}: OrderHeaderBarProps) {
  return (
    <div className="sticky top-0 z-10 border-b bg-white px-4 py-2.5 text-slate-900 shadow-sm">
      <div className="flex items-center justify-between">
        {/* 左侧: 订单号 + 客户 + 订单类型 */}
        <div className="flex items-center gap-4">
          {/* 订单号 */}
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <span className="font-mono text-sm font-semibold">
              {orderNumber || '新订单'}
            </span>
          </div>

          <div className="h-4 w-px bg-slate-200" />

          {/* 客户名称 */}
          <div className="flex items-center gap-2">
            <User className="h-4 w-4" />
            <span className="text-sm">
              {customer ? (
                customer.name
              ) : (
                <span className="text-slate-400">请选择客户</span>
              )}
            </span>
          </div>

          <div className="h-4 w-px bg-slate-200" />

          {/* 订单类型 */}
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4" />
            <span className="text-sm">
              {SALES_ORDER_TYPE_LABELS[orderType]}
            </span>
          </div>
        </div>

        {/* 右侧: 金额汇总 + 状态 */}
        <div className="flex items-center gap-6">
          {/* 订单金额 */}
          <div className="text-right">
            <div className="text-xs text-slate-500">订单金额</div>
            <div className="font-mono text-lg font-bold">
              ¥
              {totalAmount.toLocaleString('zh-CN', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
          </div>

          {/* 订单状态 */}
          {status && (
            <Badge
              variant={
                status === 'confirmed'
                  ? 'default'
                  : status === 'draft'
                    ? 'secondary'
                    : 'outline'
              }
              className="bg-slate-100 text-slate-700 hover:bg-slate-100"
            >
              {status === 'draft'
                ? '草稿'
                : status === 'confirmed'
                  ? '已确认'
                  : status === 'shipped'
                    ? '已发货'
                    : status === 'completed'
                      ? '已完成'
                      : '已取消'}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}
