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
    Settings,
    Sun,
    User,
} from 'lucide-react';
import { signOut, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
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
import { Input } from '@/components/ui/input';
import { useNavigationBadges } from '@/hooks/use-navigation-badges';
import type { NotificationItem } from '@/lib/types/layout';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/lib/utils/permissions';

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
}

/**
 * 顶部导航栏组件
 * 包含用户信息、通知、设置等功能，支持移动端适配
 * 集成搜索、主题切换、快捷操作等功能
 */
export function Header({
  showMobileMenuButton = false,
  onMobileMenuClick,
  className,
  showSearch = true,
  onSearch,
}: HeaderProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const { getTotalBadgeCount, getUrgentBadgeCount } = useNavigationBadges();
  const permissions = usePermissions(session?.user?.role);

  // 搜索状态
  const [searchQuery, setSearchQuery] = React.useState('');
  const [isSearchFocused, setIsSearchFocused] = React.useState(false);

  // 主题状态
  const [theme, setTheme] = React.useState<'light' | 'dark' | 'system'>(
    'light'
  );

  // 通知状态
  const [notifications] = React.useState<NotificationItem[]>([
    {
      id: '1',
      title: '库存预警',
      message: '产品 "白色瓷砖 W001" 库存不足',
      type: 'warning',
      isRead: false,
      createdAt: new Date(),
      href: '/inventory',
    },
    {
      id: '2',
      title: '新订单',
      message: '收到来自客户张三的新订单',
      type: 'info',
      isRead: false,
      createdAt: new Date(),
      href: '/sales-orders',
    },
  ]);

  const unreadCount = notifications.filter(n => !n.isRead).length;
  const totalBadgeCount = getTotalBadgeCount();
  const urgentCount = getUrgentBadgeCount();

  // 事件处理函数
  const handleSignOut = async () => {
    await signOut({ callbackUrl: '/auth/signin' });
  };

  const handleProfileClick = () => {
    router.push('/profile');
  };

  const handleSettingsClick = () => {
    if (permissions.hasRole(['admin'])) {
      router.push('/settings');
    }
  };

  const handleNotificationClick = (notification: NotificationItem) => {
    if (notification.href) {
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

  const handleRefreshData = () => {
    // 刷新页面数据
    window.location.reload();
  };

  // 获取用户姓名首字母作为头像占位符
  const getUserInitials = (name: string) => name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

  // 快捷键处理
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl/Cmd + K 打开搜索
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault();
        const searchInput = document.querySelector(
          'input[type="search"]'
        ) as HTMLInputElement;
        searchInput?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <header
      className={cn(
        'sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60',
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
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="搜索产品、订单... (Ctrl+K)"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => setIsSearchFocused(false)}
                  className={cn(
                    'h-9 w-64 pl-10 pr-3 transition-all duration-200',
                    isSearchFocused && 'w-80'
                  )}
                />
                {searchQuery && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 p-0"
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
                {(unreadCount > 0 || urgentCount > 0) && (
                  <Badge
                    variant={urgentCount > 0 ? 'destructive' : 'secondary'}
                    className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full p-0 text-xs"
                  >
                    {Math.max(unreadCount, urgentCount) > 9
                      ? '9+'
                      : Math.max(unreadCount, urgentCount)}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel className="flex items-center justify-between">
                <span>通知</span>
                {totalBadgeCount > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {totalBadgeCount} 项待处理
                  </Badge>
                )}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {notifications.length > 0 ? (
                notifications.map(notification => (
                  <DropdownMenuItem
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className="flex cursor-pointer flex-col items-start p-3 hover:bg-accent"
                  >
                    <div className="flex w-full items-start justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium">
                          {notification.title}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {notification.message}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {notification.createdAt.toLocaleTimeString()}
                        </p>
                      </div>
                      {!notification.isRead && (
                        <div className="ml-2 mt-1 h-2 w-2 rounded-full bg-primary" />
                      )}
                    </div>
                  </DropdownMenuItem>
                ))
              ) : (
                <DropdownMenuItem disabled>暂无通知</DropdownMenuItem>
              )}
              {notifications.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-center text-sm text-muted-foreground">
                    查看所有通知
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* 用户菜单 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarImage
                    src={session?.user?.avatar}
                    alt={session?.user?.name || ''}
                  />
                  <AvatarFallback>
                    {session?.user?.name
                      ? getUserInitials(session.user.name)
                      : 'U'}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">
                    {session?.user?.name || '用户'}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {session?.user?.email}
                  </p>
                  <Badge variant="outline" className="w-fit text-xs">
                    {session?.user?.role === 'admin' ? '管理员' : '销售员'}
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

              {/* 管理员设置 */}
              {permissions.hasRole(['admin']) && (
                <DropdownMenuItem onClick={handleSettingsClick}>
                  <Settings className="mr-2 h-4 w-4" />
                  系统设置
                </DropdownMenuItem>
              )}

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
