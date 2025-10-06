'use client';

import {
  Bell,
  HelpCircle,
  Keyboard,
  LogOut,
  Menu,
  Monitor,
  Moon,
  Plus,
  RefreshCw,
  Search,
  Sun,
  User,
} from 'lucide-react';
import { signOut, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { useQueryClient } from '@tanstack/react-query';

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
import { Input } from '@/components/ui/input';
import { useRealtimeNotifications } from '@/hooks/use-realtime-notifications';
import type { NotificationItem } from '@/lib/types/layout';
import { cn } from '@/lib/utils';

interface HeaderProps {
  /** 是否显示移动端菜单按钮 */
  showMobileMenuButton?: boolean;
  /** 移动端菜单点击处理 */
  onMobileMenuClick?: () => void;
  /** 自定义样式类名 */
  className?: string;
  /** 是否显示搜索框 */
  showSearch?: boolean;
  /** 搜索回调 */
  onSearch?: (query: string) => void;
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
}

/**
 * 顶部导航栏组件
 * 包含用户信息、通知、设置等功能，支持移动端适配
 * 集成搜索、主题切换、快捷操作等功能
 */
function HeaderComponent({
  showMobileMenuButton = false,
  onMobileMenuClick,
  className,
  showSearch = true,
  onSearch,
  user,
}: HeaderProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();

  // 优先使用传递的用户信息，回退到 session
  const currentUser = user || session?.user;

  // 实时通知系统（WebSocket 推送）
  const {
    notifications,
    unreadCount,
    isConnected: wsConnected,
    markAsRead,
    markAllAsRead,
    clearNotification,
  } = useRealtimeNotifications();

  // 搜索状态
  const [searchQuery, setSearchQuery] = React.useState('');
  const [isSearchFocused, setIsSearchFocused] = React.useState(false);

  // 主题状态
  const [theme, setTheme] = React.useState<'light' | 'dark' | 'system'>(
    'light'
  );

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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      onSearch?.(searchQuery.trim());
      // 可以导航到搜索结果页面
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme);
    // 实际项目中应该保存到localStorage或用户设置
    localStorage.setItem('theme', newTheme);
  };

  const handleRefreshData = React.useCallback(() => {
    // 刷新页面数据 - 使用 React Query 的缓存失效机制
    // 根据当前路径选择性失效相关查询
    const pathname = window.location.pathname;

    if (pathname.startsWith('/inventory')) {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    } else if (pathname.startsWith('/products')) {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    } else if (pathname.startsWith('/sales-orders')) {
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
    } else if (pathname.startsWith('/factory-shipments')) {
      queryClient.invalidateQueries({ queryKey: ['factory-shipments'] });
    } else if (pathname.startsWith('/finance')) {
      queryClient.invalidateQueries({ queryKey: ['finance'] });
    } else if (pathname.startsWith('/customers')) {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    } else if (pathname.startsWith('/suppliers')) {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    } else if (pathname.startsWith('/categories')) {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    } else {
      // 其他页面失效所有查询
      queryClient.invalidateQueries();
    }
  }, [queryClient]);

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
        'bg-background/95 supports-backdrop-filter:bg-background/60 sticky top-0 z-50 w-full border-b backdrop-blur-sm',
        className
      )}
    >
      <div className="flex h-16 items-center justify-between px-4">
        {/* 左侧区域 */}
        <div className="flex items-center space-x-4">
          {/* 移动端菜单按钮 */}
          {showMobileMenuButton && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onMobileMenuClick}
              className="md:hidden"
            >
              <Menu className="h-5 w-5" />
            </Button>
          )}

          {/* 搜索框（桌面端） */}
          {showSearch && (
            <div className="hidden items-center space-x-2 md:flex">
              <form onSubmit={handleSearch} className="relative">
                <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                <Input
                  type="search"
                  placeholder="搜索产品、订单... (Ctrl+K)"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => setIsSearchFocused(false)}
                  className={cn(
                    'h-9 w-64 pr-3 pl-10 transition-all duration-200',
                    isSearchFocused && 'w-80'
                  )}
                />
                {searchQuery && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute top-1/2 right-1 h-7 w-7 -translate-y-1/2 p-0"
                    onClick={() => setSearchQuery('')}
                  >
                    ×
                  </Button>
                )}
              </form>
            </div>
          )}
        </div>

        {/* 右侧区域 */}
        <div className="flex items-center space-x-2">
          {/* 数据刷新按钮 */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefreshData}
            className="hidden sm:flex"
            title="刷新数据"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>

          {/* 快速添加按钮 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">新建</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => router.push('/products/create')}>
                新建产品
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => router.push('/sales-orders/create')}
              >
                新建销售订单
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => router.push('/customers/create')}
              >
                新建客户
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* 通知按钮 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="relative">
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <Badge
                    variant="destructive"
                    className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full p-0 text-xs"
                  >
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span>通知</span>
                  {/* WebSocket 连接状态指示器 */}
                  <div
                    className={cn(
                      'h-2 w-2 rounded-full',
                      wsConnected ? 'bg-green-500' : 'bg-gray-400'
                    )}
                    title={
                      wsConnected ? 'WebSocket 已连接' : 'WebSocket 未连接'
                    }
                  />
                </div>
                {unreadCount > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {unreadCount} 项未读
                  </Badge>
                )}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {notifications.length > 0 ? (
                <>
                  <div className="max-h-96 overflow-y-auto">
                    {notifications.slice(0, 10).map(notification => (
                      <DropdownMenuItem
                        key={notification.id}
                        onClick={() => handleNotificationClick(notification)}
                        className={cn(
                          'hover:bg-accent flex cursor-pointer flex-col items-start p-3',
                          notification.isRead && 'opacity-60'
                        )}
                      >
                        <div className="flex w-full items-start justify-between">
                          <div className="flex-1">
                            <p className="text-sm font-medium">
                              {notification.title}
                            </p>
                            <p className="text-muted-foreground mt-1 text-xs">
                              {notification.message}
                            </p>
                            <p className="text-muted-foreground mt-1 text-xs">
                              {notification.createdAt.toLocaleTimeString()}
                            </p>
                          </div>
                          {!notification.isRead && (
                            <div className="bg-primary mt-1 ml-2 h-2 w-2 rounded-full" />
                          )}
                        </div>
                      </DropdownMenuItem>
                    ))}
                  </div>
                  <DropdownMenuSeparator />
                  <div className="flex gap-2 p-2">
                    {unreadCount > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex-1 text-xs"
                        onClick={e => {
                          e.stopPropagation();
                          markAllAsRead();
                        }}
                      >
                        全部标记为已读
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1 text-xs"
                      onClick={() => router.push('/notifications')}
                    >
                      查看所有通知
                    </Button>
                  </div>
                </>
              ) : (
                <DropdownMenuItem disabled>暂无通知</DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* 用户菜单 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarImage
                    src={currentUser?.avatar}
                    alt={currentUser?.name || ''}
                  />
                  <AvatarFallback>
                    {currentUser?.name
                      ? getUserInitials(currentUser.name)
                      : 'U'}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm leading-none font-medium">
                    {currentUser?.name || '用户'}
                  </p>
                  <p className="text-muted-foreground text-xs leading-none">
                    {currentUser?.email}
                  </p>
                  <Badge variant="outline" className="w-fit text-xs">
                    {currentUser?.role === 'admin' ? '管理员' : '销售员'}
                  </Badge>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleProfileClick}>
                <User className="mr-2 h-4 w-4" />
                个人资料
              </DropdownMenuItem>

              {/* 主题切换 */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <DropdownMenuItem onSelect={e => e.preventDefault()}>
                    {theme === 'light' && <Sun className="mr-2 h-4 w-4" />}
                    {theme === 'dark' && <Moon className="mr-2 h-4 w-4" />}
                    {theme === 'system' && <Monitor className="mr-2 h-4 w-4" />}
                    主题
                  </DropdownMenuItem>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="left" align="start">
                  <DropdownMenuItem onClick={() => handleThemeChange('light')}>
                    <Sun className="mr-2 h-4 w-4" />
                    浅色
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleThemeChange('dark')}>
                    <Moon className="mr-2 h-4 w-4" />
                    深色
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleThemeChange('system')}>
                    <Monitor className="mr-2 h-4 w-4" />
                    跟随系统
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* 键盘快捷键 */}
              <DropdownMenuItem onClick={() => router.push('/help/shortcuts')}>
                <Keyboard className="mr-2 h-4 w-4" />
                快捷键
              </DropdownMenuItem>

              {/* 帮助中心 */}
              <DropdownMenuItem onClick={() => router.push('/help')}>
                <HelpCircle className="mr-2 h-4 w-4" />
                帮助中心
              </DropdownMenuItem>

              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleSignOut}
                className="text-destructive focus:text-destructive"
              >
                <LogOut className="mr-2 h-4 w-4" />
                退出登录
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
