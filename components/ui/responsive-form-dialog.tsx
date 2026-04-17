'use client';

import * as React from 'react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useMediaQuery } from '@/hooks/use-media-query';
import { cn } from '@/lib/utils';

interface ResponsiveFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** 主体内容（表单） */
  children: React.ReactNode;
  /** 底部操作按钮条 */
  footer?: React.ReactNode;
  /** 移动端 Sheet 滑入方向，默认 right（从右滑入符合 iOS 导航习惯） */
  side?: 'right' | 'bottom';
  /** PC 端 Dialog 最大宽度 className，默认 sm:max-w-2xl */
  widthClass?: string;
  /** 移动端 Sheet 是否全屏高度（仅 side=right 时生效），默认 true */
  fullHeightMobile?: boolean;
  /** 移动端断点，默认 767px（含）及以下视为移动端 */
  mobileBreakpoint?: string;
  /** 额外 className（作用于内容容器） */
  className?: string;
}

/**
 * 响应式表单弹层。
 *
 * - 桌面端（>= md）：渲染为居中 Dialog
 * - 移动端（< md）：渲染为 Sheet（抽屉），默认从右滑入并占满屏幕
 *
 * 移动端特性：
 * - 标题栏固定顶部、底部操作条固定底部、中间区域可滚动
 * - 内容区底部留出 footer 高度与 iOS safe-area-inset-bottom 空间，键盘弹起不遮挡按钮
 *
 * 注意：用 useMediaQuery 运行时判断设备 —— 首屏会有极短延迟，属预期。
 */
export function ResponsiveFormDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  side = 'right',
  widthClass = 'sm:max-w-2xl',
  fullHeightMobile = true,
  mobileBreakpoint = '(max-width: 767px)',
  className,
}: ResponsiveFormDialogProps) {
  const isMobile = useMediaQuery(mobileBreakpoint);

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side={side}
          className={cn(
            'flex w-full flex-col p-0 gap-0',
            side === 'right' &&
              fullHeightMobile &&
              'h-screen max-w-full sm:max-w-full',
            side === 'bottom' && 'h-[90vh] rounded-t-xl',
            className
          )}
        >
          <SheetHeader className="flex-shrink-0 border-b px-4 py-3 text-left">
            <SheetTitle className="text-base font-semibold">
              {title}
            </SheetTitle>
            {description ? (
              <SheetDescription className="text-xs">
                {description}
              </SheetDescription>
            ) : null}
          </SheetHeader>

          <div
            className={cn(
              'flex-1 overflow-y-auto px-4 py-4',
              footer
                ? 'pb-[calc(env(safe-area-inset-bottom)+88px)]'
                : 'pb-[calc(env(safe-area-inset-bottom)+16px)]'
            )}
          >
            {children}
          </div>

          {footer ? (
            <SheetFooter
              className={cn(
                'sticky bottom-0 flex-shrink-0 flex-row items-center justify-end gap-2 border-t bg-background px-4 py-3',
                'pb-[calc(env(safe-area-inset-bottom)+12px)]'
              )}
            >
              {footer}
            </SheetFooter>
          ) : null}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(widthClass, 'max-h-[85vh] overflow-y-auto', className)}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? (
            <DialogDescription>{description}</DialogDescription>
          ) : null}
        </DialogHeader>
        {children}
        {footer ? <DialogFooter>{footer}</DialogFooter> : null}
      </DialogContent>
    </Dialog>
  );
}
