'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, User } from 'lucide-react';
import * as React from 'react';
import { useForm } from 'react-hook-form';

import { AddressSelector } from '@/components/ui/address-selector';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { createCustomer, customerQueryKeys } from '@/lib/api/customers';
import {
  customerCreateSchema as CreateCustomerSchema,
  type CustomerCreateFormData as CreateCustomerData,
} from '@/lib/validations/customer';

interface CustomerCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCustomerCreated?: (customer: {
    id: string;
    name: string;
    phone?: string;
  }) => void;
  initialName?: string;
}

/**
 * 客户新增对话框组件
 * 用于在销售订单创建过程中快速新增客户
 * 严格遵循全栈项目统一约定规范
 */
export function CustomerCreateDialog({
  open,
  onOpenChange,
  onCustomerCreated,
  initialName = '',
}: CustomerCreateDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // 表单配置
  const form = useForm<CreateCustomerData>({
    resolver: zodResolver(CreateCustomerSchema),
    defaultValues: {
      name: '',
      phone: '',
      address: {
        province: '',
        city: '',
        district: '',
        detail: '',
      },
      extendedInfo: {},
    },
  });

  // 当对话框打开时，设置初始名称
  React.useEffect(() => {
    if (open && initialName) {
      form.setValue('name', initialName);
    }
  }, [open, initialName, form]);

  // 创建客户Mutation
  const createMutation = useMutation({
    mutationFn: createCustomer,
    onSuccess: data => {
      toast({
        title: '创建成功',
        description: `客户 "${data.name}" 创建成功！`,
        variant: 'success',
      });

      // 刷新客户列表缓存
      queryClient.invalidateQueries({ queryKey: customerQueryKeys.lists() });

      // 通知父组件客户已创建
      onCustomerCreated?.(data);

      // 关闭对话框并重置表单
      handleClose();
    },
    onError: error => {
      toast({
        title: '创建失败',
        description: error instanceof Error ? error.message : '创建失败',
        variant: 'destructive',
      });
    },
  });

  // 表单提交处理
  const onSubmit = (data: CreateCustomerData) => {
    createMutation.mutate(data);
  };

  // 关闭对话框
  const handleClose = () => {
    form.reset({
      name: '',
      phone: '',
      address: {
        province: '',
        city: '',
        district: '',
        detail: '',
      },
      extendedInfo: {},
    });
    onOpenChange(false);
  };

  // 处理对话框状态变化
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && !createMutation.isPending) {
      handleClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            新增客户
          </DialogTitle>
          <DialogDescription>
            快速创建新客户，创建后将自动选择该客户
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* 客户名称 */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>客户名称 *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="请输入客户名称"
                      disabled={createMutation.isPending}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 联系电话 */}
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>联系电话</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="请输入手机号码"
                      disabled={createMutation.isPending}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 客户地址 */}
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <AddressSelector
                  value={field.value}
                  onChange={field.onChange}
                  label="客户地址"
                  disabled={createMutation.isPending}
                />
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={createMutation.isPending}
              >
                取消
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending}
                className="min-w-[100px]"
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    创建中...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    创建客户
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
