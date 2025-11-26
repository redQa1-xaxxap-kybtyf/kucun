'use client';

import { ArrowRight, Package, ShoppingCart } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface DashboardTodoBarProps {
  lowStockItems: number;
  pendingOrderCount: number;
  onViewInventory: () => void;
  onViewOrders: () => void;
}

export function DashboardTodoBar({
  lowStockItems,
  pendingOrderCount,
  onViewInventory,
  onViewOrders,
}: DashboardTodoBarProps) {
  const todos = [
    {
      id: 'low-stock',
      title: '库存预警',
      count: lowStockItems,
      label: '个产品库存不足',
      icon: Package,
      action: onViewInventory,
      variant: 'destructive', // 红色警告
      show: lowStockItems > 0,
    },
    {
      id: 'pending-orders',
      title: '待处理订单',
      count: pendingOrderCount,
      label: '个订单待发货',
      icon: ShoppingCart,
      action: onViewOrders,
      variant: 'warning', // 橙色提醒
      show: pendingOrderCount > 0,
    },
  ];

  const activeTodos = todos.filter(t => t.show);

  if (activeTodos.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {activeTodos.map(todo => (
        <Card
          key={todo.id}
          className={cn(
            'border-l-4 shadow-sm transition-all hover:shadow-md',
            todo.variant === 'destructive'
              ? 'border-l-destructive bg-destructive/5'
              : 'border-l-orange-500 bg-orange-50'
          )}
        >
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'rounded-full p-2',
                  todo.variant === 'destructive'
                    ? 'bg-destructive/10 text-destructive'
                    : 'bg-orange-100 text-orange-600'
                )}
              >
                <todo.icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {todo.title}
                </p>
                <p
                  className={cn(
                    'text-xs font-bold',
                    todo.variant === 'destructive'
                      ? 'text-destructive'
                      : 'text-orange-600'
                  )}
                >
                  {todo.count} {todo.label}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={todo.action}
            >
              <ArrowRight className="text-muted-foreground h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
