'use client';

/**
 * 新建分类页面（轻量包装层）
 *
 * 目标：减少首屏 JS（将大表单逻辑下沉到动态加载的 client chunk）
 */

import { ArrowLeft, ShieldAlert } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useSession } from 'next-auth/react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { can } from '@/lib/auth/permissions';

const CreateCategoryPageClient = dynamic(() => import('./page-client'), {
  ssr: false,
  loading: () => <LoadingState />,
});

/**
 * 新建分类页面组件
 * 包含权限检查，确保用户有创建分类的权限
 */
export default function CreateCategoryPage() {
  const { data: session, status } = useSession();

  // 加载中状态
  if (status === 'loading') {
    return <LoadingState />;
  }

  // 未登录状态
  if (status === 'unauthenticated' || !session?.user) {
    return <UnauthorizedState />;
  }

  // 权限检查
  const hasPermission = can(session.user, 'categories:create');

  if (!hasPermission) {
    return <NoPermissionState userRole={session.user.role} />;
  }

  // 有权限，显示创建表单（动态加载）
  return <CreateCategoryPageClient />;
}

/**
 * 加载中状态组件
 */
function LoadingState() {
  return (
    <div className="flex h-[50vh] items-center justify-center">
      <div className="text-center">
        <div className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />
        <p className="text-muted-foreground mt-4 text-sm">加载中...</p>
      </div>
    </div>
  );
}

/**
 * 未登录状态组件
 */
function UnauthorizedState() {
  return (
    <div className="container mx-auto max-w-4xl py-8">
      <Alert variant="destructive">
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>需要登录</AlertTitle>
        <AlertDescription>
          请先登录后再创建分类。
          <Link
            href="/auth/signin?callbackUrl=/categories/create"
            className="ml-2 underline"
          >
            前往登录
          </Link>
        </AlertDescription>
      </Alert>
      <div className="mt-6 flex gap-4">
        <Button variant="outline" asChild>
          <Link href="/categories">
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回分类列表
          </Link>
        </Button>
      </div>
    </div>
  );
}

/**
 * 权限不足状态组件
 */
function NoPermissionState({ userRole }: { userRole: string }) {
  const roleDisplayName =
    userRole === 'admin'
      ? '管理员'
      : userRole === 'sales'
        ? '销售员'
        : userRole === 'warehouse'
          ? '仓库员'
          : userRole === 'finance'
            ? '财务员'
            : userRole;

  return (
    <div className="container mx-auto max-w-4xl py-8">
      <Alert variant="destructive">
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>权限不足</AlertTitle>
        <AlertDescription>
          您没有创建分类的权限，请联系管理员。
          <div className="mt-2 text-sm">
            <p>
              当前角色：<span className="font-medium">{roleDisplayName}</span>
            </p>
            <p className="text-muted-foreground mt-1">
              所需权限：创建分类（categories:create）
            </p>
          </div>
        </AlertDescription>
      </Alert>
      <div className="mt-6 flex gap-4">
        <Button variant="outline" asChild>
          <Link href="/categories">
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回分类列表
          </Link>
        </Button>
      </div>
    </div>
  );
}

