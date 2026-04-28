/**
 * 基本设置表单组件
 * 严格遵循全栈项目统一约定规范
 */

'use client';

import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, RefreshCw, Save } from 'lucide-react';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { inventoryConfig, salesOrderConfig, systemConfig } from '@/lib/env';
import { queryKeys } from '@/lib/queryKeys';
import type { BasicSettings, SettingsApiResponse } from '@/lib/types/settings';
import { cn } from '@/lib/utils';
import { getCsrfTokenHeader } from '@/lib/utils/csrf';
import { BasicSettingsFormSchema } from '@/lib/validations/settings';

import { SettingsSection } from './SettingsLayout';

// 表单数据类型 - 直接从Schema推断
type BasicSettingsFormData = z.infer<typeof BasicSettingsFormSchema>;

// 验证错误详情类型
interface ValidationDetail {
  field: string;
  message: string;
}

// 扩展的错误响应类型
interface ErrorResponseWithDetails {
  success: false;
  error?: string;
  details?: ValidationDetail[];
}

// API调用函数
const fetchBasicSettings = async (): Promise<BasicSettings> => {
  const response = await fetch('/api/settings/basic');
  const data: SettingsApiResponse<BasicSettings> | ErrorResponseWithDetails =
    await response.json();

  if (!data.success) {
    // 如果有详细的验证错误信息，显示具体错误
    if ('details' in data && Array.isArray(data.details)) {
      const errorMessages = data.details
        .map(detail => `${detail.field}: ${detail.message}`)
        .join('; ');
      throw new Error(`设置数据验证失败：${errorMessages}`);
    }
    throw new Error(('error' in data && data.error) || '获取基本设置失败');
  }

  if (!data.data) {
    throw new Error('获取基本设置失败：数据为空');
  }

  return data.data;
};

const updateBasicSettings = async (
  settings: BasicSettingsFormData
): Promise<BasicSettings> => {
  const response = await fetch(
    '/api/settings/basic',
    getCsrfTokenHeader({
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(settings),
    })
  );

  const data: SettingsApiResponse<BasicSettings> | ErrorResponseWithDetails =
    await response.json();

  if (!data.success) {
    // 如果有详细的验证错误信息，显示具体错误
    if ('details' in data && Array.isArray(data.details)) {
      const errorMessages = data.details
        .map(detail => `${detail.field}: ${detail.message}`)
        .join('; ');
      throw new Error(`数据验证失败：${errorMessages}`);
    }
    throw new Error(('error' in data && data.error) || '更新基本设置失败');
  }

  if (!data.data) {
    throw new Error('更新基本设置失败：数据为空');
  }

  return data.data;
};

/**
 * 基本设置表单组件
 */
