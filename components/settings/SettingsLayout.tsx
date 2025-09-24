/**
 * 设置页面布局组件
 * 严格遵循全栈项目统一约定规范
 */

'use client';

import { Package, Receipt, Settings, Users } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as React from 'react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

// 设置导航项配置
const settingsNavItems = [
  {
    id: 'basic',
    title: '基本设置',
    href: '/settings/basic',
    icon: Settings,
    description: '公司信息、系统配置',
    available: true,
  },
  {
    id: 'users',
    title: '用户管理',
    href: '/settings/users',
    icon: Users,
    description: '用户账户、权限配置',
    available: true,
  },
  {
    id: 'storage',
    title: '七牛云存储',
    href: '/settings/storage',
    icon: Package,
    description: '文件上传、存储配置',
    available: true,
  },
  {
    id: 'logs',
    title: '系统日志',
    href: '/settings/logs',
    icon: Receipt,
    description: '日志管理、审计配置',
    available: true,
  },
];

interface SettingsLayoutProps {
  /** 子组件 */
  children: React.ReactNode;
  /** 当前页面标题 */
  title?: string;
  /** 当前页面描述 */
  description?: string;
  /** 是否显示侧边导航 */
  showSidebar?: boolean;
  /** 自定义样式类名 */
  className?: string;
}

/**
 * 设置页面布局组件
 * 提供统一的设置页面布局和导航
 */
export function SettingsLayout({
  children,
  title = '系统设置',
  description = '系统配置和管理功能',
  showSidebar = true,
  className,
}: SettingsLayoutProps) {
  const pathname = usePathname();

  // 判断导航项是否激活
  const isNavItemActive = (href: string) => {
    if (href === '/settings') {
      return pathname === '/settings';
    }
    return pathname.startsWith(href);
  };

  return (
    <div className={cn('container mx-auto space-y-6 py-6', className)}>
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="text-muted-foreground">{description}</p>
        </div>
      </div>

      {showSidebar ? (
        <div className="flex flex-col space-y-8 lg:flex-row lg:space-x-12 lg:space-y-0">
          {/* 侧边导航 */}
          <aside className="lg:w-1/5">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">设置导航</CardTitle>
                <CardDescription>选择要配置的设置项</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <nav className="space-y-1">
                  {settingsNavItems.map((item, index) => {
                    const IconComponent = item.icon;
                    const isActive = isNavItemActive(item.href);
                    const isDisabled = !item.available;

                    return (
                      <div key={item.id}>
                        {index > 0 && <Separator className="my-1" />}
                        <Link
                          href={item.available ? item.href : '#'}
                          className={cn(
                            'flex items-center space-x-3 rounded-md px-3 py-2 text-sm transition-colors',
                            isActive
                              ? 'bg-primary text-primary-foreground'
                              : isDisabled
                                ? 'cursor-not-allowed text-muted-foreground opacity-60'
                                : 'text-foreground hover:bg-accent hover:text-accent-foreground'
                          )}
                          onClick={e => {
                            if (isDisabled) {
                              e.preventDefault();
                            }
                          }}
                        >
                          <IconComponent className="h-4 w-4" />
                          <div className="flex-1">
                            <div className="font-medium">{item.title}</div>
                            <div className="text-xs text-muted-foreground">
                              {item.description}
                            </div>
                          </div>
                          {!item.available && (
                            <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                              开发中
                            </span>
                          )}
                        </Link>
                      </div>
                    );
                  })}
                </nav>
              </CardContent>
            </Card>
          </aside>

          {/* 主内容区域 */}
          <div className="flex-1">{children}</div>
        </div>
      ) : (
        /* 无侧边栏布局 */
        <div className="w-full">{children}</div>
      )}
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

/**
 * 设置卡片组件
 * 为设置页面提供统一的卡片样式
 */
export function SettingsCard({
  title,
  description,
  icon: IconComponent,
  children,
  className,
}: SettingsCardProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center">
          {IconComponent && <IconComponent className="mr-2 h-5 w-5" />}
          {title}
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

interface SettingsSectionProps {
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
 * 为设置表单提供章节分组
 */
export function SettingsSection({
  title,
  description,
  children,
  className,
}: SettingsSectionProps) {
  return (
    <div className={cn('space-y-4', className)}>
      <div>
        <h3 className="text-lg font-medium">{title}</h3>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      <Separator />
      <div className="space-y-4">{children}</div>
    </div>
  );
}
