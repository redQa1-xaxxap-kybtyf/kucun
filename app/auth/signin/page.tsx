'use client'

import { useState } from 'react'
import { signIn, getSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2 } from 'lucide-react'

export default function SignInPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard'
  const error = searchParams.get('error')

  const [formData, setFormData] = useState({
    email: '',
    password: '',
  })
  const [isLoading, setIsLoading] = useState(false)
  const [formError, setFormError] = useState('')

  // 错误信息映射
  const errorMessages: Record<string, string> = {
    CredentialsSignin: '邮箱或密码错误',
    AccountDisabled: '账户已被禁用，请联系管理员',
    AccessDenied: '访问被拒绝，权限不足',
    AuthenticationError: '认证失败，请重新登录',
    Default: '登录失败，请稍后重试',
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setFormError('')

    try {
      const result = await signIn('credentials', {
        email: formData.email,
        password: formData.password,
        redirect: false,
      })

      if (result?.error) {
        setFormError(errorMessages[result.error] || errorMessages.Default)
      } else if (result?.ok) {
        // 登录成功，获取会话信息
        const session = await getSession()
        if (session) {
          router.push(callbackUrl)
          router.refresh()
        }
      }
    } catch (error) {
      console.error('登录错误:', error)
      setFormError('登录失败，请稍后重试')
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }))
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center">库存管理系统</CardTitle>
            <CardDescription className="text-center">
              请输入您的账户信息登录系统
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* 显示 URL 参数中的错误信息 */}
            {error && (
              <Alert className="mb-4" variant="destructive">
                <AlertDescription>
                  {errorMessages[error] || errorMessages.Default}
                </AlertDescription>
              </Alert>
            )}

            {/* 显示表单错误信息 */}
            {formError && (
              <Alert className="mb-4" variant="destructive">
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">邮箱地址</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="请输入邮箱地址"
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">密码</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="请输入密码"
                  disabled={isLoading}
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={isLoading}
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isLoading ? '登录中...' : '登录'}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm text-gray-600">
              <p>默认测试账户：</p>
              <p>管理员：admin@inventory.com / admin123456</p>
              <p>销售员：sales@inventory.com / sales123456</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
