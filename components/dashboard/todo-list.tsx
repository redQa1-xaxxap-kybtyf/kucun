// 仪表盘待办事项组件
// 展示待审核订单、库存不足提醒等待办事项

'use client';

import {
  AlertCircle,
  Calendar,
  CheckSquare,
  ExternalLink,
  Plus,
  RefreshCw,
  RotateCcw,
  ShoppingCart,
  Users,
} from 'lucide-react';
import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useCompleteTodoItem } from '@/lib/api/dashboard';
import type { TodoItem } from '@/lib/types/dashboard';
import { cn } from '@/lib/utils';
import { formatDate, formatTimeAgo } from '@/lib/utils/datetime';

// 待办事项类型配置
const TODO_TYPE_CONFIG = {
  sales_order: {
    icon: ShoppingCart,
    label: '销售订单',
    color: 'blue',
    href: '/sales-orders',
  },

  return_order: {
    icon: RotateCcw,
    label: '退货订单',
    color: 'yellow',
    href: '/return-orders',
  },
  inventory_alert: {
    icon: AlertCircle,
    label: '库存预警',
    color: 'red',
    href: '/inventory',
  },
  customer_follow_up: {
    icon: Users,
    label: '客户跟进',
    color: 'purple',
    href: '/customers',
  },
} as const;

// 优先级配置
const PRIORITY_CONFIG = {
  urgent: {
    label: '紧急',
    color: 'bg-red-100 text-red-800',
    dot: 'bg-red-500',
  },
  high: {
    label: '高',
    color: 'bg-orange-100 text-orange-800',
    dot: 'bg-orange-500',
  },
  medium: {
    label: '中',
    color: 'bg-yellow-100 text-yellow-800',
    dot: 'bg-yellow-500',
  },
  low: {
    label: '低',
    color: 'bg-green-100 text-green-800',
    dot: 'bg-green-500',
  },
} as const;

export interface TodoItemProps {
  todo: TodoItem;
  onComplete?: (todoId: string) => void;
  onView?: (todo: TodoItem) => void;
  compact?: boolean;
  showCheckbox?: boolean;
  className?: string;
}

