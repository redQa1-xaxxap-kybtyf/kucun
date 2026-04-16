import { AlertTriangle, Home, LogIn } from 'lucide-react';
import Link from 'next/link';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const rawError = params.error;
  const error = Array.isArray(rawError) ? rawError[0] : rawError;

  // 错误信息映射
  const errorMessages: Record<string, { title: string; description: string }> =
    {
      CredentialsSignin: {
        title: '登录失败',
        description: '账号或密码不正确，请检查后重试。',
      },
      AccountDisabled: {
        title: '账号已停用',
        description: '当前账号暂时无法登录，请联系负责人处理。',
      },
      AccessDenied: {
        title: '访问被拒绝',
        description: '当前账号暂时不能访问这个页面，请联系负责人开通权限。',
      },
      AuthenticationError: {
        title: '登录状态异常',
        description: '登录过程中遇到一点问题，请重新登录后再试。',
      },
      SessionRequired: {
        title: '需要登录',
        description: '请先登录，再继续查看这个页面。',
      },
      Default: {
        title: '暂时无法打开页面',
        description: '页面暂时无法打开，请稍后重试。',
      },
    };

  const errorInfo = errorMessages[error || 'Default'] || errorMessages.Default;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <Card>
          <CardHeader className="space-y-1 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
            <CardTitle className="text-2xl">{errorInfo.title}</CardTitle>
            <CardDescription>登录过程中遇到了一点问题</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{errorInfo.description}</AlertDescription>
            </Alert>

            {error && (
              <div className="text-center text-sm text-gray-500">
                参考信息：{error}
              </div>
            )}

            {/* 操作按钮 */}
            <div className="flex flex-col space-y-2">
              <Button asChild className="w-full">
                <Link href="/auth/signin">
                  <LogIn className="mr-2 h-4 w-4" />
                  重新登录
                </Link>
              </Button>

              <Button variant="outline" asChild className="w-full">
                <Link href="/">
                  <Home className="mr-2 h-4 w-4" />
                  返回首页
                </Link>
              </Button>
            </div>

            <div className="mt-6 text-center text-sm text-gray-600">
              <p>如果多次重试仍无法进入，请联系负责人协助处理。</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
