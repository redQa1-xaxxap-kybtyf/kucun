'use client';

import { useSession } from 'next-auth/react';
import { usePathname, useRouter } from 'next/navigation';
import * as React from 'react';

import type { UserRole } from '@/lib/types/user';
import { canAccessPath } from '@/lib/utils/permissions';

import { Breadcrumb } from './Breadcrumb';
import { DashboardLayout } from './DashboardLayout';

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
  title,
  description,
}: AuthLayoutProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  // 缓存权限检查结果，避免重复计算
  const authState = React.useMemo(() => {
    if (status === 'loading') {
      return {
        isLoading: true,
        isAuthorized: false,
        shouldRedirect: false,
        redirectUrl: '',
      };
    }

    // 检查是否需要认证但未登录
    if (requireAuth && status === 'unauthenticated') {
      return {
        isLoading: false,
        isAuthorized: false,
        shouldRedirect: true,
        redirectUrl: `/auth/signin?callbackUrl=${encodeURIComponent(pathname)}`,
      };
    }

    // 检查角色权限
    if (session?.user && requiredRoles.length > 0) {
      const hasRequiredRole = requiredRoles.includes(session.user.role);
      if (!hasRequiredRole) {
        return {
          isLoading: false,
          isAuthorized: false,
          shouldRedirect: true,
          redirectUrl: '/auth/error?error=AccessDenied',
        };
      }
    }

    // 检查路径访问权限
    if (session?.user) {
      const canAccess = canAccessPath(session.user.role as UserRole, pathname);
      if (!canAccess) {
        return {
          isLoading: false,
          isAuthorized: false,
          shouldRedirect: true,
          redirectUrl: '/auth/error?error=AccessDenied',
        };
      }
    }

    return {
      isLoading: false,
      isAuthorized: true,
      shouldRedirect: false,
      redirectUrl: '',
    };
  }, [status, session?.user, requireAuth, requiredRoles, pathname]);

  // 只在需要时执行重定向
  const hasRedirectedRef = React.useRef(false);
  React.useEffect(() => {
    if (authState.shouldRedirect && !hasRedirectedRef.current) {
      hasRedirectedRef.current = true;
      router.push(authState.redirectUrl);
    }
  }, [authState.shouldRedirect, authState.redirectUrl, router]);

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
                  <p className="text-muted-foreground mt-2">{description}</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* 主要内容 */}
        {children}
      </DashboardLayout>
    </>
  );
}

/**
 * 认证加载屏幕
 */
function AuthLoadingScreen() {
  return (
    <div className="bg-background flex min-h-screen items-center justify-center">
      <div className="space-y-4 text-center">
        <div className="border-primary mx-auto h-12 w-12 animate-spin rounded-full border-b-2"></div>
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">正在加载...</h2>
          <p className="text-muted-foreground text-sm">
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
    <div className="bg-background flex min-h-screen items-center justify-center">
      <div className="max-w-md space-y-6 text-center">
        <div className="space-y-2">
          <h1 className="text-destructive text-4xl font-bold">403</h1>
          <h2 className="text-xl font-semibold">访问被拒绝</h2>
          <p className="text-muted-foreground">
            抱歉，您没有权限访问此页面。请联系管理员获取相应权限。
          </p>
        </div>

        <div className="flex flex-col justify-center gap-4 sm:flex-row">
          <button
            onClick={() => router.back()}
            className="text-muted-foreground hover:text-foreground px-4 py-2 text-sm font-medium transition-colors"
          >
            返回上一页
          </button>
          <button
            onClick={() => router.push('/dashboard')}
            className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium transition-colors"
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
