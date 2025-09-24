'use client';

import {
  Calendar,
  DollarSign,
  Hash,
  MapPin,
  Phone,
  ShoppingCart,
  User,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

interface Customer {
  id: string;
  name: string;
  phone?: string;
  address?: string;
}

interface OrderStatusBarProps {
  orderNumber?: string;
  customer?: Customer;
  status?: string;
  totalAmount?: number;
  itemCount?: number;
  className?: string;
}

/**
 * 订单状态栏组件
 * 显示订单的关键信息，采用水平布局
 */
export function OrderStatusBar({
  orderNumber,
  customer,
  status = 'draft',
  totalAmount = 0,
  itemCount = 0,
  className,
}: OrderStatusBarProps) {
  // 状态显示配置
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'draft':
        return { label: '草稿', variant: 'secondary' as const };
      case 'pending':
        return { label: '待确认', variant: 'outline' as const };
      case 'confirmed':
        return { label: '已确认', variant: 'default' as const };
      case 'shipped':
        return { label: '已发货', variant: 'default' as const };
      case 'delivered':
        return { label: '已送达', variant: 'default' as const };
      case 'cancelled':
        return { label: '已取消', variant: 'destructive' as const };
      default:
        return { label: '未知', variant: 'secondary' as const };
    }
  };

  const statusConfig = getStatusConfig(status);

  // 格式化金额
  const formatAmount = (amount: number) =>
    new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: 'CNY',
      minimumFractionDigits: 2,
    }).format(amount);

  return (
    <Card className={cn('mb-6 p-4', className)}>
      <div className="flex flex-wrap items-center gap-4 md:gap-6">
        {/* 订单号 */}
        <div className="flex items-center gap-2">
          <Hash className="h-4 w-4 text-muted-foreground" />
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">订单号</div>
            <div className="font-medium">{orderNumber || '待生成'}</div>
          </div>
        </div>

        <Separator orientation="vertical" className="hidden h-8 md:block" />

        {/* 客户信息 */}
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-muted-foreground" />
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">客户</div>
            <div className="font-medium">{customer?.name || '未选择客户'}</div>
            {customer?.phone && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Phone className="h-3 w-3" />
                {customer.phone}
              </div>
            )}
          </div>
        </div>

        {/* 客户地址（移动端隐藏） */}
        {customer?.address && (
          <>
            <Separator orientation="vertical" className="hidden h-8 lg:block" />
            <div className="hidden items-center gap-2 lg:flex">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">地址</div>
                <div className="max-w-[200px] truncate font-medium">
                  {customer.address}
                </div>
              </div>
            </div>
          </>
        )}

        <Separator orientation="vertical" className="hidden h-8 md:block" />

        {/* 订单状态 */}
        <div className="flex items-center gap-2">
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">状态</div>
            <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
          </div>
        </div>

        <Separator orientation="vertical" className="hidden h-8 md:block" />

        {/* 产品数量 */}
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">产品数量</div>
            <div className="font-medium">{itemCount} 项</div>
          </div>
        </div>

        <Separator orientation="vertical" className="hidden h-8 md:block" />

        {/* 订单总金额 */}
        <div className="flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-muted-foreground" />
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">订单金额</div>
            <div className="text-lg font-medium">
              {formatAmount(totalAmount)}
            </div>
          </div>
        </div>

        {/* 创建时间（桌面端显示） */}
        <div className="ml-auto hidden items-center gap-2 xl:flex">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">创建时间</div>
            <div className="font-medium">
              {new Date().toLocaleDateString('zh-CN')}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
