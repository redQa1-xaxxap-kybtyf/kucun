/**
 * 统一的页面标题组件
 * 用于所有列表页面的标题区域
 * 遵循ERP色彩系统规范
 *
 * 优化特性:
 * - 增强的视觉层次和阴影效果
 * - 优化的图标设计和微动画
 * - 改进的排版和间距
 * - 响应式布局优化
 * - 统一的边框和背景样式
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
  icon: React.ReactNode;
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
        'card-shadow-medium overflow-hidden',
        showBorder
          ? 'border border-[hsl(var(--color-border-primary))]'
          : 'border-none',
        className
      )}
    >
      <CardContent
        className={cn(
          'p-6',
          variant === 'gradient' &&
            'bg-gradient-to-r from-[hsl(var(--color-primary-light))] via-[hsl(var(--color-primary-light))] to-[hsl(var(--color-primary-lighter))]',
          variant === 'solid' && 'bg-[hsl(var(--color-bg-secondary))]'
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* 图标容器 */}
            <div
              className={cn(
                'flex h-12 w-12 flex-shrink-0',
                'items-center justify-center',
                'card-shadow-light rounded-xl text-white'
              )}
              style={{
                backgroundColor: iconBgColor,
              }}
            >
              {icon}
            </div>

            {/* 标题和描述 */}
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold tracking-tight text-[hsl(var(--color-text-primary))]">
                {title}
              </h1>
              <div className="text-sm text-[hsl(var(--color-text-secondary))]">
                {description}
              </div>
            </div>
          </div>

          {/* 操作按钮区域 */}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      </CardContent>
    </Card>
  );
}
