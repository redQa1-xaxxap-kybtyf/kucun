'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';

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
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  createCustomer,
  customerQueryKeys,
  updateCustomer,
} from '@/lib/api/customers';
import type { CreateCustomerData } from '@/lib/schemas/customer';
import { CreateCustomerSchema } from '@/lib/schemas/customer';
import type { Customer, CustomerUpdateInput } from '@/lib/types/customer';

interface ERPCustomerFormProps {
  mode?: 'create' | 'edit';
  initialData?: Customer;
  onSuccess?: () => void;
  onCancel?: () => void;
}

/**
 * ERP风格的客户表单组件
 * 采用紧凑布局，符合中国ERP系统用户习惯
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

  // 表单配置
  const form = useForm<CreateCustomerData>({
    resolver: zodResolver(CreateCustomerSchema),
    defaultValues: {
      name: initialData?.name || '',
      phone: initialData?.phone || '',
      address: initialData?.address || '',
      extendedInfo:
        typeof initialData?.extendedInfo === 'object' &&
        initialData?.extendedInfo !== null
          ? initialData.extendedInfo
          : {},
    },
  });

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
        setTimeout(() => {
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
      updateCustomer(initialData!.id, data),
    onSuccess: data => {
      toast({
        title: '更新成功',
        description: `客户 "${data.name}" 更新成功！`,
        variant: 'success',
      });
      queryClient.invalidateQueries({ queryKey: customerQueryKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: customerQueryKeys.detail(initialData!.id),
      });

      if (onSuccess) {
        onSuccess();
      } else {
        // 延迟跳转到客户列表页，让用户看到成功提示
        setTimeout(() => {
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
    if (mode === 'edit' && initialData) {
      // 编辑模式：转换为更新数据格式
      const updateData: CustomerUpdateInput = {
        id: initialData.id,
        name: data.name,
        phone: data.phone || '',
        address: data.address || '',
        extendedInfo: data.extendedInfo,
      };
      updateMutation.mutate(updateData);
    } else {
      // 创建模式：过滤空值
      const createData = {
        name: data.name,
        phone: data.phone || '',
        address: data.address || '',
        extendedInfo: data.extendedInfo,
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

  return (
    <div className="rounded border bg-card">
      {/* ERP标准工具栏 */}
      <div className="border-b bg-muted/30 px-3 py-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">
            {mode === 'create' ? '新建客户' : '编辑客户'}
          </h3>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7"
              onClick={handleCancel}
            >
              <ArrowLeft className="mr-1 h-3 w-3" />
              返回
            </Button>
          </div>
        </div>
      </div>

      {/* 表单区域 */}
      <div className="px-3 py-2">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* 基本信息区域 */}
            <div className="space-y-3">
              <div className="text-xs font-medium text-muted-foreground">
                基本信息
              </div>
              <div className="grid grid-cols-1 gap-x-4 gap-y-3 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="space-y-1">
                      <FormLabel className="text-xs">客户名称 *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="请输入客户名称"
                          className="h-7 text-xs"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem className="space-y-1">
                      <FormLabel className="text-xs">联系电话</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="请输入联系电话"
                          className="h-7 text-xs"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem className="space-y-1">
                    <FormLabel className="text-xs">地址</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="请输入客户地址"
                        className="min-h-[60px] text-xs"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />
            </div>

            {/* 扩展信息区域 */}
            <div className="space-y-3">
              <div className="text-xs font-medium text-muted-foreground">
                扩展信息（可选）
              </div>
              <div className="grid grid-cols-1 gap-x-4 gap-y-3 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium">联系人</label>
                  <Input
                    placeholder="请输入联系人姓名"
                    className="h-7 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium">邮箱</label>
                  <Input
                    type="email"
                    placeholder="请输入邮箱地址"
                    className="h-7 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium">备注</label>
                <Textarea
                  placeholder="请输入备注信息"
                  className="min-h-[60px] text-xs"
                />
              </div>
            </div>

            {/* 操作按钮区域 */}
            <div className="-mx-3 -mb-2 border-t bg-muted/10 px-3 py-2">
              <div className="flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7"
                  onClick={handleCancel}
                  disabled={
                    createMutation.isPending || updateMutation.isPending
                  }
                >
                  取消
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="h-7"
                  disabled={
                    createMutation.isPending || updateMutation.isPending
                  }
                >
                  {createMutation.isPending || updateMutation.isPending ? (
                    <>
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      {mode === 'create' ? '创建中...' : '保存中...'}
                    </>
                  ) : (
                    <>
                      <Save className="mr-1 h-3 w-3" />
                      {mode === 'create' ? '创建客户' : '保存修改'}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}
