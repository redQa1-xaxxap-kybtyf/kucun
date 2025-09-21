/**
 * 用户管理设置页面
 * 管理角色权限、密码策略、会话管理等用户安全设置
 */

'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  ArrowLeft,
  Clock,
  Lock,
  RotateCcw,
  Save,
  Shield,
  Users,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';

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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import {
  useCategorySettings,
  useResetSettings,
  useUpdateSettings,
} from '@/lib/api/settings';
import { usePermissions } from '@/lib/utils/permissions';
import {
  UserManagementSettingsSchema,
  userManagementSettingsDefaults,
  type UserManagementSettingsFormData,
} from '@/lib/validations/settings';

const UserManagementSettingsPage = () => {
  const router = useRouter();
  const { data: session } = useSession();
  const permissions = usePermissions(session?.user?.role);
  const { toast } = useToast();

  const {
    data: settingsResponse,
    isLoading,
    error,
  } = useCategorySettings('userManagement');
  const updateSettingsMutation = useUpdateSettings();
  const resetSettingsMutation = useResetSettings();

  const form = useForm<UserManagementSettingsFormData>({
    resolver: zodResolver(UserManagementSettingsSchema),
    defaultValues: userManagementSettingsDefaults,
  });

  // 权限检查
  useEffect(() => {
    if (!permissions.isAdmin()) {
      router.push('/settings');
    }
  }, [permissions, router]);

  // 当设置数据加载完成时，填充表单
  useEffect(() => {
    if (settingsResponse?.data?.userManagement) {
      const userManagementSettings = settingsResponse.data.userManagement;
      form.reset({
        passwordMinLength: userManagementSettings.passwordMinLength || 8,
        passwordRequireUppercase:
          userManagementSettings.passwordRequireUppercase ?? true,
        passwordRequireLowercase:
          userManagementSettings.passwordRequireLowercase ?? true,
        passwordRequireNumbers:
          userManagementSettings.passwordRequireNumbers ?? true,
        passwordRequireSpecialChars:
          userManagementSettings.passwordRequireSpecialChars ?? false,
        sessionTimeoutHours: userManagementSettings.sessionTimeoutHours || 8,
        maxLoginAttempts: userManagementSettings.maxLoginAttempts || 5,
        lockoutDurationMinutes:
          userManagementSettings.lockoutDurationMinutes || 30,
        enableTwoFactor: userManagementSettings.enableTwoFactor ?? false,
      });
    }
  }, [settingsResponse, form]);

  const onSubmit = async (data: UserManagementSettingsFormData) => {
    try {
      await updateSettingsMutation.mutateAsync({
        category: 'userManagement',
        data,
      });

      toast({
        title: '保存成功',
        description: '用户管理设置已更新',
      });
    } catch (error) {
      toast({
        title: '保存失败',
        description:
          error instanceof Error ? error.message : '更新用户管理设置失败',
        variant: 'destructive',
      });
    }
  };

  const handleReset = async () => {
    try {
      await resetSettingsMutation.mutateAsync('userManagement');

      toast({
        title: '重置成功',
        description: '用户管理设置已重置为默认值',
      });
    } catch (error) {
      toast({
        title: '重置失败',
        description:
          error instanceof Error ? error.message : '重置用户管理设置失败',
        variant: 'destructive',
      });
    }
  };

  const isSubmitting =
    updateSettingsMutation.isPending || resetSettingsMutation.isPending;

  if (isLoading) {
    return (
      <div className="container mx-auto space-y-6 py-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-1/4 rounded bg-gray-200"></div>
          <div className="h-64 rounded bg-gray-200"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto space-y-6 py-6">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">加载失败</CardTitle>
            <CardDescription>
              无法加载用户管理设置信息，请刷新页面重试。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => window.location.reload()}>刷新页面</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-6 py-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回
          </Button>
          <div>
            <h1 className="flex items-center text-2xl font-bold">
              <Users className="mr-2 h-6 w-6" />
              用户管理设置
            </h1>
            <p className="text-muted-foreground">
              配置用户权限、密码策略和安全设置
            </p>
          </div>
        </div>
      </div>

      <Separator />

      {/* 设置表单 */}
      <div className="max-w-2xl">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* 密码策略 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Lock className="mr-2 h-5 w-5" />
                  密码策略
                </CardTitle>
                <CardDescription>
                  配置用户密码的复杂度要求和安全规则
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 密码最小长度 */}
                <FormField
                  control={form.control}
                  name="passwordMinLength"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>密码最小长度</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="6"
                          max="32"
                          disabled={isSubmitting}
                          {...field}
                          onChange={e =>
                            field.onChange(parseInt(e.target.value))
                          }
                        />
                      </FormControl>
                      <FormDescription>
                        用户密码的最小字符数，建议不少于8位
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {/* 要求大写字母 */}
                  <FormField
                    control={form.control}
                    name="passwordRequireUppercase"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">
                            要求大写字母
                          </FormLabel>
                          <FormDescription>
                            密码必须包含至少一个大写字母
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            disabled={isSubmitting}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {/* 要求小写字母 */}
                  <FormField
                    control={form.control}
                    name="passwordRequireLowercase"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">
                            要求小写字母
                          </FormLabel>
                          <FormDescription>
                            密码必须包含至少一个小写字母
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            disabled={isSubmitting}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {/* 要求数字 */}
                  <FormField
                    control={form.control}
                    name="passwordRequireNumbers"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">要求数字</FormLabel>
                          <FormDescription>
                            密码必须包含至少一个数字
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            disabled={isSubmitting}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {/* 要求特殊字符 */}
                  <FormField
                    control={form.control}
                    name="passwordRequireSpecialChars"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">
                            要求特殊字符
                          </FormLabel>
                          <FormDescription>
                            密码必须包含特殊字符(!@#$%等)
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            disabled={isSubmitting}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* 会话管理 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Clock className="mr-2 h-5 w-5" />
                  会话管理
                </CardTitle>
                <CardDescription>
                  配置用户会话超时和登录安全设置
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {/* 会话超时时间 */}
                  <FormField
                    control={form.control}
                    name="sessionTimeoutHours"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>会话超时时间（小时）</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="1"
                            max="24"
                            disabled={isSubmitting}
                            {...field}
                            onChange={e =>
                              field.onChange(parseInt(e.target.value))
                            }
                          />
                        </FormControl>
                        <FormDescription>
                          用户无操作后自动登出的时间
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* 最大登录尝试次数 */}
                  <FormField
                    control={form.control}
                    name="maxLoginAttempts"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>最大登录尝试次数</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="3"
                            max="10"
                            disabled={isSubmitting}
                            {...field}
                            onChange={e =>
                              field.onChange(parseInt(e.target.value))
                            }
                          />
                        </FormControl>
                        <FormDescription>超过此次数将锁定账户</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* 锁定时间 */}
                  <FormField
                    control={form.control}
                    name="lockoutDurationMinutes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>锁定时间（分钟）</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="5"
                            max="1440"
                            disabled={isSubmitting}
                            {...field}
                            onChange={e =>
                              field.onChange(parseInt(e.target.value))
                            }
                          />
                        </FormControl>
                        <FormDescription>账户被锁定的持续时间</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* 高级安全设置 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Shield className="mr-2 h-5 w-5" />
                  高级安全设置
                </CardTitle>
                <CardDescription>配置额外的安全功能和验证方式</CardDescription>
              </CardHeader>
              <CardContent>
                {/* 启用双因素认证 */}
                <FormField
                  control={form.control}
                  name="enableTwoFactor"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">
                          启用双因素认证
                        </FormLabel>
                        <FormDescription>
                          要求用户使用手机验证码或认证器应用进行二次验证
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          disabled={isSubmitting}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* 操作按钮 */}
            <div className="flex justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={handleReset}
                disabled={isSubmitting}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                重置为默认值
              </Button>

              <Button type="submit" disabled={isSubmitting}>
                <Save className="mr-2 h-4 w-4" />
                {isSubmitting ? '保存中...' : '保存设置'}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
};

export default UserManagementSettingsPage;
