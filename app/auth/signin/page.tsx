'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle, Loader2, Lock, Shield, User } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSession, signIn } from 'next-auth/react';
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
// 验证码功能已迁移到服务器端
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { userValidations, type UserLoginInput } from '@/lib/validations/base';

export default function SignInPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';
  const error = searchParams.get('error');

  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [captchaImage, setCaptchaImage] = useState('');
  const [captchaSessionId, setCaptchaSessionId] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);

  const { toast } = useToast();

  // 表单配置
  const form = useForm<UserLoginInput>({
    resolver: zodResolver(userValidations.login),
    defaultValues: {
      username: '',
      password: '',
      captcha: '',
    },
  });

  // 错误信息映射
  const errorMessages: Record<string, string> = {
    CredentialsSignin: '用户名或密码错误',
    AccountDisabled: '账户已被禁用，请联系管理员',
    AccessDenied: '访问被拒绝，权限不足',
    AuthenticationError: '认证失败，请重新登录',
    Default: '登录失败，请稍后重试',
  };

  const handleSubmit = async (data: UserLoginInput) => {
    setIsLoading(true);
    setFormError('');
    setIsSuccess(false);

    try {
      const result = await signIn('credentials', {
        username: data.username,
        password: data.password,
        captcha: data.captcha,
        captchaSessionId,
        redirect: false,
      });

      if (result?.error) {
        setFormError(errorMessages[result.error] || errorMessages.Default);
        // 登录失败时清空验证码并重新加载
        form.setValue('captcha', '');
        loadCaptcha();

        // 显示错误 Toast
        toast({
          title: '登录失败',
          description: errorMessages[result.error] || errorMessages.Default,
          variant: 'destructive',
        });
      } else if (result?.ok) {
        // 登录成功，获取会话信息
        const session = await getSession();
        if (session) {
          // 设置成功状态
          setIsSuccess(true);

          // 显示成功 Toast
          toast({
            title: '登录成功！',
            description: `欢迎回来，${session.user.name}（${session.user.role === 'admin' ? '管理员' : '销售员'}）`,
            variant: 'success',
          });

          // 延迟跳转，让用户看到成功反馈
          setTimeout(() => {
            setIsRedirecting(true);
            setTimeout(() => {
              router.push(callbackUrl);
              router.refresh();
            }, 500); // 额外的短暂延迟用于显示跳转状态
          }, 1500); // 1.5秒延迟让用户看到成功消息
        }
      }
    } catch (error) {
      console.error('登录错误:', error);
      setFormError('登录失败，请稍后重试');
      form.setValue('captcha', '');
      loadCaptcha();

      // 显示错误 Toast
      toast({
        title: '登录失败',
        description: '登录失败，请稍后重试',
        variant: 'destructive',
      });
    } finally {
      // 只有在非成功状态下才立即设置 loading 为 false
      if (!isSuccess) {
        setIsLoading(false);
      }
    }
  };

  // 加载验证码
  const loadCaptcha = async () => {
    try {
      const response = await fetch('/api/auth/captcha');
      if (response.ok) {
        const data = await response.json();
        setCaptchaImage(data.captchaImage);
        setCaptchaSessionId(data.sessionId);
      }
    } catch (error) {
      console.error('加载验证码失败:', error);
    }
  };

  // 页面加载时获取验证码
  React.useEffect(() => {
    loadCaptcha();
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="relative w-full max-w-md space-y-8">
        {/* 成功/跳转遮罩层 */}
        {(isSuccess || isRedirecting) && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-white/80 backdrop-blur-sm">
            <div className="space-y-4 text-center">
              {isRedirecting ? (
                <>
                  <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-600" />
                  <p className="text-sm font-medium text-blue-600">
                    正在跳转到仪表盘...
                  </p>
                </>
              ) : (
                <>
                  <CheckCircle className="mx-auto h-8 w-8 text-green-600" />
                  <p className="text-sm font-medium text-green-600">
                    登录成功！
                  </p>
                </>
              )}
            </div>
          </div>
        )}

        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-center text-2xl">库存管理系统</CardTitle>
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

            {/* 成功信息 */}
            {isSuccess && (
              <Alert className="mb-4 border-green-200 bg-green-50 text-green-800">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  登录成功！正在为您跳转到仪表盘...
                </AlertDescription>
              </Alert>
            )}

            {/* 显示表单错误信息 */}
            {formError && !isSuccess && (
              <Alert className="mb-4" variant="destructive">
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}

            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(handleSubmit)}
                className="space-y-4"
              >
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
                        <div className="flex items-center">
                          {captchaImage && (
                            <div
                              className="cursor-pointer rounded border"
                              onClick={loadCaptcha}
                              title="点击刷新验证码"
                              dangerouslySetInnerHTML={{ __html: captchaImage }}
                            />
                          )}
                        </div>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className={`w-full transition-all duration-300 ${
                    isSuccess
                      ? 'border-green-600 bg-green-600 hover:bg-green-700'
                      : isRedirecting
                        ? 'border-blue-600 bg-blue-600 hover:bg-blue-700'
                        : ''
                  }`}
                  disabled={isLoading || isSuccess || isRedirecting}
                >
                  {isRedirecting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      正在跳转到仪表盘...
                    </>
                  ) : isSuccess ? (
                    <>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      登录成功！
                    </>
                  ) : isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      登录中...
                    </>
                  ) : (
                    '登录'
                  )}
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
              <div className="mt-4 border-t border-gray-200 pt-4">
                <p>默认测试账户：</p>
                <p>管理员：admin / admin123456</p>
                <p>销售员：sales / sales123456</p>
                <p className="mt-2 text-xs text-gray-500">
                  点击验证码图片可刷新验证码
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
