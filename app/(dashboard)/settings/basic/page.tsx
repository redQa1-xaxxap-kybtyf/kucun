/**
 * 基础设置页面
 * 管理公司信息、系统名称、Logo等基础配置
 */

'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Building, RotateCcw, Save, Upload } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  useCategorySettings,
  useResetSettings,
  useUpdateSettings,
} from '@/lib/api/settings';
import {
  CURRENCY_OPTIONS,
  LANGUAGE_OPTIONS,
  TIMEZONE_OPTIONS,
} from '@/lib/types/settings';
import { usePermissions } from '@/lib/utils/permissions';
import {
  BasicSettingsSchema,
  basicSettingsDefaults,
  type BasicSettingsFormData,
} from '@/lib/validations/settings';

const BasicSettingsPage = () => {
  const router = useRouter();
  const { data: session } = useSession();
  const permissions = usePermissions(
    session?.user?.role as 'admin' | 'sales' | undefined
  );
  const { toast } = useToast();

  const {
    data: settingsResponse,
    isLoading,
    error,
  } = useCategorySettings('basic');
  const updateSettingsMutation = useUpdateSettings();
  const resetSettingsMutation = useResetSettings();

  const form = useForm<BasicSettingsFormData>({
    resolver: zodResolver(BasicSettingsSchema),
    defaultValues: basicSettingsDefaults,
  });

  // 权限检查
  useEffect(() => {
    if (!permissions.isAdmin()) {
      router.push('/settings');
    }
  }, [permissions, router]);

  // 当设置数据加载完成时，填充表单
  useEffect(() => {
    if (settingsResponse?.data?.basic) {
      const basicSettings = settingsResponse.data.basic;
      form.reset({
        companyName: basicSettings.companyName || '',
        systemName: basicSettings.systemName || '',
        logoUrl: basicSettings.logoUrl || '',
        timezone: basicSettings.timezone || 'Asia/Shanghai',
        language: basicSettings.language || 'zh-CN',
        currency: basicSettings.currency || 'CNY',
        address: basicSettings.address || '',
        phone: basicSettings.phone || '',
        email: basicSettings.email || '',
      });
    }
  }, [settingsResponse, form]);

  const onSubmit = async (data: BasicSettingsFormData) => {
    try {
      await updateSettingsMutation.mutateAsync({
        category: 'basic',
        data: {
          ...data,
          logoUrl: data.logoUrl || undefined,
        },
      });

      toast({
        title: '保存成功',
        description: '基础设置已更新',
      });
    } catch (error) {
      toast({
        title: '保存失败',
        description:
          error instanceof Error ? error.message : '更新基础设置失败',
        variant: 'destructive',
      });
    }
  };

  const handleReset = async () => {
    try {
      await resetSettingsMutation.mutateAsync('basic');

      toast({
        title: '重置成功',
        description: '基础设置已重置为默认值',
      });
    } catch (error) {
      toast({
        title: '重置失败',
        description:
          error instanceof Error ? error.message : '重置基础设置失败',
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
              无法加载基础设置信息，请刷新页面重试。
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
              <Building className="mr-2 h-6 w-6" />
              基础设置
            </h1>
            <p className="text-muted-foreground">
              配置公司信息、系统名称和基本参数
            </p>
          </div>
        </div>
      </div>

      <Separator />

      {/* 设置表单 */}
      <div className="max-w-2xl">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* 公司信息 */}
            <Card>
              <CardHeader>
                <CardTitle>公司信息</CardTitle>
                <CardDescription>
                  配置公司的基本信息，这些信息将显示在系统界面和报表中
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 公司名称 */}
                <FormField
                  control={form.control}
                  name="companyName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>公司名称 *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="请输入公司名称"
                          disabled={isSubmitting}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        公司的正式名称，将显示在系统标题和报表中
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* 系统名称 */}
                <FormField
                  control={form.control}
                  name="systemName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>系统名称 *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="请输入系统名称"
                          disabled={isSubmitting}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        ERP系统的显示名称，将显示在浏览器标题和导航栏中
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Logo URL */}
                <FormField
                  control={form.control}
                  name="logoUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Logo URL</FormLabel>
                      <FormControl>
                        <div className="flex space-x-2">
                          <Input
                            placeholder="请输入Logo图片URL"
                            disabled={isSubmitting}
                            {...field}
                          />
                          <Button type="button" variant="outline" size="sm">
                            <Upload className="h-4 w-4" />
                          </Button>
                        </div>
                      </FormControl>
                      <FormDescription>
                        公司Logo的URL地址，建议使用PNG或SVG格式，尺寸为120x40像素
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* 公司地址 */}
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>公司地址</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="请输入公司地址"
                          disabled={isSubmitting}
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        公司的详细地址，将用于报表和对外文档
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {/* 联系电话 */}
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>联系电话</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="请输入联系电话"
                            disabled={isSubmitting}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* 联系邮箱 */}
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>联系邮箱</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="请输入联系邮箱"
                            disabled={isSubmitting}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* 系统配置 */}
            <Card>
              <CardHeader>
                <CardTitle>系统配置</CardTitle>
                <CardDescription>
                  配置系统的基本参数，影响整个系统的显示和行为
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  {/* 时区设置 */}
                  <FormField
                    control={form.control}
                    name="timezone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>时区 *</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          disabled={isSubmitting}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="选择时区" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {TIMEZONE_OPTIONS.map(option => (
                              <SelectItem
                                key={option.value}
                                value={option.value}
                              >
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* 语言设置 */}
                  <FormField
                    control={form.control}
                    name="language"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>语言 *</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          disabled={isSubmitting}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="选择语言" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {LANGUAGE_OPTIONS.map(option => (
                              <SelectItem
                                key={option.value}
                                value={option.value}
                              >
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* 货币设置 */}
                  <FormField
                    control={form.control}
                    name="currency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>货币 *</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          disabled={isSubmitting}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="选择货币" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {CURRENCY_OPTIONS.map(option => (
                              <SelectItem
                                key={option.value}
                                value={option.value}
                              >
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
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

export default BasicSettingsPage;
