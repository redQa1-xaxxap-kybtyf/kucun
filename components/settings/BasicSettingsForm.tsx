/**
 * 基本设置表单组件
 * 严格遵循全栈项目统一约定规范
 */

'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, RefreshCw, Save } from 'lucide-react';
import * as React from 'react';
import { useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
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
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { inventoryConfig, salesOrderConfig, systemConfig } from '@/lib/env';
import { queryKeys } from '@/lib/queryKeys';
import type { BasicSettings, SettingsApiResponse } from '@/lib/types/settings';
import { BasicSettingsFormSchema } from '@/lib/validations/settings';

import { SettingsSection } from './SettingsLayout';

// 表单数据类型
type BasicSettingsFormData = Partial<BasicSettings>;

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
  const response = await fetch('/api/settings/basic', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(settings),
  });

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
      // 更新缓存
      queryClient.setQueryData(['settings', 'basic'], data);
      toast({
        title: '保存成功',
        description: '基本设置已保存',
        variant: 'success',
      });

      // 重置表单状态
      form.reset(data);
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
    resolver: zodResolver(BasicSettingsFormSchema),
    defaultValues: settings || {
      // 提供默认值以避免受控/非受控组件警告，使用环境配置
      companyName: systemConfig.companyName,
      companyAddress: '',
      companyPhone: '',
      companyEmail: '',
      companyWebsite: '',
      systemName: systemConfig.companyName,
      systemVersion: '',
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
      form.reset(settings);
    }
  }, [settings, form]);

  // 表单提交处理
  const onSubmit = (data: BasicSettingsFormData) => {
    updateMutation.mutate(data);
  };

  // 重置表单
  const handleReset = () => {
    if (settings) {
      form.reset(settings);
      toast({
        title: '重置成功',
        description: '表单已重置',
      });
    }
  };

  // 加载状态
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="ml-2">加载设置中...</span>
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
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        {/* 公司信息 */}
        <SettingsSection
          title="公司信息"
          description="配置公司基本信息和联系方式"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="companyName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>公司名称 *</FormLabel>
                  <FormControl>
                    <Input placeholder="请输入公司名称" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="companyPhone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>联系电话</FormLabel>
                  <FormControl>
                    <Input placeholder="请输入联系电话" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="companyAddress"
            render={({ field }) => (
              <FormItem>
                <FormLabel>公司地址</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="请输入公司地址"
                    className="resize-none"
                    rows={2}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="companyEmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>公司邮箱</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="请输入公司邮箱"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="companyWebsite"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>公司网站</FormLabel>
                  <FormControl>
                    <Input
                      type="url"
                      placeholder="https://example.com"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </SettingsSection>

        {/* 系统配置 */}
        <SettingsSection
          title="系统配置"
          description="配置系统基本参数和显示信息"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="systemName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>系统名称 *</FormLabel>
                  <FormControl>
                    <Input placeholder="请输入系统名称" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="systemVersion"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>系统版本</FormLabel>
                  <FormControl>
                    <Input placeholder="1.0.0" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="systemDescription"
            render={({ field }) => (
              <FormItem>
                <FormLabel>系统描述</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="请输入系统描述"
                    className="resize-none"
                    rows={3}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </SettingsSection>

        {/* 业务配置 */}
        <SettingsSection
          title="业务配置"
          description="配置系统业务相关的基础参数"
        >
          <div className="grid gap-4 md:grid-cols-1">
            <FormField
              control={form.control}
              name="defaultLanguage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>默认语言</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="选择语言" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="zh">中文</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </SettingsSection>

        {/* 库存配置 */}
        <SettingsSection
          title="库存配置"
          description="配置库存管理相关的参数和预警设置"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="lowStockThreshold"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>低库存阈值</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="1"
                      max="9999"
                      placeholder="10"
                      {...field}
                      onChange={e => {
                        const value = e.target.value;
                        // 只允许正整数
                        if (value === '' || /^[1-9]\d*$/.test(value)) {
                          field.onChange(value === '' ? '' : Number(value));
                        }
                      }}
                      onBlur={e => {
                        const value = Number(e.target.value);
                        // 确保值在有效范围内
                        if (value < 1) {
                          field.onChange(1);
                        } else if (value > 9999) {
                          field.onChange(9999);
                        }
                      }}
                    />
                  </FormControl>
                  <FormDescription>
                    当库存数量低于此值时将触发预警（最小值：1，最大值：9999）
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="enableStockAlerts"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">库存预警</FormLabel>
                    <FormDescription>
                      启用库存不足时的自动预警通知
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
          </div>
        </SettingsSection>

        {/* 订单配置 */}
        <SettingsSection
          title="订单配置"
          description="配置订单管理相关的参数和流程设置"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="orderNumberPrefix"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>订单号前缀</FormLabel>
                  <FormControl>
                    <Input placeholder="SO" maxLength={10} {...field} />
                  </FormControl>
                  <FormDescription>
                    订单编号的前缀，如：SO20240101001
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="enableOrderApproval"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">订单审批</FormLabel>
                    <FormDescription>
                      启用订单创建后需要审批的流程
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
          </div>
        </SettingsSection>

        {/* 表单操作按钮 */}
        <div className="flex items-center justify-between border-t pt-6">
          <Button
            type="button"
            variant="outline"
            onClick={handleReset}
            disabled={isSubmitting || !hasChanges}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            重置
          </Button>

          <Button type="submit" disabled={isSubmitting || !hasChanges}>
            {isSubmitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {isSubmitting ? '保存中...' : '保存设置'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
