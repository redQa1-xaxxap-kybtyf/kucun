/**
 * 业务设置页面
 * 管理库存预警、订单规则、财务配置等核心业务设置
 */

'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  ArrowLeft,
  DollarSign,
  Package,
  Receipt,
  RotateCcw,
  Save,
  Settings,
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
import { Checkbox } from '@/components/ui/checkbox';
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
import { PAYMENT_METHOD_OPTIONS } from '@/lib/types/settings';
import { usePermissions } from '@/lib/utils/permissions';
import {
  BusinessSettingsSchema,
  businessSettingsDefaults,
  type BusinessSettingsFormData,
} from '@/lib/validations/settings';

const BusinessSettingsPage = () => {
  const router = useRouter();
  const { data: session } = useSession();
  const permissions = usePermissions(session?.user?.role);
  const { toast } = useToast();

  const {
    data: settingsResponse,
    isLoading,
    error,
  } = useCategorySettings('business');
  const updateSettingsMutation = useUpdateSettings();
  const resetSettingsMutation = useResetSettings();

  const form = useForm<BusinessSettingsFormData>({
    resolver: zodResolver(BusinessSettingsSchema),
    defaultValues: businessSettingsDefaults,
  });

  // 权限检查
  useEffect(() => {
    if (!permissions.isAdmin()) {
      router.push('/settings');
    }
  }, [permissions, router]);

  // 当设置数据加载完成时，填充表单
  useEffect(() => {
    if (settingsResponse?.data?.business) {
      const businessSettings = settingsResponse.data.business;
      form.reset({
        lowStockThreshold: businessSettings.lowStockThreshold || 10,
        orderNumberFormat:
          businessSettings.orderNumberFormat || 'SO{YYYYMMDD}{序号}',
        returnPeriodDays: businessSettings.returnPeriodDays || 30,
        priceDecimalPlaces: businessSettings.priceDecimalPlaces || 2,
        defaultTaxRate: businessSettings.defaultTaxRate || 0.13,
        paymentMethods: businessSettings.paymentMethods || ['现金', '银行转账'],
        enableInventoryTracking:
          businessSettings.enableInventoryTracking ?? true,
        enableBarcodeScanning: businessSettings.enableBarcodeScanning ?? false,
        autoGenerateOrderNumbers:
          businessSettings.autoGenerateOrderNumbers ?? true,
      });
    }
  }, [settingsResponse, form]);

  const onSubmit = async (data: BusinessSettingsFormData) => {
    try {
      await updateSettingsMutation.mutateAsync({
        category: 'business',
        data,
      });

      toast({
        title: '保存成功',
        description: '业务设置已更新',
      });
    } catch (error) {
      toast({
        title: '保存失败',
        description:
          error instanceof Error ? error.message : '更新业务设置失败',
        variant: 'destructive',
      });
    }
  };

  const handleReset = async () => {
    try {
      await resetSettingsMutation.mutateAsync('business');

      toast({
        title: '重置成功',
        description: '业务设置已重置为默认值',
      });
    } catch (error) {
      toast({
        title: '重置失败',
        description:
          error instanceof Error ? error.message : '重置业务设置失败',
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
              无法加载业务设置信息，请刷新页面重试。
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
              <Settings className="mr-2 h-6 w-6" />
              业务设置
            </h1>
            <p className="text-muted-foreground">
              配置库存管理、订单处理和财务规则
            </p>
          </div>
        </div>
      </div>

      <Separator />

      {/* 设置表单 */}
      <div className="max-w-2xl">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* 库存管理 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Package className="mr-2 h-5 w-5" />
                  库存管理
                </CardTitle>
                <CardDescription>配置库存预警和跟踪相关设置</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 库存预警阈值 */}
                <FormField
                  control={form.control}
                  name="lowStockThreshold"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>库存预警阈值</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          max="1000"
                          disabled={isSubmitting}
                          {...field}
                          onChange={e =>
                            field.onChange(parseInt(e.target.value))
                          }
                        />
                      </FormControl>
                      <FormDescription>
                        当产品库存低于此数量时发出预警提醒
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {/* 启用库存跟踪 */}
                  <FormField
                    control={form.control}
                    name="enableInventoryTracking"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">
                            启用库存跟踪
                          </FormLabel>
                          <FormDescription>
                            自动跟踪产品库存变化
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

                  {/* 启用条码扫描 */}
                  <FormField
                    control={form.control}
                    name="enableBarcodeScanning"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">
                            启用条码扫描
                          </FormLabel>
                          <FormDescription>支持条码扫描功能</FormDescription>
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

            {/* 订单管理 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Receipt className="mr-2 h-5 w-5" />
                  订单管理
                </CardTitle>
                <CardDescription>配置订单编号规则和处理流程</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 订单编号格式 */}
                <FormField
                  control={form.control}
                  name="orderNumberFormat"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>订单编号格式</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="SO{YYYYMMDD}{序号}"
                          disabled={isSubmitting}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        支持变量：{'{YYYY}'} 年份，{'{MM}'} 月份，{'{DD}'}{' '}
                        日期，{'{序号}'} 流水号
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {/* 退货期限 */}
                  <FormField
                    control={form.control}
                    name="returnPeriodDays"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>退货期限（天）</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            max="365"
                            disabled={isSubmitting}
                            {...field}
                            onChange={e =>
                              field.onChange(parseInt(e.target.value))
                            }
                          />
                        </FormControl>
                        <FormDescription>
                          允许客户退货的最长期限
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* 自动生成订单编号 */}
                  <FormField
                    control={form.control}
                    name="autoGenerateOrderNumbers"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">
                            自动生成订单编号
                          </FormLabel>
                          <FormDescription>
                            根据格式自动生成订单编号
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

            {/* 财务设置 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <DollarSign className="mr-2 h-5 w-5" />
                  财务设置
                </CardTitle>
                <CardDescription>配置价格、税率和付款方式</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {/* 价格小数位数 */}
                  <FormField
                    control={form.control}
                    name="priceDecimalPlaces"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>价格小数位数</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            max="4"
                            disabled={isSubmitting}
                            {...field}
                            onChange={e =>
                              field.onChange(parseInt(e.target.value))
                            }
                          />
                        </FormControl>
                        <FormDescription>价格显示的小数位数</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* 默认税率 */}
                  <FormField
                    control={form.control}
                    name="defaultTaxRate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>默认税率</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            max="1"
                            step="0.01"
                            disabled={isSubmitting}
                            {...field}
                            onChange={e =>
                              field.onChange(parseFloat(e.target.value))
                            }
                          />
                        </FormControl>
                        <FormDescription>
                          默认增值税率（0.13 = 13%）
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* 付款方式 */}
                <FormField
                  control={form.control}
                  name="paymentMethods"
                  render={() => (
                    <FormItem>
                      <div className="mb-4">
                        <FormLabel className="text-base">
                          支持的付款方式
                        </FormLabel>
                        <FormDescription>
                          选择系统支持的付款方式
                        </FormDescription>
                      </div>
                      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                        {PAYMENT_METHOD_OPTIONS.map(method => (
                          <FormField
                            key={method}
                            control={form.control}
                            name="paymentMethods"
                            render={({ field }) => (
                              <FormItem
                                key={method}
                                className="flex flex-row items-start space-x-3 space-y-0"
                              >
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes(method)}
                                    onCheckedChange={checked =>
                                      checked
                                        ? field.onChange([
                                            ...field.value,
                                            method,
                                          ])
                                        : field.onChange(
                                            field.value?.filter(
                                              value => value !== method
                                            )
                                          )
                                    }
                                    disabled={isSubmitting}
                                  />
                                </FormControl>
                                <FormLabel className="font-normal">
                                  {method}
                                </FormLabel>
                              </FormItem>
                            )}
                          />
                        ))}
                      </div>
                      <FormMessage />
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

export default BusinessSettingsPage;
