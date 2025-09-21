'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Bell, Loader2, Mail, Volume2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
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
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/use-toast';
import {
  useNotificationSettings,
  useUpdateNotificationSettings,
} from '@/lib/api/settings';
import { hasPermission } from '@/lib/utils/permissions';
import {
  NotificationSettingsSchema,
  notificationSettingsDefaults,
  type NotificationSettingsFormData,
} from '@/lib/validations/settings';

/**
 * 通知设置页面
 * 提供消息提醒、预警配置、邮件通知等通知设置功能
 */
const NotificationSettingsPage = () => {
  const { data: session } = useSession();
  const router = useRouter();
  const [hasAccess, setHasAccess] = useState(false);

  // 权限检查
  useEffect(() => {
    if (session?.user) {
      const canAccess = hasPermission(
        session.user.role,
        'settings:notifications'
      );
      setHasAccess(canAccess);
      if (!canAccess) {
        toast({
          title: '权限不足',
          description: '您没有权限访问通知设置',
          variant: 'destructive',
        });
        router.push('/dashboard');
      }
    }
  }, [session, router]);

  // 数据查询和更新
  const { data: settingsData, isLoading, error } = useNotificationSettings();
  const updateMutation = useUpdateNotificationSettings();

  // 表单配置
  const form = useForm<NotificationSettingsFormData>({
    resolver: zodResolver(NotificationSettingsSchema),
    defaultValues: notificationSettingsDefaults,
  });

  // 当数据加载完成时更新表单
  useEffect(() => {
    if (settingsData?.data?.notifications) {
      form.reset(settingsData.data.notifications);
    }
  }, [settingsData, form]);

  // 表单提交处理
  const onSubmit = async (data: NotificationSettingsFormData) => {
    try {
      await updateMutation.mutateAsync(data);
      toast({
        title: '保存成功',
        description: '通知设置已更新',
      });
    } catch (error) {
      toast({
        title: '保存失败',
        description: '更新通知设置时出现错误，请稍后重试',
        variant: 'destructive',
      });
    }
  };

  // 权限检查中
  if (!session) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // 无权限访问
  if (!hasAccess) {
    return null;
  }

  // 加载中状态
  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // 错误状态
  if (error) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-center">
          <p className="text-destructive">加载通知设置失败</p>
          <Button
            variant="outline"
            onClick={() => window.location.reload()}
            className="mt-4"
          >
            重试
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center space-x-2">
        <Bell className="h-6 w-6" />
        <h1 className="text-2xl font-bold">通知设置</h1>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* 系统通知 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Bell className="h-5 w-5" />
                <span>系统通知</span>
              </CardTitle>
              <CardDescription>配置系统内的各种通知提醒</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="enableSystemNotifications"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">启用系统通知</FormLabel>
                      <FormDescription>
                        接收系统重要消息和状态更新
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="enableOrderNotifications"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">订单通知</FormLabel>
                      <FormDescription>
                        新订单、订单状态变更等通知
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="enableLowStockAlerts"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">库存预警</FormLabel>
                      <FormDescription>库存不足时发送预警通知</FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="lowStockThresholdPercent"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>库存预警阈值 (%)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={50}
                        {...field}
                        onChange={e => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormDescription>
                      当库存低于此百分比时触发预警（1-50%）
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* 声音提醒 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Volume2 className="h-5 w-5" />
                <span>声音提醒</span>
              </CardTitle>
              <CardDescription>配置声音提醒选项</CardDescription>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="enableSoundAlerts"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">启用声音提醒</FormLabel>
                      <FormDescription>重要通知时播放提示音</FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* 邮件通知 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Mail className="h-5 w-5" />
                <span>邮件通知</span>
              </CardTitle>
              <CardDescription>配置邮件通知和接收者</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="enableEmailNotifications"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">启用邮件通知</FormLabel>
                      <FormDescription>通过邮件发送重要通知</FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="emailRecipients"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>邮件接收者</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="输入邮箱地址，多个邮箱用逗号分隔"
                        value={field.value?.join(', ') || ''}
                        onChange={e => {
                          const emails = e.target.value
                            .split(',')
                            .map(email => email.trim())
                            .filter(email => email.length > 0);
                          field.onChange(emails);
                        }}
                      />
                    </FormControl>
                    <FormDescription>
                      设置接收邮件通知的邮箱地址，最多10个
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* 保存按钮 */}
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={updateMutation.isPending}
              className="min-w-[120px]"
            >
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  保存中...
                </>
              ) : (
                '保存设置'
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
};

export default NotificationSettingsPage;
