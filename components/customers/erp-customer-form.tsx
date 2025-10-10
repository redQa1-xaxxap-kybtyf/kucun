'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Save, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';

import {
  AddressSelector,
  formatAddressString,
  type AddressData,
} from '@/components/ui/address-selector';
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
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import {
  createCustomer,
  customerQueryKeys,
  updateCustomer,
} from '@/lib/api/customers';
import type {
  Customer,
  CustomerExtendedInfo,
  CustomerUpdateInput,
} from '@/lib/types/customer';
import {
  customerCreateSchema as CreateCustomerSchema,
  type CustomerCreateFormData as CreateCustomerData,
  customerCreateDefaults,
  parseExtendedInfo,
  processExtendedInfo,
} from '@/lib/validations/customer';

interface ERPCustomerFormProps {
  mode?: 'create' | 'edit';
  initialData?: Customer;
  onSuccess?: () => void;
  onCancel?: () => void;
}

/**
 * 客户表单组件
 * ✅ 统一 UI 样式，与产品管理表单保持一致
 */
export function ERPCustomerForm({
  mode = 'create',
  initialData,
  onSuccess,
  onCancel,
}: ERPCustomerFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // 用于清理导航定时器的引用
  const navigationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 表单配置
  const form = useForm<CreateCustomerData>({
    resolver: zodResolver(CreateCustomerSchema),
    defaultValues: {
      ...customerCreateDefaults,
      name: initialData?.name || '',
      phone: initialData?.phone || '',
      address: initialData?.address || '',
      extendedInfo: {
        ...(customerCreateDefaults.extendedInfo ?? {}),
        ...(typeof initialData?.extendedInfo === 'string'
          ? parseExtendedInfo(initialData.extendedInfo)
          : {}),
      },
    },
  });

  // 组件卸载时清理定时器
  useEffect(() => {
    return () => {
      if (navigationTimerRef.current) {
        clearTimeout(navigationTimerRef.current);
      }
    };
  }, []);

  const normalizeExtendedInfo = (
    extendedInfo?: CreateCustomerData['extendedInfo']
  ): CustomerExtendedInfo | undefined => {
    if (!extendedInfo) {
      return undefined;
    }
    const processed = processExtendedInfo(extendedInfo);
    if (!processed) {
      return undefined;
    }
    try {
      return JSON.parse(processed) as CustomerExtendedInfo;
    } catch {
      // JSON.parse 失败时不返回扩展信息，避免中断提交流程
      return undefined;
    }
  };

  // 创建客户Mutation
  const createMutation = useMutation({
    mutationFn: createCustomer,
    onSuccess: data => {
      toast({
        title: '创建成功',
        description: `客户 "${data.name}" 创建成功！`,
        variant: 'success',
      });
      queryClient.invalidateQueries({ queryKey: customerQueryKeys.lists() });

      if (onSuccess) {
        onSuccess();
      } else {
        // 延迟跳转到客户列表页，让用户看到成功提示
        navigationTimerRef.current = setTimeout(() => {
          router.push('/customers');
        }, 1500);
      }
    },
    onError: error => {
      toast({
        title: '创建失败',
        description: error instanceof Error ? error.message : '创建失败',
        variant: 'destructive',
      });
    },
  });

  // 更新客户Mutation
  const updateMutation = useMutation({
    mutationFn: (data: CustomerUpdateInput) =>
      updateCustomer(initialData?.id || '', data),
    onSuccess: data => {
      toast({
        title: '更新成功',
        description: `客户 "${data.name}" 更新成功！`,
        variant: 'success',
      });
      queryClient.invalidateQueries({ queryKey: customerQueryKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: customerQueryKeys.detail(initialData?.id || ''),
      });

      if (onSuccess) {
        onSuccess();
      } else {
        // 延迟跳转到客户列表页，让用户看到成功提示
        navigationTimerRef.current = setTimeout(() => {
          router.push('/customers');
        }, 1500);
      }
    },
    onError: error => {
      toast({
        title: '更新失败',
        description: error instanceof Error ? error.message : '更新失败',
        variant: 'destructive',
      });
    },
  });

  // 表单提交处理
  const onSubmit = (data: CreateCustomerData) => {
    const extendedInfoPayload = normalizeExtendedInfo(data.extendedInfo);

    if (mode === 'edit' && initialData) {
      // 编辑模式：转换为更新数据格式
      const updateData: CustomerUpdateInput = {
        id: initialData.id,
        name: data.name,
        phone: data.phone || '',
        address:
          typeof data.address === 'string'
            ? data.address
            : data.address
              ? formatAddressString(data.address as AddressData)
              : '',
        extendedInfo: extendedInfoPayload,
      };
      updateMutation.mutate(updateData);
    } else {
      // 创建模式：过滤空值
      const createData = {
        name: data.name,
        phone: data.phone || '',
        address:
          typeof data.address === 'string'
            ? data.address
            : data.address
              ? formatAddressString(data.address as AddressData)
              : '',
        extendedInfo: extendedInfoPayload,
      };
      createMutation.mutate(createData);
    }
  };

  // 处理取消
  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      router.back();
    }
  };

  const isEdit = mode === 'edit';
  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <>
      {/* 页面标题卡片 */}
      <Card className="overflow-hidden">
        <CardContent className="bg-gradient-to-r from-[hsl(var(--color-primary-light))] to-[hsl(var(--color-primary-lighter))] p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[hsl(var(--color-primary))] shadow-[0_10px_24px_rgba(9,88,217,0.22)]">
                <Users className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-[hsl(var(--color-text-primary))]">
                  {isEdit ? '编辑客户' : '新建客户'}
                </h1>
                <p className="text-sm text-[hsl(var(--color-text-secondary))]">
                  {isEdit ? '修改客户信息' : '创建新的客户记录'}
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={handleCancel}
              className="h-11 gap-2 shadow-[var(--shadow-light)] transition-transform hover:-translate-y-0.5 hover:border-[hsl(var(--color-border-strong))] hover:shadow-[var(--shadow-medium)]"
            >
              <ArrowLeft className="h-4 w-4" />
              返回
            </Button>
          </div>
        </CardContent>
      </Card>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* 基础信息 */}
          <Card className="overflow-hidden">
            <CardHeader className="border-b bg-gradient-to-r from-[hsl(var(--color-bg-secondary))] to-[hsl(var(--color-bg-tertiary))]">
              <CardTitle className="flex items-center text-[hsl(var(--color-text-primary))]">
                <Users className="mr-2 h-5 w-5 text-[hsl(var(--color-primary))]" />
                基础信息
              </CardTitle>
              <CardDescription>
                客户的基本信息，包括名称、联系方式等
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>客户名称 *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="请输入客户名称"
                          disabled={isLoading}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        客户的显示名称，最多100个字符
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>联系电话</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="请输入联系电话"
                          disabled={isLoading}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>客户的主要联系电话</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>地址</FormLabel>
                    <FormControl>
                      <AddressSelector
                        value={field.value}
                        onChange={addressData => {
                          const addressString =
                            formatAddressString(addressData);
                          field.onChange(addressString);
                        }}
                        showLabel={false}
                        disabled={isLoading}
                      />
                    </FormControl>
                    <FormDescription>客户的详细地址信息</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* 扩展信息 */}
          <Card className="overflow-hidden">
            <CardHeader className="border-b bg-gradient-to-r from-[hsl(var(--color-bg-secondary))] to-[hsl(var(--color-bg-tertiary))]">
              <CardTitle className="text-[hsl(var(--color-text-primary))]">扩展信息</CardTitle>
              <CardDescription>客户的其他补充信息（可选）</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="extendedInfo.contactPerson"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>联系人</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="请输入联系人姓名"
                            disabled={isLoading}
                            {...field}
                            value={field.value ?? ''}
                          />
                        </FormControl>
                        <FormDescription>客户的主要联系人姓名</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="extendedInfo.email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>邮箱</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="请输入邮箱地址"
                            disabled={isLoading}
                            {...field}
                            value={field.value ?? ''}
                          />
                        </FormControl>
                        <FormDescription>客户的电子邮箱地址</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="extendedInfo.notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>备注</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="请输入备注信息"
                          className="min-h-[100px]"
                          disabled={isLoading}
                          {...field}
                          value={field.value ?? ''}
                        />
                      </FormControl>
                      <FormDescription>其他需要记录的客户信息</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* 表单操作按钮 */}
          <Card className="overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-center justify-end gap-4">
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={handleCancel}
                  disabled={isLoading}
                  className="h-11 gap-2 shadow-[var(--shadow-light)] transition-transform hover:-translate-y-0.5 hover:border-[hsl(var(--color-border-strong))] hover:shadow-[var(--shadow-medium)]"
                >
                  <ArrowLeft className="h-4 w-4" />
                  取消
                </Button>
                <Button
                  type="submit"
                  size="lg"
                  disabled={isLoading}
                  className="h-11 gap-2 bg-[hsl(var(--color-primary))] text-white shadow-[var(--shadow-medium)] transition-transform hover:-translate-y-0.5 hover:bg-[hsl(var(--color-primary-hover))] hover:shadow-[var(--shadow-heavy)] focus-visible:ring-[hsl(var(--color-primary))]"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {mode === 'create' ? '创建中...' : '保存中...'}
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      {mode === 'create' ? '创建客户' : '保存修改'}
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </Form>
    </>
  );
}
