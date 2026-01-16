'use client';

import { useQueryClient } from '@tanstack/react-query';
import {
    Bell,
    Keyboard,
    LogOut,
    Menu,
    Monitor,
    Plus,
    RefreshCw,
    Search,
    User
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import * as React from 'react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { usePollingNotifications } from '@/hooks/use-polling-notifications';
import { queryKeys } from '@/lib/queryKeys';
import type { NotificationItem } from '@/lib/types/layout';
import { cn } from '@/lib/utils';

interface HeaderProps {
  /** 是否显示移动端菜单按钮 */
  showMobileMenuButton?: boolean;
  /** 移动端菜单点击处理 */
  onMobileMenuClick?: () => void;
  /** 自定义样式类名 */
  className?: string;
  /** 用户信息（从服务端传递，避免客户端重复请求） */
  user?: {
    id: string;
    email: string;
    username: string;
    name: string;
    role: string;
    status: string;
    avatar?: string;
  };
  systemMode?: 'trial' | 'production';
}

/**
 * 顶部导航栏组件
 * 包含用户信息、通知、设置等功能，支持移动端适配
 */
function HeaderComponent({
  showMobileMenuButton = false,
  onMobileMenuClick,
  className,
  user,
  systemMode,
}: HeaderProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  // 直接使用传递的用户信息，避免重复的会话请求
  const currentUser = user;

  // 通知系统（轮询方式 - 更简单可靠）
  // 注意：必须在所有条件语句之前调用 Hooks
  const { notifications, unreadCount, markAsRead, markAllAsRead } =
    usePollingNotifications();

  // 数据刷新回调 - 必须在条件返回之前定义
  const handleRefreshData = React.useCallback(() => {
    // 刷新页面数据 - 使用 React Query 的缓存失效机制
    // 根据当前路径选择性失效相关查询
    const pathname = window.location.pathname;

    if (pathname.startsWith('/inventory')) {
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });
    } else if (pathname.startsWith('/products')) {
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
    } else if (pathname.startsWith('/sales-orders')) {
      queryClient.invalidateQueries({ queryKey: queryKeys.salesOrders.all });
    } else if (pathname.startsWith('/factory-shipments')) {
      queryClient.invalidateQueries({
        queryKey: queryKeys.factoryShipments.all,
      });
    } else if (pathname.startsWith('/finance')) {
      queryClient.invalidateQueries({ queryKey: queryKeys.finance.all });
    } else if (pathname.startsWith('/customers')) {
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });
    } else if (pathname.startsWith('/suppliers')) {
      queryClient.invalidateQueries({ queryKey: queryKeys.suppliers.all });
    } else if (pathname.startsWith('/categories')) {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.all });
    } else {
      // 其他页面失效所有查询
      queryClient.invalidateQueries();
    }
  }, [queryClient]);

  // 如果没有用户信息，显示简化的 Header（登录提示）
  if (!currentUser) {
    return (
      <header
        className={cn(
          'bg-background/95 supports-backdrop-filter:bg-background/60 sticky top-0 z-50 w-full border-b backdrop-blur-sm',
          className
        )}
      >
        <div className="flex h-16 items-center justify-between px-4">
          <div className="text-muted-foreground text-sm">请登录以访问系统</div>
          <Button onClick={() => router.push('/auth/signin')}>登录</Button>
        </div>
      </header>
    );
  }

  // 事件处理函数
  const handleSignOut = async () => {
    await signOut({ callbackUrl: '/auth/signin' });
  };

  const handleProfileClick = () => {
    router.push('/profile');
  };

  const handleNotificationClick = (notification: NotificationItem) => {
    // 标记为已读
    markAsRead(notification.id);

    // 导航到相关页面
    if (notification.onClick) {
      notification.onClick();
    } else if (notification.href) {
      router.push(notification.href);
    }
  };

  // 获取用户姓名首字母作为头像占位符
  const getUserInitials = (name: string) =>
    name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

  return (
    <header
      className={cn(
        'sticky top-0 z-50 w-full border-b border-slate-100 bg-white/80 backdrop-blur-xl transition-all duration-300',
        className
      )}
    >
      <div className="flex h-14 items-center justify-between px-4 lg:px-6">
        {/* 左侧区域 */}
        <div className="flex items-center gap-4">
          {/* 移动端菜单按钮 */}
          {showMobileMenuButton && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onMobileMenuClick}
              className="md:hidden h-9 w-9 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            >
              <Menu className="h-5 w-5" />
            </Button>
          )}

          {/* 全域搜索占位框 - 桌面端 */}
          <div className="hidden md:flex">
             <div className="group relative flex h-9 w-[280px] cursor-pointer items-center gap-2 rounded-full border border-slate-100 bg-slate-50/50 px-3 transition-all hover:border-blue-200 hover:bg-white hover:shadow-sm">
                <Search className="h-4 w-4 text-slate-400 transition-colors group-hover:text-blue-500" />
                <span className="text-xs font-medium text-slate-400 group-hover:text-slate-500">
                  搜索功能、订单、报表...
                </span>
                <kbd className="pointer-events-none absolute right-2 flex h-5 select-none items-center gap-1 rounded border border-slate-200 bg-white px-1.5 font-mono text-xs font-medium text-slate-500 opacity-100 transition-opacity group-hover:opacity-0">
                  <span className="text-xs">⌘</span>K
                </kbd>
             </div>
          </div>
        </div>

        {/* 右侧区域 */}
        <div className="flex items-center gap-1.5">
          {systemMode && (
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="hidden items-center rounded-full sm:flex"
                >
                  <Badge
                    variant="secondary"
                    className={cn(
                      'rounded-full px-3 py-1 text-[10px] font-black',
                      systemMode === 'trial'
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-amber-50 text-amber-700'
                    )}
                  >
                    当前账套：
                    {systemMode === 'trial' ? '试用（可重置）' : '正式（受保护）'}
                  </Badge>
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 rounded-xl">
                <div className="space-y-2">
                  <div className="text-sm font-black text-slate-900">
                    账套模式说明
                  </div>
                  <div className="text-xs leading-relaxed text-slate-600">
                    {systemMode === 'trial' ? (
                      <>
                        当前为试用账套：允许在“数据管理”中一键重置试用数据，重置后业务单据、报表与台账会清空/归零。
                      </>
                    ) : (
                      <>
                        当前为正式账套：受保护，禁止直接清空正式数据；仅支持清理标记为测试的数据，并通过作废/冲销保证可追溯。
                      </>
                    )}
                  </div>
                  <div className="pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 rounded-full text-xs font-bold"
                      onClick={() => router.push('/settings/data-management')}
                    >
                      进入数据管理
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          )}
          {/* 数据刷新按钮 */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefreshData}
            className="hidden sm:flex h-9 w-9 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            title="一键刷新全局缓存"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>

          <div className="mx-1 hidden h-4 w-px bg-slate-100 sm:block" />

          {/* 快速添加按钮组 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="default" 
                size="sm" 
                className="h-9 gap-2 rounded-full bg-slate-900 px-4 text-xs font-bold hover:bg-slate-800"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden lg:inline">快速新建</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-xl border-slate-100 p-1.5 shadow-xl">
              <DropdownMenuLabel className="px-2 py-1.5 text-xs font-black uppercase tracking-wider text-slate-500">核心配置</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => router.push('/products/create')} className="rounded-lg py-2 cursor-pointer">
                <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                        <Monitor className="h-4 w-4" />
                    </div>
                    <span>录入新产品</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push('/sales-orders/create')} className="rounded-lg py-2 cursor-pointer">
                 <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                        <Plus className="h-4 w-4" />
                    </div>
                    <span>下达销售订单</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-slate-50" />
              <DropdownMenuItem onClick={() => router.push('/customers/create')} className="rounded-lg py-2 cursor-pointer">
                 <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                        <User className="h-4 w-4" />
                    </div>
                    <span>登记新客户</span>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="mx-1 h-4 w-px bg-slate-100" />

          {/* 通知按钮 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative h-9 w-9 text-slate-500 hover:bg-slate-100 hover:text-slate-900">
                <Bell className="h-[18px] w-[18px]" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 p-0 text-xs font-black leading-none text-white ring-2 ring-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[360px] rounded-2xl border-slate-100 p-0 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-50 p-4">
                <h3 className="text-sm font-black text-slate-900">通知中心</h3>
                {unreadCount > 0 && (
                  <Badge variant="secondary" className="bg-blue-50 text-[10px] font-black text-blue-600">
                    {unreadCount} 条未读
                  </Badge>
                )}
              </div>
              <div className="max-h-[400px] overflow-y-auto p-1.5">
                {notifications.length > 0 ? (
                  notifications.slice(0, 8).map((notification) => (
                    <DropdownMenuItem
                      key={notification.id}
                      onClick={() => handleNotificationClick(notification)}
                      className={cn(
                        'flex cursor-pointer flex-col items-start gap-1 rounded-xl p-3 transition-colors',
                        !notification.isRead ? 'bg-blue-50/50 hover:bg-blue-50' : 'hover:bg-slate-50'
                      )}
                    >
                      <div className="flex w-full items-center justify-between">
                        <span className={cn("text-sm font-bold", !notification.isRead ? "text-blue-900" : "text-slate-700")}>
                          {notification.title}
                        </span>
                        <span className="text-xs font-bold text-slate-500">
                          {notification.createdAt.toLocaleDateString()}
                        </span>
                      </div>
                      <p className="line-clamp-2 text-xs leading-relaxed text-slate-500">
                        {notification.message}
                      </p>
                    </DropdownMenuItem>
                  ))
                ) : (
                  <div className="py-12 text-center">
                    <p className="text-xs font-medium text-slate-400">暂无重要通知</p>
                  </div>
                )}
              </div>
              <DropdownMenuSeparator className="m-0 bg-slate-50" />
              <div className="flex gap-2 p-3">
                <Button variant="ghost" size="sm" className="h-8 flex-1 text-xs font-bold text-slate-500" onClick={markAllAsRead}>
                  一键忽略
                </Button>
                <Button variant="ghost" size="sm" className="h-8 flex-1 text-xs font-bold text-blue-600" onClick={() => router.push('/notifications')}>
                  进入通知中心
                </Button>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* 用户菜单 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative ml-2 flex items-center gap-2 rounded-full p-0.5 pr-3 transition-all hover:bg-slate-100">
                <Avatar className="h-7 w-7 border-2 border-slate-200">
                  <AvatarImage
                    src={currentUser?.avatar}
                    alt={currentUser?.name || ''}
                  />
                  <AvatarFallback className="bg-slate-900 text-xs font-bold text-white">
                    {currentUser?.name ? getUserInitials(currentUser.name) : 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden text-left lg:block">
                   <p className="text-xs font-black leading-none text-slate-900">{currentUser?.name}</p>
                   <p className="mt-1 text-xs font-bold text-slate-500 capitalize leading-none">{currentUser?.role}</p>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64 rounded-2xl border-slate-100 p-2 shadow-2xl" align="end" forceMount>
              <div className="mb-2 flex items-center gap-3 p-3">
                  <Avatar className="h-10 w-10 border-2 border-slate-100">
                     <AvatarImage src={currentUser?.avatar} />
                     <AvatarFallback className="bg-slate-900 font-bold text-white">{getUserInitials(currentUser?.name || '')}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <p className="text-sm font-black text-slate-900">{currentUser?.name}</p>
                    <p className="text-xs font-bold text-slate-500">{currentUser?.email}</p>
                  </div>
              </div>
              
              <DropdownMenuSeparator className="bg-slate-50" />

              <DropdownMenuItem onClick={handleProfileClick} className="rounded-xl py-2 cursor-pointer">
                <User className="mr-3 h-4 w-4 text-slate-400" />
                <span className="font-bold text-slate-700">账户设置</span>
              </DropdownMenuItem>

              <DropdownMenuItem onClick={() => router.push('/help/shortcuts')} className="rounded-xl py-2 cursor-pointer">
                <Keyboard className="mr-3 h-4 w-4 text-slate-400" />
                <span className="font-bold text-slate-700">键盘快捷键</span>
              </DropdownMenuItem>

              <DropdownMenuSeparator className="bg-slate-50" />

              <DropdownMenuItem
                onClick={handleSignOut}
                className="rounded-xl py-2 text-rose-600 focus:bg-rose-50 focus:text-rose-600 cursor-pointer"
              >
                <LogOut className="mr-3 h-4 w-4" />
                <span className="font-bold">安全退出</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

/**
 * 使用 React.memo 优化 Header 组件
 * 避免因父组件重渲染导致的不必要更新
 */
export const Header = React.memo(HeaderComponent);
