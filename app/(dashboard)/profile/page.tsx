/**
 * 个人资料页面
 *
 * 路由：/profile
 * 功能：
 * - 展示当前登录用户的基本信息
 * - 支持修改姓名
 * - 支持修改登录密码
 */

'use client';

import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import {
  KeyRound,
  Loader2,
  Mail,
  Shield,
  User as UserIcon,
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/use-toast';
import { csrfFetch } from '@/lib/utils/csrf';
import { changePasswordSchema } from '@/lib/validations/user';

// 个人资料接口响应类型（与 /api/profile 保持一致）
interface ProfileInfo {
  id: string;
  email: string;
  username: string;
  name: string;
  role: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

// 个人资料表单 schema（允许修改姓名和邮箱）
const profileFormSchema = z.object({
  name: z
    .string({ message: '姓名必须是字符串' })
    .min(1, { message: '请输入姓名' })
    .max(100, { message: '姓名不能超过100个字符' }),
  email: z
    .string({ message: '邮箱必须是字符串' })
    .email({ message: '请输入有效的邮箱地址' })
    .max(100, { message: '邮箱不能超过100个字符' }),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;
type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;

// 登录日志 DTO（与 /api/profile/login-logs 保持一致）
interface LoginLogDto {
  type: 'success' | 'failed' | 'blocked';
  failureReason?:
    | 'invalid_credentials'
    | 'account_disabled'
    | 'captcha_incorrect'
    | 'captcha_expired'
    | 'too_many_attempts'
    | 'ip_blocked'
    | 'other';
  clientIp: string;
  userAgent?: string;
  timestamp: string; // ISO 字符串
}

function getUserRoleLabel(role: string): string {
  if (role === 'admin') return '管理员';
  if (role === 'sales') return '销售员';
  return role;
}

function getUserStatusLabel(status: string): string {
  if (status === 'active') return '正常';
  if (status === 'inactive') return '停用';
  if (status === 'suspended') return '已冻结';
  return status;
}

function getInitials(name: string) {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default function ProfilePage() {
  const { data: session } = useSession();
  const { toast } = useToast();

  const [profile, setProfile] = React.useState<ProfileInfo | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = React.useState(true);
  const [isSavingProfile, setIsSavingProfile] = React.useState(false);
  const [isChangingPassword, setIsChangingPassword] = React.useState(false);
  const [loginLogs, setLoginLogs] = React.useState<LoginLogDto[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = React.useState(true);

  const profileForm = useForm<ProfileFormValues>({
    resolver: standardSchemaResolver(profileFormSchema),
    mode: 'onBlur',
    defaultValues: {
      name: session?.user?.name || '',
      email: session?.user?.email || '',
    },
  });

  const passwordForm = useForm<ChangePasswordFormValues>({
    resolver: standardSchemaResolver(changePasswordSchema),
    mode: 'onBlur',
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmNewPassword: '',
    },
  });

  // 加载个人资料数据
  React.useEffect(() => {
    let isMounted = true;

    const loadProfile = async () => {
      try {
        setIsLoadingProfile(true);
        const response = await csrfFetch('/api/profile');
        if (!response.ok) {
          const error = await response.json().catch(() => null);
          const message = error?.error || error?.message || '获取个人资料失败';
          throw new Error(message);
        }
        const result = (await response.json()) as {
          success: boolean;
          data?: ProfileInfo;
          error?: string;
        };

        if (!result.success || !result.data) {
          throw new Error(result.error || '获取个人资料失败');
        }

        if (!isMounted) return;

        setProfile(result.data);
        profileForm.reset({
          name: result.data.name,
          email: result.data.email,
        });
      } catch (error) {
        if (!isMounted) return;
        const message =
          error instanceof Error ? error.message : '获取个人资料失败';
        toast({
          variant: 'destructive',
          title: '加载失败',
          description: message,
        });
      } finally {
        if (isMounted) {
          setIsLoadingProfile(false);
        }
      }
    };

    const loadLogs = async () => {
      try {
        setIsLoadingLogs(true);
        const response = await csrfFetch('/api/profile/login-logs');
        if (!response.ok) {
          const error = await response.json().catch(() => null);
          const message = error?.error || error?.message || '获取登录日志失败';
          // 未登录或会话失效时，不把错误当成异常处理，静默忽略
          if (response.status === 401 || response.status === 403) {
            if (!isMounted) return;
            setLoginLogs([]);
            return;
          }
          throw new Error(message);
        }

        const result = (await response.json()) as {
          success: boolean;
          data?: { logs: LoginLogDto[] };
          error?: string;
        };

        if (!result.success || !result.data) {
          throw new Error(result.error || '获取登录日志失败');
        }

        if (!isMounted) return;

        setLoginLogs(result.data.logs);
      } catch (error) {
        if (!isMounted) return;
        // 登录日志失败不影响主流程，只在控制台记录
        // eslint-disable-next-line no-console
        console.warn(
          '加载登录日志失败',
          error instanceof Error ? error.message : error
        );
      } finally {
        if (isMounted) {
          setIsLoadingLogs(false);
        }
      }
    };

    void loadProfile();
    void loadLogs();

    return () => {
      isMounted = false;
    };
  }, [profileForm, toast]);

  const handleProfileSubmit = profileForm.handleSubmit(
    async (values: ProfileFormValues) => {
      try {
        setIsSavingProfile(true);
        const response = await csrfFetch('/api/profile', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(values),
        });

        if (!response.ok) {
          const error = await response.json().catch(() => null);
          const message = error?.error || error?.message || '更新个人资料失败';
          throw new Error(message);
        }

        const result = (await response.json()) as {
          success: boolean;
          data?: ProfileInfo;
          error?: string;
          message?: string;
        };

        if (!result.success || !result.data) {
          throw new Error(result.error || '更新个人资料失败');
        }

        setProfile(result.data);

        toast({
          title: '保存成功',
          description: result.message || '个人资料已更新',
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : '更新个人资料失败';
        toast({
          variant: 'destructive',
          title: '保存失败',
          description: message,
        });
      } finally {
        setIsSavingProfile(false);
      }
    }
  );

  const handlePasswordSubmit = passwordForm.handleSubmit(
    async (values: ChangePasswordFormValues) => {
      try {
        setIsChangingPassword(true);
        const response = await csrfFetch('/api/profile/change-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(values),
        });

        if (!response.ok) {
          const error = await response.json().catch(() => null);
          const message = error?.error || error?.message || '修改密码失败';
          throw new Error(message);
        }

        const result = (await response.json()) as {
          success: boolean;
          error?: string;
          message?: string;
        };

        if (!result.success) {
          throw new Error(result.error || '修改密码失败');
        }

        // 修改成功后清空表单
        passwordForm.reset({
          currentPassword: '',
          newPassword: '',
          confirmNewPassword: '',
        });

        toast({
          title: '密码已更新',
          description: result.message || '请使用新密码重新登录系统',
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : '修改密码失败';
        toast({
          variant: 'destructive',
          title: '修改失败',
          description: message,
        });
      } finally {
        setIsChangingPassword(false);
      }
    }
  );

  const displayUser =
    profile ??
    (session?.user && {
      id: session.user.id,
      email: session.user.email,
      username: session.user.username,
      name: session.user.name,
      role: session.user.role,
      status: session.user.status,
      createdAt: '',
      updatedAt: '',
    });

  return (
    <div className="flex h-full flex-col overflow-auto p-6">
      <div className="space-y-6">
        {/* 头部标题 */}
        <Card className="overflow-hidden shadow-[var(--shadow-medium)]">
          <CardContent className="bg-gradient-to-r from-[hsl(var(--color-primary-light))] to-[hsl(var(--color-primary-lighter))] p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[hsl(var(--color-primary))] shadow-[0_10px_24px_rgba(9,88,217,0.22)]">
                  <UserIcon className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-[hsl(var(--color-text-primary))]">
                    个人资料
                  </h1>
                  <p className="text-sm text-[hsl(var(--color-text-secondary))]">
                    查看并管理您的账户信息与登录密码
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)]">
          {/* 基本信息 + 登录日志 */}
          <div className="space-y-4">
            {/* 基本信息 */}
            <Card className="shadow-[var(--shadow-light)]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <UserIcon className="h-5 w-5" />
                  基本信息
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback>
                      {displayUser ? getInitials(displayUser.name) : 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="space-y-1">
                    <div className="text-sm font-medium">
                      {displayUser?.name || '—'}
                    </div>
                    <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
                      <span className="inline-flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {displayUser?.email || '—'}
                      </span>
                      {displayUser && (
                        <>
                          <Separator orientation="vertical" className="h-3" />
                          <Badge variant="outline-solid" className="text-xs">
                            {getUserRoleLabel(displayUser.role)}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {getUserStatusLabel(displayUser.status)}
                          </Badge>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <Separator />

                <Form {...profileForm}>
                  <form onSubmit={handleProfileSubmit} className="space-y-4">
                    <FormField
                      control={profileForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>姓名</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="请输入您的姓名"
                              disabled={isLoadingProfile || isSavingProfile}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={profileForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>邮箱</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="email"
                              placeholder="请输入您的邮箱"
                              disabled={isLoadingProfile || isSavingProfile}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="text-muted-foreground space-y-1 text-sm">
                        <div className="text-xs font-medium text-[hsl(var(--color-text-secondary))]">
                          用户名
                        </div>
                        <div className="bg-muted rounded-md px-3 py-2 text-xs">
                          {displayUser?.username || '—'}
                        </div>
                      </div>
                      <div className="text-muted-foreground space-y-1 text-sm">
                        <div className="text-xs font-medium text-[hsl(var(--color-text-secondary))]">
                          账户角色
                        </div>
                        <div className="bg-muted rounded-md px-3 py-2 text-xs">
                          {displayUser
                            ? getUserRoleLabel(displayUser.role)
                            : '—'}
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button
                        type="submit"
                        size="sm"
                        disabled={isLoadingProfile || isSavingProfile}
                      >
                        {isSavingProfile && (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        保存资料
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>

            {/* 登录日志 */}
            <Card className="shadow-[var(--shadow-light)]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <Shield className="h-5 w-5" />
                  登录日志
                </CardTitle>
              </CardHeader>
              <CardContent className="text-muted-foreground space-y-3 text-xs">
                {isLoadingLogs ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>登录日志加载中...</span>
                  </div>
                ) : loginLogs.length === 0 ? (
                  <div className="text-[hsl(var(--color-text-secondary))]">
                    暂无登录记录。
                  </div>
                ) : (
                  <div className="space-y-2">
                    {loginLogs.map((log, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between rounded-md bg-[hsl(var(--color-bg-tertiary))] px-3 py-2"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={
                                log.type === 'success'
                                  ? 'outline'
                                  : log.type === 'failed'
                                    ? 'destructive'
                                    : 'secondary'
                              }
                              className="px-2 py-0 text-[10px]"
                            >
                              {log.type === 'success'
                                ? '登录成功'
                                : log.type === 'failed'
                                  ? '登录失败'
                                  : '被阻止'}
                            </Badge>
                            {log.failureReason && (
                              <span>
                                原因：
                                {log.failureReason === 'invalid_credentials' &&
                                  '用户名或密码错误'}
                                {log.failureReason === 'account_disabled' &&
                                  '账户被禁用'}
                                {log.failureReason === 'captcha_incorrect' &&
                                  '验证码错误'}
                                {log.failureReason === 'captcha_expired' &&
                                  '验证码过期'}
                                {log.failureReason === 'too_many_attempts' &&
                                  '尝试次数过多'}
                                {log.failureReason === 'ip_blocked' &&
                                  'IP 被封禁'}
                                {log.failureReason === 'other' && '其他原因'}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span>IP：{log.clientIp}</span>
                            {log.userAgent && (
                              <>
                                <Separator
                                  orientation="vertical"
                                  className="h-3"
                                />
                                <span className="max-w-[220px] truncate">
                                  UA：{log.userAgent}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="ml-4 text-[10px] whitespace-nowrap text-[hsl(var(--color-text-secondary))]">
                          {new Date(log.timestamp).toLocaleString('zh-CN')}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* 账户安全 / 修改密码 */}
          <Card className="shadow-[var(--shadow-light)]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Shield className="h-5 w-5" />
                账户安全
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-md bg-[hsl(var(--color-bg-tertiary))] px-3 py-2 text-xs text-[hsl(var(--color-text-secondary))]">
                建议定期更新密码，并避免在不同系统中重复使用相同密码。
              </div>

              <Separator />

              <Form {...passwordForm}>
                <form onSubmit={handlePasswordSubmit} className="space-y-3">
                  <FormField
                    control={passwordForm.control}
                    name="currentPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>当前密码</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="password"
                            placeholder="请输入当前登录密码"
                            disabled={isChangingPassword}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={passwordForm.control}
                    name="newPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>新密码</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="password"
                            placeholder="至少8位，包含大小写字母和数字"
                            disabled={isChangingPassword}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={passwordForm.control}
                    name="confirmNewPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>确认新密码</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="password"
                            placeholder="请再次输入新密码"
                            disabled={isChangingPassword}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      size="sm"
                      variant="outline"
                      disabled={isChangingPassword}
                    >
                      {isChangingPassword && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      <KeyRound className="mr-2 h-4 w-4" />
                      修改密码
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
