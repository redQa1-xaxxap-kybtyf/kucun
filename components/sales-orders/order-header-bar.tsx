'use client';

import { FileText, Tag, User } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import type { Customer } from '@/lib/types/customer';
import type { SalesOrderStatus } from '@/lib/types/sales-order';

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
 * - 使用渐变蓝色背景,符合ERP专业感
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
    <div className="sticky top-0 z-10 bg-gradient-to-r from-blue-600 to-blue-500 px-4 py-2.5 text-white shadow-md">
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

          <div className="h-4 w-px bg-white/30" />

          {/* 客户名称 */}
          <div className="flex items-center gap-2">
            <User className="h-4 w-4" />
            <span className="text-sm">
              {customer ? (
                customer.name
              ) : (
                <span className="text-white/70">请选择客户</span>
              )}
            </span>
          </div>

          <div className="h-4 w-px bg-white/30" />

          {/* 订单类型 */}
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4" />
            <span className="text-sm">
              {orderType === 'NORMAL' ? '正常销售' : '调货销售'}
            </span>
          </div>
        </div>

        {/* 右侧: 金额汇总 + 状态 */}
        <div className="flex items-center gap-6">
          {/* 订单金额 */}
          <div className="text-right">
            <div className="text-xs text-white/70">订单金额</div>
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
              className="bg-white/20 text-white hover:bg-white/30"
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
