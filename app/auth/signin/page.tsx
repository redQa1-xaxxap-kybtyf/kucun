'use client'

import { useState } from 'react'
import { signIn, getSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Captcha, verifyCaptcha } from '@/components/ui/captcha'
import { Loader2, User, Lock, Shield } from 'lucide-react'
import { userValidations, type UserLoginInput } from '@/lib/validations/database'
import Link from 'next/link'

export default function SignInPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard'
  const error = searchParams.get('error')

  const [isLoading, setIsLoading] = useState(false)
  const [formError, setFormError] = useState('')
  const [currentCaptcha, setCurrentCaptcha] = useState('')

  // 表单配置
  const form = useForm<UserLoginInput>({
    resolver: zodResolver(userValidations.login),
    defaultValues: {
      username: '',
      password: '',
      captcha: '',
    },
  })

  // 错误信息映射
  const errorMessages: Record<string, string> = {
    CredentialsSignin: '用户名或密码错误',
    AccountDisabled: '账户已被禁用，请联系管理员',
    AccessDenied: '访问被拒绝，权限不足',
    AuthenticationError: '认证失败，请重新登录',
    Default: '登录失败，请稍后重试',
  }

  const handleSubmit = async (data: UserLoginInput) => {
    setIsLoading(true)
    setFormError('')

    try {
      // 验证验证码
      if (!verifyCaptcha(data.captcha, currentCaptcha)) {
        setFormError('验证码错误，请重新输入')
        form.setValue('captcha', '')
        return
      }

      const result = await signIn('credentials', {
        username: data.username,
        password: data.password,
        captcha: data.captcha,
        redirect: false,
      })

      if (result?.error) {
        setFormError(errorMessages[result.error] || errorMessages.Default)
        // 登录失败时清空验证码
        form.setValue('captcha', '')
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
      form.setValue('captcha', '')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCaptchaChange = (captcha: string) => {
    setCurrentCaptcha(captcha)
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

            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                {/* 用户名字段 */}
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        用户名
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="text"
                          autoComplete="username"
                          placeholder="请输入用户名"
                          disabled={isLoading}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* 密码字段 */}
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Lock className="h-4 w-4" />
                        密码
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="password"
                          autoComplete="current-password"
                          placeholder="请输入密码"
                          disabled={isLoading}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* 验证码字段 */}
                <FormField
                  control={form.control}
                  name="captcha"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        验证码
                      </FormLabel>
                      <div className="flex gap-3">
                        <FormControl>
                          <Input
                            {...field}
                            type="text"
                            placeholder="请输入验证码"
                            disabled={isLoading}
                            className="flex-1"
                            maxLength={6}
                            autoComplete="off"
                          />
                        </FormControl>
                        <Captcha
                          width={120}
                          height={40}
                          length={4}
                          onCaptchaChange={handleCaptchaChange}
                        />
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isLoading ? '登录中...' : '登录'}
                </Button>
              </form>
            </Form>

            <div className="mt-6 text-center text-sm text-gray-600">
              <p>
                没有账户？{' '}
                <Link
                  href="/auth/register"
                  className="font-medium text-primary hover:text-primary/80"
                >
                  立即注册
                </Link>
              </p>
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p>默认测试账户：</p>
                <p>管理员：admin / admin123456</p>
                <p>销售员：sales / sales123456</p>
                <p className="text-xs text-gray-500 mt-2">
                  点击验证码图片可刷新验证码
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
