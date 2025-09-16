'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertTriangle, Home, LogIn } from 'lucide-react'

export default function AuthErrorPage() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')

  // 错误信息映射
  const errorMessages: Record<string, { title: string; description: string }> = {
    CredentialsSignin: {
      title: '登录失败',
      description: '邮箱或密码错误，请检查后重试。',
    },
    AccountDisabled: {
      title: '账户已禁用',
      description: '您的账户已被管理员禁用，请联系系统管理员。',
    },
    AccessDenied: {
      title: '访问被拒绝',
      description: '您没有权限访问此页面，请联系管理员获取相应权限。',
    },
    AuthenticationError: {
      title: '认证错误',
      description: '身份认证过程中发生错误，请重新登录。',
    },
    SessionRequired: {
      title: '需要登录',
      description: '访问此页面需要登录，请先登录您的账户。',
    },
    Default: {
      title: '未知错误',
      description: '发生了未知错误，请稍后重试或联系技术支持。',
    },
  }

  const errorInfo = errorMessages[error || 'Default'] || errorMessages.Default

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <Card>
          <CardHeader className="space-y-1 text-center">
            <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <CardTitle className="text-2xl">{errorInfo.title}</CardTitle>
            <CardDescription>
              库存管理系统认证错误
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {errorInfo.description}
              </AlertDescription>
            </Alert>

            {/* 错误代码显示 */}
            {error && (
              <div className="text-sm text-gray-500 text-center">
                错误代码: {error}
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

            {/* 帮助信息 */}
            <div className="mt-6 text-center text-sm text-gray-600">
              <p>如果问题持续存在，请联系系统管理员</p>
              <p className="mt-1">邮箱: admin@inventory.com</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