export function BasicSettingsForm() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // 获取基本设置数据
  const {
    data: settings,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.settings.basic(),
    queryFn: fetchBasicSettings,
    staleTime: 5 * 60 * 1000, // 5分钟
  });

  // 更新设置的mutation
  const updateMutation = useMutation({
    mutationFn: updateBasicSettings,
    onSuccess: data => {
      const parsedLowStock =
        typeof data.lowStockThreshold === 'string'
          ? Number(data.lowStockThreshold)
          : data.lowStockThreshold;

      const normalizedData: BasicSettings = {
        ...data,
        lowStockThreshold:
          typeof parsedLowStock === 'number' && Number.isFinite(parsedLowStock)
            ? parsedLowStock
            : inventoryConfig.defaultMinQuantity,
      };

      // 更新缓存
      queryClient.setQueryData(queryKeys.settings.basic(), normalizedData);
      toast({
        title: '保存成功',
        description: '基本设置已保存',
        variant: 'success',
      });

      // 重置表单状态
      form.reset(normalizedData);
    },
    onError: error => {
      toast({
        title: '保存失败',
        description: error.message || '保存失败',
        variant: 'destructive',
      });
    },
  });

  // 表单配置
  const form = useForm<BasicSettingsFormData>({
    resolver: standardSchemaResolver(BasicSettingsFormSchema) as any,
    defaultValues: settings || {
      // 提供默认值以避免受控/非受控组件警告，使用环境配置
      companyName: systemConfig.companyName,
      companyAddress: '',
      companyPhone: '',
      companyEmail: '',
      companyWebsite: '',
      systemName: systemConfig.companyName,
      systemDescription: '',
      defaultLanguage: systemConfig.defaultLanguage,
      lowStockThreshold: inventoryConfig.defaultMinQuantity,
      enableStockAlerts: true,
      orderNumberPrefix: salesOrderConfig.orderPrefix,
      enableOrderApproval: false,
    },
  });

  // 当数据加载完成时，更新表单默认值
  React.useEffect(() => {
    if (settings) {
      const parsedLowStock =
        typeof settings.lowStockThreshold === 'string'
          ? Number(settings.lowStockThreshold)
          : settings.lowStockThreshold;

      form.reset({
        ...settings,
        lowStockThreshold:
          typeof parsedLowStock === 'number' && Number.isFinite(parsedLowStock)
            ? parsedLowStock
            : inventoryConfig.defaultMinQuantity,
      });
    }
  }, [settings, form]);

  // 表单提交处理
  const onSubmit = (data: BasicSettingsFormData) => {
    const parsedLowStock =
      typeof data.lowStockThreshold === 'string'
        ? Number(data.lowStockThreshold)
        : data.lowStockThreshold;

    const payload: BasicSettingsFormData = {
      ...data,
      lowStockThreshold:
        typeof parsedLowStock === 'number' && Number.isFinite(parsedLowStock)
          ? parsedLowStock
          : inventoryConfig.defaultMinQuantity,
    };

    updateMutation.mutate(payload);
  };

  // 重置表单
  const handleReset = () => {
    if (settings) {
      const parsedLowStock =
        typeof settings.lowStockThreshold === 'string'
          ? Number(settings.lowStockThreshold)
          : settings.lowStockThreshold;

      form.reset({
        ...settings,
        lowStockThreshold:
          typeof parsedLowStock === 'number' && Number.isFinite(parsedLowStock)
            ? parsedLowStock
            : inventoryConfig.defaultMinQuantity,
      });
      toast({
        title: '已恢复',
        description: '已恢复到上次保存',
        variant: 'success',
      });
    }
  };

  // 加载状态
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="ml-2">设置加载中...</span>
      </div>
    );
  }

  // 错误状态
  if (error) {
    return (
      <div className="py-8 text-center">
        <p className="text-destructive mb-4">加载设置失败: {error.message}</p>
        <Button onClick={() => refetch()} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          重试
        </Button>
      </div>
    );
  }

  const isSubmitting = updateMutation.isPending;
  const hasChanges = form.formState.isDirty;

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-12 pb-32 sm:pb-20"
      >
        {/* 公司信息 */}
        <SettingsSection title="公司信息" description="页面标题和打印抬头">
          <div className="grid gap-6 md:grid-cols-2">
            <FormField
              control={form.control}
              name="systemName"
              render={({ field }) => (
                <FormItem className="relative flex h-[130px] flex-col justify-between rounded-md border border-slate-100 bg-white p-6 shadow-sm hover:border-blue-100">
                  <div className="space-y-1">
                    <FormLabel className="text-sm font-semibold text-slate-900">
                      系统名称 *
                    </FormLabel>
                  </div>
                  <FormControl>
                    <Input
                      placeholder="如：瓷砖销售库存系统"
                      className="h-11 border-slate-100 bg-slate-50/50 px-4 font-bold text-slate-900 transition-all focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/10"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="absolute -bottom-6 left-2" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="defaultLanguage"
              render={({ field }) => (
                <FormItem className="relative flex h-[130px] flex-col justify-between rounded-md border border-slate-100 bg-white p-6 shadow-sm hover:border-blue-100">
                  <div className="space-y-1">
                    <FormLabel className="text-sm font-semibold text-slate-900">
                      默认语言
                    </FormLabel>
                  </div>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="h-11 border-slate-100 bg-slate-50/50 px-4 font-medium text-slate-700 transition-all focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/10">
                        <SelectValue placeholder="选择语言" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="zh" className="font-medium">
                        简体中文
                      </SelectItem>
                      <SelectItem value="en" className="font-medium">
                        English
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage className="absolute -bottom-6 left-2" />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="systemDescription"
            render={({ field }) => (
              <FormItem className="relative flex flex-col gap-4 rounded-md border border-slate-100 bg-white p-6 shadow-sm hover:border-blue-100">
                <div className="space-y-1">
                  <FormLabel className="text-sm font-semibold text-slate-900">
                    系统副标题
                  </FormLabel>
                </div>
                <FormControl>
                  <Textarea
                    placeholder="瓷砖销售、库存和财务一体化管理"
                    className="min-h-[100px] resize-none border-slate-100 bg-slate-50/50 p-4 font-medium italic transition-all focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/10"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </SettingsSection>

        {/* 库存提醒 */}
        <SettingsSection title="库存提醒" description="库存不足时提醒">
          <div className="grid gap-6 md:grid-cols-2">
            <FormField
              control={form.control}
              name="lowStockThreshold"
              render={({ field }) => (
                <FormItem className="relative flex h-[130px] flex-col justify-between rounded-md border border-slate-100 bg-white p-6 shadow-sm hover:border-blue-100">
                  <div className="space-y-1">
                    <FormLabel className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <RefreshCw className="h-4 w-4 text-blue-500" />
                      低库存提醒数量
                    </FormLabel>
                  </div>
                  <FormControl>
                    <div className="relative mt-2 w-full max-w-[180px]">
                      <Input
                        type="number"
                        className="h-11 border-slate-100 bg-slate-50/50 px-4 font-mono text-lg font-semibold text-slate-900 focus:bg-white focus:ring-blue-500"
                        {...field}
                        onChange={e => {
                          const value = e.target.value;
                          if (value === '' || /^[1-9]\d*$/.test(value)) {
                            field.onChange(value === '' ? '' : Number(value));
                          }
                        }}
                      />
                    </div>
                  </FormControl>
                  <FormMessage className="absolute -bottom-6 left-2" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="enableStockAlerts"
              render={({ field }) => (
                <FormItem className="flex h-[130px] flex-row items-center justify-between rounded-md border border-slate-100 bg-white p-6 shadow-sm hover:border-blue-100">
                  <div className="space-y-1">
                    <FormLabel className="text-sm font-semibold text-slate-900">
                      库存提醒
                    </FormLabel>
                  </div>
                  <div className="flex flex-col items-end gap-2 px-2">
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <span
                      className={cn(
                        'text-xs font-semibold tracking-tight transition-colors',
                        field.value ? 'text-blue-600' : 'text-slate-300'
                      )}
                    >
                      {field.value ? '已开启' : '已关闭'}
                    </span>
                  </div>
                </FormItem>
              )}
            />
          </div>
        </SettingsSection>

        {/* 订单设置 */}
        <SettingsSection title="订单设置" description="编号前缀和审批">
          <div className="grid gap-6 md:grid-cols-2">
            <FormField
              control={form.control}
              name="orderNumberPrefix"
              render={({ field }) => (
                <FormItem className="relative flex h-[130px] flex-col justify-between rounded-md border border-slate-100 bg-white p-6 shadow-sm hover:border-blue-100">
                  <div className="space-y-1">
                    <FormLabel className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      订单号前缀
                    </FormLabel>
                    <p className="text-[11px] font-medium text-slate-400">
                      例：SO
                    </p>
                  </div>
                  <FormControl>
                    <Input
                      placeholder="SO"
                      maxLength={10}
                      className="mt-2 h-11 w-full max-w-[180px] border-slate-100 bg-slate-50/50 font-mono font-semibold text-blue-600 transition-all focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/10"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="absolute -bottom-6 left-2" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="enableOrderApproval"
              render={({ field }) => (
                <FormItem className="flex h-[130px] flex-row items-center justify-between rounded-md border border-slate-100 bg-white p-6 shadow-sm hover:border-blue-100">
                  <div className="space-y-1">
                    <FormLabel className="text-sm font-semibold text-slate-900">
                      下单审批
                    </FormLabel>
                  </div>
                  <div className="flex flex-col items-end gap-2 px-2">
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <span
                      className={cn(
                        'text-xs font-semibold tracking-tight transition-colors',
                        field.value ? 'text-blue-600' : 'text-slate-300'
                      )}
                    >
                      {field.value ? '已开启' : '已关闭'}
                    </span>
                  </div>
                </FormItem>
              )}
            />
          </div>
        </SettingsSection>

        {/* 底部悬浮动作栏 / Floating Action Bar */}
        <div className="fixed inset-x-3 bottom-3 z-50 flex items-center gap-2 rounded-md border border-slate-200 bg-white p-2 shadow-md sm:inset-x-auto sm:bottom-6 sm:left-1/2 sm:w-fit sm:-translate-x-1/2 sm:gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={handleReset}
            disabled={isSubmitting || !hasChanges}
            className="h-11 min-w-0 flex-1 rounded-full px-4 font-bold text-slate-500 hover:bg-slate-50 disabled:opacity-30 sm:flex-none sm:px-6"
          >
            <RefreshCw
              className={cn('mr-2 h-4 w-4', isSubmitting && 'animate-spin')}
            />
            恢复
          </Button>

          <Button
            type="submit"
            disabled={isSubmitting || !hasChanges}
            className="h-11 min-w-0 flex-1 rounded-md bg-slate-900 px-5 font-semibold text-white shadow-sm hover:bg-slate-800 disabled:bg-slate-200 sm:flex-none sm:px-10"
          >
            {isSubmitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4 text-blue-400" />
            )}
            {isSubmitting ? '保存中...' : '保存'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
