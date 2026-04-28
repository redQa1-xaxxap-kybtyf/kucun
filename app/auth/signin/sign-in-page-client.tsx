'use client';

import { CheckCircle, Loader2, Lock, Shield, User } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import type { Session } from 'next-auth';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useForm } from 'react-hook-form';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
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
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/utils/console-logger';
import type { UserLoginInput } from '@/lib/validations/base';

type SignInPageClientProps = {
  callbackUrl: string;
  error?: string;
};

export default function SignInPageClient({
  callbackUrl,
  error,
}: SignInPageClientProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [captchaImage, setCaptchaImage] = useState('');
  const [captchaSessionId, setCaptchaSessionId] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const { toast } = useToast();

  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const redirectDelayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const form = useForm<UserLoginInput & { rememberMe?: boolean }>({
    mode: 'onSubmit',
    reValidateMode: 'onSubmit',
    defaultValues: {
      username: '',
      password: '',
      captcha: '',
      rememberMe: false,
    },
  });

  const errorMessages = useMemo(
    (): Record<string, string> & {
      CredentialsSignin: string;
      AccessDenied: string;
      MISSING_FIELDS: string;
      INVALID_FORMAT: string;
      INVALID_CREDENTIALS: string;
      ACCOUNT_DISABLED: string;
      CAPTCHA_SESSION_MISSING: string;
      CAPTCHA_VERIFY_FAILED: string;
      CAPTCHA_INCORRECT: string;
      TOO_MANY_ATTEMPTS: string;
      RATE_LIMIT_EXCEEDED: string;
      SERVER_ERROR: string;
      NETWORK_ERROR: string;
      Default: string;
    } => ({
      CredentialsSignin: '用户名或密码错误，请检查后重试',
      AccessDenied: '访问被拒绝，权限不足',
      MISSING_FIELDS: '请填写完整的登录信息',
      INVALID_FORMAT: '用户名、密码或验证码格式不正确',
      INVALID_CREDENTIALS: '用户名或密码错误，请检查后重试',
      ACCOUNT_DISABLED: '用户名或密码错误，请检查后重试',
      CAPTCHA_SESSION_MISSING: '验证码已失效，请重新获取',
      CAPTCHA_VERIFY_FAILED: '验证码验证失败，请重试',
      CAPTCHA_INCORRECT: '验证码错误，请重新输入',
      TOO_MANY_ATTEMPTS: '登录失败次数过多，请稍后再试',
      RATE_LIMIT_EXCEEDED: '认证请求过于频繁，请稍后再试',
      SERVER_ERROR: '服务器错误，请稍后重试',
      NETWORK_ERROR: '网络连接失败，请检查网络后重试',
      Default: '登录失败，请稍后重试',
    }),
    []
  );

  const loadCaptcha = useCallback(async () => {
    try {
      const response = await fetch('/api/captcha');
      if (response.ok) {
        const data = await response.json();
        setCaptchaImage(data.captchaImage);
        setCaptchaSessionId(data.sessionId);
      } else {
        logger.error('auth', '验证码加载失败: HTTP', response.status);
        toast({
          title: '验证码加载失败',
          description: '服务器响应异常,请刷新页面重试',
          variant: 'destructive',
        });
      }
    } catch (loadError) {
      logger.error('auth', '验证码加载失败:', loadError);
      toast({
        title: '验证码加载失败',
        description: '网络连接异常,请检查网络后重试',
        variant: 'destructive',
      });
    }
  }, [toast]);

  const handleLoginSuccess = useCallback(
    async (session: Session | null) => {
      if (!session) {
        return;
      }

      setIsSuccess(true);

      const userName = session.user?.name || '用户';
      const userRole = session.user?.role || 'user';
      const roleText = userRole === 'admin' ? '管理员' : '销售员';

      toast({
        title: '登录成功！',
        description: `欢迎回来，${userName}（${roleText}）`,
        variant: 'success',
      });

      redirectTimerRef.current = setTimeout(() => {
        setIsRedirecting(true);
        router.push(callbackUrl);
        router.refresh();
      }, 500);
    },
    [callbackUrl, router, toast]
  );

  useEffect(
    () => () => {
      if (redirectTimerRef.current) {
        clearTimeout(redirectTimerRef.current);
      }
      if (redirectDelayTimerRef.current) {
        clearTimeout(redirectDelayTimerRef.current);
      }
    },
    []
  );

  const handleLoginError = useCallback(
    (errorCode: string) => {
      logger.info('auth', '登录失败,错误代码:', errorCode);

      let errorMessage = errorMessages[errorCode] || errorMessages.Default;

      if (errorCode === 'CredentialsSignin') {
        errorMessage = errorMessages.INVALID_CREDENTIALS;
      }

      setFormError(errorMessage);
      form.setValue('captcha', '');
      loadCaptcha();

      toast({
        title: '登录失败',
        description: errorMessage,
        variant: 'destructive',
      });
    },
    [errorMessages, form, loadCaptcha, toast]
  );

  const handleNetworkError = useCallback(
    (networkError: unknown) => {
      logger.error('auth', '登录错误:', networkError);

      const isNetworkError =
        networkError instanceof TypeError &&
        networkError.message.includes('fetch');
      const errorMessage = isNetworkError
        ? errorMessages.NETWORK_ERROR
        : errorMessages.SERVER_ERROR;

      setFormError(errorMessage);
      form.setValue('captcha', '');
      loadCaptcha();

      toast({
        title: '登录失败',
        description: errorMessage,
        variant: 'destructive',
      });
    },
    [errorMessages, form, loadCaptcha, toast]
  );

  const handleSubmit = async (
    data: UserLoginInput & { rememberMe?: boolean }
  ) => {
    setIsLoading(true);
    setFormError('');
    setIsSuccess(false);

    try {
      const { getSession, signIn } = await import('next-auth/react');
      const result = await signIn('credentials', {
        username: data.username,
        password: data.password,
        captcha: data.captcha,
        captchaSessionId,
        rememberMe: data.rememberMe ?? false,
        redirect: false,
      });

      if (result?.error) {
        handleLoginError(result.error);
      } else if (result?.ok) {
        const session = await getSession();
        await handleLoginSuccess(session);
      }
    } catch (submitError) {
      handleNetworkError(submitError);
    } finally {
      if (!isSuccess) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    loadCaptcha();
  }, [loadCaptcha]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="relative w-full max-w-md space-y-8">
        {(isSuccess || isRedirecting) && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-md bg-white">
            <div className="space-y-4 text-center">
              {isRedirecting ? (
                <>
                  <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-600" />
                  <p className="text-sm font-medium text-blue-600">
                    正在进入首页...
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
            <CardTitle className="text-center text-2xl">瓷砖销售 ERP</CardTitle>
            <CardDescription className="text-center">
              请输入您的账户信息登录系统
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert className="mb-4" variant="destructive">
                <AlertDescription>
                  {errorMessages[error] || errorMessages.Default}
                </AlertDescription>
              </Alert>
            )}

            {isSuccess && (
              <Alert className="mb-4 border-green-200 bg-green-50 text-green-800">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  登录成功！正在进入首页...
                </AlertDescription>
              </Alert>
            )}

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
                <FormField
                  control={form.control}
                  name="username"
                  rules={{
                    required: '请输入用户名',
                    minLength: { value: 3, message: '用户名至少3个字符' },
                    maxLength: { value: 20, message: '用户名不能超过20个字符' },
                    pattern: {
                      value: /^[a-zA-Z0-9_-]+$/,
                      message: '用户名只能包含字母、数字、下划线和短横线',
                    },
                  }}
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
                          autoFocus
                          placeholder="请输入用户名"
                          disabled={isLoading}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  rules={{
                    required: '请输入密码',
                    minLength: { value: 8, message: '密码至少8个字符' },
                    maxLength: { value: 100, message: '密码不能超过100个字符' },
                  }}
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

                <FormField
                  control={form.control}
                  name="captcha"
                  rules={{
                    required: '请输入验证码',
                    minLength: { value: 4, message: '验证码格式不正确' },
                    maxLength: { value: 10, message: '验证码格式不正确' },
                    pattern: {
                      value: /^[a-zA-Z0-9]+$/,
                      message: '验证码只能包含字母和数字',
                    },
                  }}
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
                            maxLength={4}
                            autoComplete="off"
                          />
                        </FormControl>
                        <div className="flex items-center">
                          {captchaImage ? (
                            <button
                              type="button"
                              className="cursor-pointer rounded border transition-opacity hover:opacity-80"
                              onClick={loadCaptcha}
                              title="点击刷新验证码"
                            >
                              <Image
                                src={captchaImage}
                                alt="验证码"
                                width={120}
                                height={40}
                                className="h-10 w-[120px]"
                                unoptimized
                                draggable={false}
                              />
                            </button>
                          ) : (
                            <div className="h-10 w-[120px] rounded border bg-gray-200">
                              <div className="flex h-full items-center justify-center text-xs text-gray-400">
                                加载中...
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex items-center justify-between">
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-gray-600">
                    <input
                      type="checkbox"
                      className="h-3 w-3 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      checked={rememberMe}
                      onChange={event => {
                        const checked = event.target.checked;
                        setRememberMe(checked);
                        form.setValue('rememberMe', checked);
                      }}
                      disabled={isLoading}
                    />
                    <span>记住我（延长登录有效期）</span>
                  </label>
                </div>

                <Button
                  type="submit"
                  className={cn(
                    'w-full transition-all duration-300',
                    isSuccess &&
                      'border-[hsl(var(--color-success))] bg-[hsl(var(--color-success))] hover:bg-[hsl(var(--color-success-hover))]',
                    isRedirecting &&
                      'border-[hsl(var(--color-info))] bg-[hsl(var(--color-info))] hover:bg-[hsl(var(--color-info-hover))]'
                  )}
                  disabled={isLoading || isSuccess || isRedirecting}
                >
                  {isRedirecting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      正在进入首页...
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
              <p className="text-xs text-gray-500">
                点击验证码图片可刷新验证码
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
