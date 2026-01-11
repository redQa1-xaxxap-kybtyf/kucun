/**
 * 设置页面布局组件
 * 严格遵循全栈项目统一约定规范
 */

'use client';

import * as React from 'react';

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface SettingsLayoutProps {
  /** 子组件 */
  children: React.ReactNode;
  /** 当前页面标题 */
  title?: string;
  /** 当前页面描述 */
  description?: string;
  /** 自定义样式类名 */
  className?: string;
}

export function SettingsLayout({
  children,
  title = '系统设置中心',
  description = '管理全站核心参数、用户权限与审计日志',
  className,
}: SettingsLayoutProps) {
  return (
    <div className={cn('min-h-full w-full space-y-10 p-6 lg:p-10', className)}>
      {/* 页面标题区 - 保持全站统一的 v3 PRO 通透感 */}
      <div className="mx-auto max-w-[1440px] px-2">
        <div className="space-y-2">
          <h1 className="text-3xl font-black tracking-tight text-slate-900">{title}</h1>
          <div className="flex items-center gap-3">
             <div className="h-4 w-1 rounded-full bg-blue-500 shadow-[0_2px_8px_rgba(59,130,246,0.3)]" />
             <p className="text-sm font-medium text-slate-500">{description}</p>
          </div>
        </div>
      </div>

      {/* 主内容区域 - 移除冗余 aside，直接占据主视野 */}
      <div className="mx-auto max-w-[1440px]">
        {children}
      </div>
    </div>
  );
}

interface SettingsCardProps {
  /** 卡片标题 */
  title: string;
  /** 卡片描述 */
  description?: string;
  /** 卡片图标 */
  icon?: React.ComponentType<{ className?: string }>;
  /** 子组件 */
  children: React.ReactNode;
  /** 自定义样式类名 */
  className?: string;
}

export interface SettingsSectionProps {
  /** 章节标题 */
  title: string;
  /** 章节描述 */
  description?: string;
  /** 子组件 */
  children: React.ReactNode;
  /** 自定义样式类名 */
  className?: string;
}

/**
 * 设置章节组件
 * 为设置表单提供逻辑清晰的高清分区
 */
export function SettingsSection({
  title,
  description,
  children,
  className,
}: SettingsSectionProps) {
  return (
    <div className={cn('rounded-2xl border border-slate-100 bg-slate-50/50 p-6', className)}>
      <div className="mb-6 flex items-start gap-3">
        <div className="mt-1 h-4 w-1 rounded-full bg-blue-500" />
        <div className="space-y-1">
          <h3 className="text-sm font-black tracking-tight text-slate-900">{title}</h3>
          {description && (
            <p className="text-[11px] font-medium text-slate-500 leading-relaxed max-w-2xl">{description}</p>
          )}
        </div>
      </div>
      <div className="space-y-6">{children}</div>
    </div>
  );
}

/**
 * 设置卡片组件
 * 为设置页面提供统一的高清卡片样式
 */
export function SettingsCard({
  title,
  description,
  icon: IconComponent,
  children,
  className,
}: SettingsCardProps) {
  return (
    <Card className={cn('overflow-hidden border-slate-200/60 shadow-sm transition-all hover:shadow-md', className)}>
      <CardHeader className="border-b border-slate-50 bg-slate-50/30 pb-4">
        <div className="flex items-center gap-3">
          {IconComponent && (
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-100/50">
              <IconComponent className="h-5 w-5" />
            </div>
          )}
          <div className="space-y-0.5">
            <CardTitle className="text-base font-bold text-slate-900">{title}</CardTitle>
            {description && <CardDescription className="text-[11px] leading-none text-slate-500">{description}</CardDescription>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6">{children}</CardContent>
    </Card>
  );
}
