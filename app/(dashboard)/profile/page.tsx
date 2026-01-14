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
    Shield
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
    <div className="flex h-full flex-col overflow-y-auto bg-slate-50/50 p-4 lg:p-10 xl:p-14">
      <div className="mx-auto w-full max-w-[1680px] space-y-10">
        {/* 1. Identity Header: 简化并增强对齐 */}
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between px-2">
          <div className="flex items-center gap-6">
            <div className="relative">
              <Avatar className="h-20 w-20 ring-4 ring-white shadow-xl">
                <AvatarFallback className="bg-slate-900 text-2xl font-black text-white">
                  {displayUser ? getInitials(displayUser.name) : '用户'}
                </AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-white">
                 <div className="h-2 w-2 rounded-full bg-white animate-pulse" />
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-black tracking-tighter text-slate-900">
                  {displayUser?.name || '我的资料'}
                </h1>
                <Badge className="bg-slate-900 text-white hover:bg-slate-800 text-[10px] font-black uppercase tracking-widest px-2.5 py-1">
                  {getUserRoleLabel(displayUser?.role || '')}
                </Badge>
              </div>
              <p className="text-sm font-bold text-slate-400">
                {displayUser?.email} <span className="mx-2 text-slate-200">|</span> 登录账号: {displayUser?.username}
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-12 lg:grid-cols-[2fr_1fr]">
          {/* 左侧：聚合基本信息表单 (Main Container) */}
          <div className="space-y-8">
            <section className="space-y-4">
              <div className="flex flex-col gap-1 px-1">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">基本信息管理</h3>
                <p className="text-[11px] font-medium text-slate-400">在此管理您的显示姓名和联系方式</p>
              </div>
              
              <Form {...profileForm}>
                <form onSubmit={handleProfileSubmit} className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm transition-all hover:shadow-md">
                  <div className="divide-y divide-slate-100">
                    {/* 姓名行 */}
                    <div className="flex flex-col md:flex-row md:items-center gap-6 p-8">
                      <div className="w-full md:w-1/3">
                        <FormLabel className="text-sm font-black text-slate-900">您的姓名</FormLabel>
                        <p className="text-[11px] font-medium text-slate-400 mt-1">系统内部显示的名称</p>
                      </div>
                      <div className="flex-1">
                        <FormField
                          control={profileForm.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem className="space-y-1">
                              <FormControl>
                                <Input
                                  {...field}
                                  placeholder="请输入姓名"
                                  className="h-10 border-slate-100 bg-slate-50/30 px-4 font-bold transition-all focus:bg-white focus:ring-4 focus:ring-blue-500/5"
                                  disabled={isLoadingProfile || isSavingProfile}
                                />
                              </FormControl>
                              <FormMessage className="text-[10px] font-bold" />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    {/* 邮箱行 */}
                    <div className="flex flex-col md:flex-row md:items-center gap-6 p-8 bg-slate-50/20">
                      <div className="w-full md:w-1/3">
                        <FormLabel className="text-sm font-black text-slate-900">电子邮箱</FormLabel>
                        <p className="text-[11px] font-medium text-slate-400 mt-1">用于接收系统通知和找回密码</p>
                      </div>
                      <div className="flex-1">
                        <FormField
                          control={profileForm.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem className="space-y-1">
                              <FormControl>
                                <Input
                                  {...field}
                                  type="email"
                                  placeholder="请输入邮箱地址"
                                  className="h-10 border-slate-100 bg-slate-50/30 px-4 font-bold transition-all focus:bg-white focus:ring-4 focus:ring-blue-500/5"
                                  disabled={isLoadingProfile || isSavingProfile}
                                />
                              </FormControl>
                              <FormMessage className="text-[10px] font-bold" />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    {/* 只读项：账号标识 */}
                    <div className="flex flex-col md:flex-row md:items-center gap-6 p-8">
                      <div className="w-full md:w-1/3">
                        <span className="text-sm font-black text-slate-900">登录账号 (ID)</span>
                        <p className="text-[11px] font-medium text-slate-400 mt-1">您的系统唯一账号标识，不可更改</p>
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-mono font-black text-slate-500 bg-slate-100/50 px-4 py-2 rounded-lg inline-block">
                          {displayUser?.username || '—'}
                        </div>
                      </div>
                    </div>

                    {/* 只读项：周期信息 */}
                    <div className="flex flex-col md:flex-row md:items-center gap-6 p-8 bg-slate-50/20">
                      <div className="w-full md:w-1/3">
                        <span className="text-sm font-black text-slate-900">账户信息</span>
                        <p className="text-[11px] font-medium text-slate-400 mt-1">您的注册日期与当前身份角色</p>
                      </div>
                      <div className="flex-1 flex items-center gap-6">
                         <div className="space-y-1">
                            <span className="text-[10px] font-black uppercase text-slate-300 block">注册于</span>
                            <span className="text-xs font-bold text-slate-600">
                               {displayUser?.createdAt ? new Date(displayUser.createdAt).toLocaleDateString() : '—'}
                            </span>
                         </div>
                         <div className="h-8 w-px bg-slate-200" />
                         <div className="space-y-1">
                            <span className="text-[10px] font-black uppercase text-slate-300 block">账户角色</span>
                            <span className="text-xs font-bold text-slate-600">
                               {getUserRoleLabel(displayUser?.role || '')}
                            </span>
                         </div>
                      </div>
                    </div>
                  </div>

                  {/* 底部按钮栏 */}
                  <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/30 p-6">
                    <p className="text-[11px] font-medium text-slate-400">
                      提示：点击下方按钮将立即更新您的个人信息。
                    </p>
                    <Button
                      type="submit"
                      className="h-11 rounded-2xl bg-slate-900 px-8 text-xs font-black shadow-lg shadow-slate-900/10 hover:bg-slate-800 transition-all active:scale-95"
                      disabled={isLoadingProfile || isSavingProfile}
                    >
                      {isSavingProfile ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Shield className="mr-2 h-4 w-4" />
                      )}
                      确认保存修改
                    </Button>
                  </div>
                </form>
              </Form>
            </section>
          </div>

          {/* 右侧：安全设置与日志 (Sidebar Container) */}
          <div className="space-y-8">
            <section className="space-y-4">
              <div className="flex flex-col gap-1 px-1">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">账号安全管理</h3>
                <p className="text-[11px] font-medium text-slate-400">建议定期修改密码以保障账号安全</p>
              </div>

              <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white p-6 shadow-sm transition-all hover:shadow-md">
                <Form {...passwordForm}>
                  <form onSubmit={handlePasswordSubmit} className="space-y-6">
                    <FormField
                      control={passwordForm.control}
                      name="currentPassword"
                      render={({ field }) => (
                        <FormItem className="space-y-2">
                          <FormLabel className="text-[11px] font-black uppercase tracking-wider text-slate-400">验证当前密码</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="password"
                              className="h-11 border-slate-100 bg-slate-50/30 focus:bg-white focus:ring-4 focus:ring-blue-500/5 font-bold"
                              disabled={isChangingPassword}
                            />
                          </FormControl>
                          <FormMessage className="text-[10px] font-bold" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={passwordForm.control}
                      name="newPassword"
                      render={({ field }) => (
                        <FormItem className="space-y-2">
                          <FormLabel className="text-[11px] font-black uppercase tracking-wider text-slate-400">设置新密码</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="password"
                              className="h-11 border-slate-100 bg-slate-50/30 focus:bg-white focus:ring-4 focus:ring-blue-500/5 font-bold"
                              disabled={isChangingPassword}
                            />
                          </FormControl>
                          <FormMessage className="text-[10px] font-bold" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={passwordForm.control}
                      name="confirmNewPassword"
                      render={({ field }) => (
                        <FormItem className="space-y-2">
                          <FormLabel className="text-[11px] font-black uppercase tracking-wider text-slate-400">再次确认新密码</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="password"
                              className="h-11 border-slate-100 bg-slate-50/30 focus:bg-white focus:ring-4 focus:ring-blue-500/5 font-bold"
                              disabled={isChangingPassword}
                            />
                          </FormControl>
                          <FormMessage className="text-[10px] font-bold" />
                        </FormItem>
                      )}
                    />

                    <Button
                      type="submit"
                      variant="outline"
                      className="w-full h-12 rounded-2xl border-slate-200 text-xs font-black text-slate-900 hover:bg-slate-50 transition-all active:scale-[0.98]"
                      disabled={isChangingPassword}
                    >
                      {isChangingPassword ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <KeyRound className="mr-2 h-4 w-4" />
                      )}
                      确认更新密码
                    </Button>
                  </form>
                </Form>
              </div>
            </section>

            {/* 精简登录日志 */}
            <section className="space-y-4">
              <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400 px-1">最近登录记录</h3>
              <div className="rounded-2xl border border-slate-100 bg-white/60 p-2 overflow-hidden">
                <div className="space-y-1">
                  {isLoadingLogs ? (
                    <div className="py-6 text-center text-slate-300">
                      <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                    </div>
                  ) : loginLogs.length === 0 ? (
                    <div className="py-6 text-center text-[10px] font-bold text-slate-300 uppercase">暂无登录历史</div>
                  ) : (
                    loginLogs.slice(0, 3).map((log, index) => (
                      <div key={index} className="flex items-center justify-between p-3 rounded-xl hover:bg-white transition-all group">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                             "h-2 w-2 rounded-full",
                             log.type === 'success' ? "bg-emerald-500 shadow-lg shadow-emerald-500/30" : "bg-rose-500 shadow-lg shadow-rose-500/30"
                          )} />
                          <div className="flex flex-col">
                            <span className="text-[11px] font-black text-slate-900">
                               {log.type === 'success' ? '登录成功' : '非法拦截'}
                            </span>
                            <span className="text-[9px] font-mono font-bold text-slate-400">
                               IP: {log.clientIp}
                            </span>
                          </div>
                        </div>
                        <span className="text-[9px] font-black text-slate-300 uppercase text-right">
                           {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
