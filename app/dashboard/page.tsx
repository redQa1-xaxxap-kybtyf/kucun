'use client'

import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LogOut, User, Shield, Clock } from 'lucide-react'

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
    }
  }, [status, router])

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-gray-600">加载中...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  const handleSignOut = async () => {
    await signOut({ callbackUrl: '/auth/signin' })
  }

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin':
        return 'destructive'
      case 'sales':
        return 'default'
      default:
        return 'secondary'
    }
  }

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'admin':
        return '系统管理员'
      case 'sales':
        return '销售员'
      default:
        return '未知角色'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航栏 */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">
                库存管理系统
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <User className="h-4 w-4 text-gray-500" />
                <span className="text-sm text-gray-700">{session.user.name}</span>
                <Badge variant={getRoleBadgeVariant(session.user.role)}>
                  {getRoleDisplayName(session.user.role)}
                </Badge>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSignOut}
              >
                <LogOut className="h-4 w-4 mr-2" />
                退出登录
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* 主要内容 */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* 用户信息卡片 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <User className="h-5 w-5 mr-2" />
                  用户信息
                </CardTitle>
                <CardDescription>
                  当前登录用户的基本信息
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm font-medium">姓名:</span>
                  <span className="text-sm">{session.user.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">邮箱:</span>
                  <span className="text-sm">{session.user.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">角色:</span>
                  <Badge variant={getRoleBadgeVariant(session.user.role)}>
                    {getRoleDisplayName(session.user.role)}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">状态:</span>
                  <Badge variant={session.user.status === 'active' ? 'default' : 'secondary'}>
                    {session.user.status === 'active' ? '活跃' : '非活跃'}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* 权限信息卡片 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Shield className="h-5 w-5 mr-2" />
                  权限信息
                </CardTitle>
                <CardDescription>
                  当前用户的系统权限
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="space-y-1">
                  <p className="text-sm font-medium">可访问功能:</p>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• 查看仪表板</li>
                    <li>• 管理客户信息</li>
                    <li>• 管理产品信息</li>
                    <li>• 处理销售订单</li>
                    <li>• 管理库存</li>
                    {session.user.role === 'admin' && (
                      <>
                        <li>• 用户管理</li>
                        <li>• 系统设置</li>
                      </>
                    )}
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* 会话信息卡片 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Clock className="h-5 w-5 mr-2" />
                  会话信息
                </CardTitle>
                <CardDescription>
                  当前登录会话的详细信息
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm font-medium">用户ID:</span>
                  <span className="text-sm font-mono">{session.user.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">会话状态:</span>
                  <Badge variant="default">已认证</Badge>
                </div>
                <div className="text-sm text-gray-600">
                  <p>会话将在24小时后自动过期</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 快速操作区域 */}
          <div className="mt-8">
            <Card>
              <CardHeader>
                <CardTitle>快速操作</CardTitle>
                <CardDescription>
                  常用功能的快速入口
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Button variant="outline" className="h-20 flex-col">
                    <span className="text-lg mb-1">📦</span>
                    <span>产品管理</span>
                  </Button>
                  <Button variant="outline" className="h-20 flex-col">
                    <span className="text-lg mb-1">👥</span>
                    <span>客户管理</span>
                  </Button>
                  <Button variant="outline" className="h-20 flex-col">
                    <span className="text-lg mb-1">📊</span>
                    <span>销售订单</span>
                  </Button>
                  <Button variant="outline" className="h-20 flex-col">
                    <span className="text-lg mb-1">📋</span>
                    <span>库存管理</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
