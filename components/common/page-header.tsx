/**
 * 统一的页面标题组件
 * 用于所有列表页面的标题区域
 * 遵循ERP色彩系统规范
 *
 * 设计原则:
 * - 使用克制的后台标题区
 * - 保持清晰的标题、描述和操作入口
 * - 避免营销化渐变、大阴影和过度装饰
 */

import * as React from 'react';

import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  /** 页面标题 */
  title: string;
  /** 页面描述 */
  description: React.ReactNode;
  /** 图标元素 */
  icon?: React.ReactNode;
  /** 操作按钮区域 */
  actions?: React.ReactNode;
  /** 样式变体 */
  variant?: 'gradient' | 'solid';
  /** 图标背景色 (CSS变量名或颜色值) */
  iconBgColor?: string;
  /** 是否显示边框 */
  showBorder?: boolean;
  /** 自定义className */
  className?: string;
}

/**
 * 页面标题组件
 *
 * @example
 * ```tsx
 * <PageHeader
 *   title="客户管理"
 *   description="管理客户信息，跟踪客户订单和交易记录"
 *   icon={<Users className="h-6 w-6 text-white" />}
 *   iconBgColor="hsl(var(--color-purple))"
 *   actions={
 *     <>
 *       <Button variant="outline">导出</Button>
 *       <Button>新建客户</Button>
 *     </>
 *   }
 * />
 * ```
 */
export function PageHeader({
  title,
  description,
  icon,
  actions,
  variant = 'solid',
  iconBgColor = 'hsl(var(--color-primary))',
  showBorder = true,
  className,
}: PageHeaderProps) {
  return (
    <Card
      className={cn(
        'overflow-hidden rounded-md shadow-sm',
        showBorder
          ? 'border border-[hsl(var(--color-border-primary))]'
          : 'border-none',
        className
      )}
    >
      <CardContent
        className={cn(
          'p-4 sm:p-6',
          variant === 'gradient' && 'bg-[hsl(var(--color-bg-secondary))]',
          variant === 'solid' && 'bg-[hsl(var(--color-bg-secondary))]'
        )}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 sm:gap-4">
            {icon && (
              <div
                className={cn(
                  'flex h-10 w-10 flex-shrink-0 sm:h-12 sm:w-12',
                  'items-center justify-center',
                  'rounded-md text-white shadow-sm'
                )}
                style={{
                  backgroundColor: iconBgColor,
                }}
              >
                {icon}
              </div>
            )}

            {/* 标题和描述 */}
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-bold tracking-tight text-[hsl(var(--color-text-primary))] sm:text-2xl">
                {title}
              </h1>
              <div className="mt-1 text-xs text-[hsl(var(--color-text-secondary))] sm:text-sm">
                {description}
              </div>
            </div>
          </div>

          {/* 操作按钮区域 */}
          {actions && (
            <div className="flex w-full flex-col items-stretch justify-start gap-2 [&>*]:w-full sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:[&>*]:w-auto">
              {actions}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
