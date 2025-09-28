'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import * as React from 'react';

import { canAccessPath } from '@/lib/utils/permissions';

import { Breadcrumb } from './Breadcrumb';
import { DashboardLayout } from './DashboardLayout';
import { GlobalSearch } from './GlobalSearch';

interface AuthLayoutProps {
  /** 子组件 */
  children: React.ReactNode;
  /** 自定义样式类名 */
  className?: string;
  /** 是否需要认证 */
  requireAuth?: boolean;
  /** 需要的角色权限 */
  requiredRoles?: string[];
  /** 是否显示面包屑 */
  showBreadcrumb?: boolean;
  /** 是否显示全局搜索 */
  enableGlobalSearch?: boolean;
  /** 页面标题 */
  title?: string;
  /** 页面描述 */
  description?: string;
}

/**
 * 认证布局组件
 * 集成Next-Auth.js认证系统，提供统一的认证检查和布局
 * 严格遵循App Router优先思维和类型安全原则
 */
export function AuthLayout({
  children,
  className,
  requireAuth = true,
  requiredRoles = [],
  showBreadcrumb = true,
  enableGlobalSearch = true,
  title,
  description,
}: AuthLayoutProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  // 全局搜索状态
  const [globalSearchOpen, setGlobalSearchOpen] = React.useState(false);

  // 认证检查
  React.useEffect(() => {
    if (status === 'loading') return;

    if (requireAuth && status === 'unauthenticated') {
      // 未认证用户重定向到登录页
      const signInUrl = `/auth/signin?callbackUrl=${encodeURIComponent(pathname)}`;
      router.push(signInUrl);
      return;
    }

    if (session?.user && requiredRoles.length > 0) {
      // 检查角色权限
      const hasRequiredRole = requiredRoles.includes(session.user.role);
      if (!hasRequiredRole) {
        router.push('/auth/error?error=AccessDenied');
        return;
      }
    }

    if (session?.user) {
      // 检查路径访问权限
      const canAccess = canAccessPath(session.user.role, pathname);
      if (!canAccess) {
        router.push('/auth/error?error=AccessDenied');
        return;
      }
    }
  }, [status, session, requireAuth, requiredRoles, pathname, router]);

  // 全局键盘快捷键
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl/Cmd + K 打开全局搜索
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault();
        if (enableGlobalSearch) {
          setGlobalSearchOpen(true);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [enableGlobalSearch]);

  // 处理搜索
  const handleSearch = (query: string) => {
    console.log('搜索:', query);
    // 这里可以添加搜索逻辑或导航到搜索结果页面
  };

  // 加载状态
  if (status === 'loading') {
    return <AuthLoadingScreen />;
  }

  // 未认证状态
  if (requireAuth && !session) {
    return null; // 将重定向到登录页
  }

  // 权限不足状态
  if (session?.user && requiredRoles.length > 0) {
    const hasRequiredRole = requiredRoles.includes(session.user.role);
    if (!hasRequiredRole) {
      return <AccessDeniedScreen />;
    }
  }

  return (
    <>
      <DashboardLayout className={className}>
        {/* 页面标题和面包屑 */}
        {(title || showBreadcrumb) && (
          <div className="mb-6 space-y-4">
            {showBreadcrumb && <Breadcrumb />}
            {title && (
              <div>
                <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
                {description && (
                  <p className="mt-2 text-muted-foreground">{description}</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* 主要内容 */}
        {children}
      </DashboardLayout>

      {/* 全局搜索对话框 */}
      {enableGlobalSearch && (
        <GlobalSearch
          open={globalSearchOpen}
          onOpenChange={setGlobalSearchOpen}
          onSearch={handleSearch}
        />
      )}
    </>
  );
}

/**
 * 认证加载屏幕
 */
function AuthLoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="space-y-4 text-center">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-primary"></div>
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">正在加载...</h2>
          <p className="text-sm text-muted-foreground">
            请稍候，正在验证您的身份
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * 访问被拒绝屏幕
 */
function AccessDeniedScreen() {
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="max-w-md space-y-6 text-center">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-destructive">403</h1>
          <h2 className="text-xl font-semibold">访问被拒绝</h2>
          <p className="text-muted-foreground">
            抱歉，您没有权限访问此页面。请联系管理员获取相应权限。
          </p>
        </div>

        <div className="flex flex-col justify-center gap-4 sm:flex-row">
          <button
            onClick={() => router.back()}
            className="px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            返回上一页
          </button>
          <button
            onClick={() => router.push('/dashboard')}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            返回首页
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * 页面包装器组件
 * 提供页面级别的认证和布局包装
 */
interface PageWrapperProps extends AuthLayoutProps {
  /** 页面元数据 */
  meta?: {
    title?: string;
    description?: string;
  };
}

export function PageWrapper({
  children,
  meta,
  title = meta?.title,
  description = meta?.description,
  ...props
}: PageWrapperProps) {
  // 设置页面标题
  React.useEffect(() => {
    if (title) {
      document.title = `${title} - 库存管理工具`;
    }
  }, [title]);

  return (
    <AuthLayout title={title} description={description} {...props}>
      {children}
    </AuthLayout>
  );
}

/**
 * 高阶组件：为页面添加认证和布局
 */
export function withAuthLayout<P extends object>(
  Component: React.ComponentType<P>,
  layoutProps?: Omit<AuthLayoutProps, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <AuthLayout {...layoutProps}>
      <Component {...props} />
    </AuthLayout>
  );

  WrappedComponent.displayName = `withAuthLayout(${Component.displayName || Component.name})`;

  return WrappedComponent;
}
