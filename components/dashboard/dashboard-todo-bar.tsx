'use client';

import { ArrowRight, Package, ShoppingCart } from 'lucide-react';

import { Button } from '@/components/ui/button';
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
      title: '库存异常',
      count: lowStockItems,
      label: '个产品触发预警',
      icon: Package,
      action: onViewInventory,
      color: 'bg-rose-500',
      text: 'text-rose-500',
      bg: 'bg-rose-50/50',
      show: lowStockItems > 0,
    },
    {
      id: 'pending-orders',
      title: '待处理',
      count: pendingOrderCount,
      label: '个订单待确认或发货',
      icon: ShoppingCart,
      action: onViewOrders,
      color: 'bg-amber-500',
      text: 'text-amber-500',
      bg: 'bg-amber-50/50',
      show: pendingOrderCount > 0,
    },
  ];

  const activeTodos = todos.filter(t => t.show);

  if (activeTodos.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {activeTodos.map(todo => (
        <div
          key={todo.id}
          data-testid={`dashboard-todo-${todo.id}`}
          className={cn(
            'group relative overflow-hidden rounded-md border border-white p-1 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-200/50',
            todo.bg
          )}
        >
          <div className="flex items-center justify-between rounded-md bg-card p-5">
            <div className="flex items-center gap-5">
              <div
                className={cn(
                  'flex h-14 w-14 items-center justify-center rounded-2xl shadow-lg transition-all duration-500 group-hover:scale-110 group-hover:rotate-3',
                  todo.color
                )}
              >
                <todo.icon className="h-6 w-6 text-white" />
              </div>
              <div className="space-y-0.5">
                <p className="text-xs font-semibold text-slate-500">
                  {todo.title}
                </p>
                <div className="flex items-baseline gap-2">
                  <span
                    className={cn(
                      'text-2xl font-semibold tracking-tighter',
                      todo.text
                    )}
                  >
                    {todo.count}
                  </span>
                  <span className="text-xs font-bold text-slate-400">
                    {todo.label}
                  </span>
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              size="icon"
              aria-label={`查看${todo.title}`}
              className="h-12 w-12 rounded-2xl border-slate-100 text-slate-400 transition-all hover:bg-slate-900 hover:text-white active:scale-90"
              onClick={todo.action}
            >
              <ArrowRight className="h-5 w-5" />
            </Button>
          </div>
          {/* 背景装饰轨迹 */}
          <div
            className={cn(
              'pointer-events-none absolute -right-4 -bottom-4 h-24 w-24 rounded-full opacity-5 blur-2xl',
              todo.color
            )}
          />
        </div>
      ))}
    </div>
  );
}