const TodoItemComponent = React.forwardRef<HTMLDivElement, TodoItemProps>(
  (
    {
      todo,
      onComplete,
      onView,
      compact = false,
      showCheckbox = true,
      className,
      ...props
    },
    ref
  ) => {
    const typeConfig = TODO_TYPE_CONFIG[todo.type];
    const priorityConfig = PRIORITY_CONFIG[todo.priority];
    const IconComponent = typeConfig.icon;

    const isOverdue = todo.dueDate && new Date(todo.dueDate) < new Date();
    const isDueSoon =
      todo.dueDate &&
      new Date(todo.dueDate) <= new Date(Date.now() + 24 * 60 * 60 * 1000) &&
      !isOverdue;

    if (compact) {
      return (
        <div
          className={cn(
            'flex items-center space-x-3 rounded-lg border bg-card p-3',
            todo.status === 'completed' && 'opacity-60',
            className
          )}
          ref={ref}
          {...props}
        >
          {showCheckbox && (
            <Checkbox
              checked={todo.status === 'completed'}
              onCheckedChange={() => onComplete?.(todo.id)}
              className="flex-shrink-0"
            />
          )}

          <div className="flex flex-shrink-0 items-center space-x-2">
            <IconComponent
              className={cn('h-4 w-4', `text-${typeConfig.color}-500`)}
            />
            <div className={cn('h-2 w-2 rounded-full', priorityConfig.dot)} />
          </div>

          <div className="min-w-0 flex-1">
            <p
              className={cn(
                'truncate text-sm font-medium',
                todo.status === 'completed' && 'line-through'
              )}
            >
              {todo.title}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {todo.description}
            </p>
          </div>

          <div className="flex flex-shrink-0 items-center space-x-2">
            {todo.dueDate && (
              <Badge
                variant="outline"
                className={cn(
                  'text-xs',
                  isOverdue && 'border-red-200 text-red-700',
                  isDueSoon && 'border-yellow-200 text-yellow-700'
                )}
              >
                {isOverdue ? '已逾期' : isDueSoon ? '即将到期' : '待处理'}
              </Badge>
            )}
            {onView && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onView(todo)}
                className="h-6 w-6 p-0"
              >
                <ExternalLink className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      );
    }

    return (
      <div
        className={cn(
          'rounded-lg border bg-card p-4 transition-colors',
          todo.status === 'completed' && 'opacity-60',
          className
        )}
        ref={ref}
        {...props}
      >
        <div className="flex items-start space-x-3">
          {showCheckbox && (
            <Checkbox
              checked={todo.status === 'completed'}
              onCheckedChange={() => onComplete?.(todo.id)}
              className="mt-1 flex-shrink-0"
            />
          )}

          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-start justify-between">
              <div className="flex min-w-0 flex-1 items-center space-x-2">
                <IconComponent
                  className={cn(
                    'h-4 w-4 flex-shrink-0',
                    `text-${typeConfig.color}-500`
                  )}
                />
                <h4
                  className={cn(
                    'text-sm font-medium',
                    todo.status === 'completed' && 'line-through'
                  )}
                >
                  {todo.title}
                </h4>
                <Badge
                  variant="outline"
                  className={cn('text-xs', priorityConfig.color)}
                >
                  {priorityConfig.label}
                </Badge>
              </div>

              {onView && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onView(todo)}
                  className="h-8 w-8 flex-shrink-0 p-0"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              )}
            </div>

            <p className="text-sm text-muted-foreground">{todo.description}</p>

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center space-x-4">
                <span>{typeConfig.label}</span>
                {todo.dueDate && (
                  <div className="flex items-center space-x-1">
                    <Calendar className="h-3 w-3" />
                    <span
                      className={cn(
                        isOverdue && 'text-red-600',
                        isDueSoon && 'text-yellow-600'
                      )}
                    >
                      {formatDate(todo.dueDate)}
                    </span>
                  </div>
                )}
              </div>

              <span>{formatTimeAgo(todo.createdAt)}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

TodoItemComponent.displayName = 'TodoItemComponent';

export interface TodoListProps {
  todos: TodoItem[];
  loading?: boolean;
  onRefresh?: () => void;
  onCompleteTodo?: (todoId: string) => void;
  onViewTodo?: (todo: TodoItem) => void;
  onAddTodo?: () => void;
  maxHeight?: string;
  showHeader?: boolean;
  compact?: boolean;
  showCompleted?: boolean;
  className?: string;
}

const TodoList = React.forwardRef<HTMLDivElement, TodoListProps>(
  (
    {
      todos,
      loading = false,
      onRefresh,
      onCompleteTodo,
      onViewTodo,
      onAddTodo,
      maxHeight = '400px',
      showHeader = true,
      compact = false,
      showCompleted = false,
      className,
      ...props
    },
    ref
  ) => {
    const completeMutation = useCompleteTodoItem();

    // 处理完成待办事项
    const handleComplete = (todoId: string) => {
      completeMutation.mutate(todoId);
      onCompleteTodo?.(todoId);
    };

    // 处理查看待办事项
    const handleView = (todo: TodoItem) => {
      const typeConfig = TODO_TYPE_CONFIG[todo.type];
      const href = todo.relatedId
        ? `${typeConfig.href}/${todo.relatedId}`
        : typeConfig.href;

      // 如果有自定义处理函数，使用自定义函数
      if (onViewTodo) {
        onViewTodo(todo);
      } else {
        // 否则跳转到相关页面
        window.open(href, '_blank');
      }
    };

    // 筛选待办事项
    const filteredTodos = React.useMemo(() => {
      let filtered = todos;

      if (!showCompleted) {
        filtered = filtered.filter(todo => todo.status !== 'completed');
      }

      // 按优先级和创建时间排序
      return filtered.sort((a, b) => {
        const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
        const priorityDiff =
          priorityOrder[b.priority] - priorityOrder[a.priority];
        if (priorityDiff !== 0) return priorityDiff;

        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      });
    }, [todos, showCompleted]);

    // 统计信息
    const todoStats = React.useMemo(() => {
      const stats = {
        total: todos.length,
        pending: 0,
        completed: 0,
        overdue: 0,
        urgent: 0,
      };

      todos.forEach(todo => {
        if (todo.status === 'completed') {
          stats.completed++;
        } else {
          stats.pending++;
          if (todo.priority === 'urgent') stats.urgent++;
          if (todo.dueDate && new Date(todo.dueDate) < new Date()) {
            stats.overdue++;
          }
        }
      });

      return stats;
    }, [todos]);

    if (loading) {
      return (
        <Card className={className} ref={ref} {...props}>
          {showHeader && (
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <Skeleton className="mb-2 h-5 w-24" />
                  <Skeleton className="h-4 w-32" />
                </div>
                <div className="flex space-x-2">
                  <Skeleton className="h-8 w-8" />
                  <Skeleton className="h-8 w-8" />
                </div>
              </div>
            </CardHeader>
          )}
          <CardContent>
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-lg border p-3">
                  <div className="flex items-center space-x-3">
                    <Skeleton className="h-4 w-4" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                    <Skeleton className="h-6 w-12" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card className={className} ref={ref} {...props}>
        {showHeader && (
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center space-x-2">
                  <CheckSquare className="h-5 w-5" />
                  <span>待办事项</span>
                  {todoStats.pending > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {todoStats.pending}
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  {todoStats.urgent > 0 && `${todoStats.urgent} 紧急`}
                  {todoStats.overdue > 0 &&
                    `${todoStats.urgent > 0 ? ', ' : ''}${todoStats.overdue} 逾期`}
                  {todoStats.pending === 0 && '暂无待办事项'}
                </CardDescription>
              </div>
              <div className="flex items-center space-x-2">
                {onAddTodo && (
                  <Button variant="outline" size="sm" onClick={onAddTodo}>
                    <Plus className="h-4 w-4" />
                  </Button>
                )}
                {onRefresh && (
                  <Button variant="outline" size="sm" onClick={onRefresh}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
        )}

        <CardContent>
          {filteredTodos.length === 0 ? (
            <div className="py-8 text-center">
              <CheckSquare className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <p className="text-muted-foreground">
                {showCompleted ? '暂无待办事项' : '暂无未完成的待办事项'}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {showCompleted ? '添加新的待办事项' : '所有任务已完成'}
              </p>
            </div>
          ) : (
            <ScrollArea style={{ maxHeight }}>
              <div className={cn('space-y-3', compact && 'space-y-2')}>
                {filteredTodos.map(todo => (
                  <TodoItemComponent
                    key={todo.id}
                    todo={todo}
                    onComplete={handleComplete}
                    onView={handleView}
                    compact={compact}
                  />
                ))}
              </div>
            </ScrollArea>
          )}

          {todoStats.completed > 0 && !showCompleted && (
            <div className="mt-4 border-t pt-4 text-center">
              <p className="text-sm text-muted-foreground">
                已完成 {todoStats.completed} 个任务
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }
);

TodoList.displayName = 'TodoList';

export { TodoItemComponent, TodoList };
