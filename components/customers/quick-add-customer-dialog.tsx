'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus } from 'lucide-react';
import React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import {
  AddressSelector,
  formatAddressString,
} from '@/components/ui/address-selector';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { createCustomer, customerQueryKeys } from '@/lib/api/customers';
import {
  CreateCustomerSchema,
  type CreateCustomerData,
} from '@/lib/schemas/customer';

interface QuickAddCustomerDialogProps {
  onCustomerCreated?: (customer: { id: string; name: string }) => void;
  trigger?: React.ReactNode;
}

/**
 * 快速添加客户对话框
 * 提供简化的客户创建流程
 */
export function QuickAddCustomerDialog({
  onCustomerCreated,
  trigger,
}: QuickAddCustomerDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // 表单配置
  const form = useForm<CreateCustomerData & { notes: string }>({
    resolver: zodResolver(
      CreateCustomerSchema.extend({
        notes: z.string().optional(),
      })
    ),
    defaultValues: {
      name: '',
      phone: '',
      address: { province: '', city: '', district: '', detail: '' },
      extendedInfo: {},
      notes: '',
    },
  });

  // 创建客户
  const createMutation = useMutation({
    mutationFn: createCustomer,
    onSuccess: data => {
      // 创建客户成功
      toast({
        title: '创建成功',
        description: `客户 "${data.name}" 创建成功！`,
      });

      // 刷新客户列表
      queryClient.invalidateQueries({ queryKey: customerQueryKeys.lists() });

      // 回调通知父组件
      if (onCustomerCreated) {
        onCustomerCreated({ id: data.id, name: data.name });
      }

      // 重置表单并关闭对话框
      form.reset();
      setOpen(false);
    },
    onError: error => {
      toast({
        title: '创建失败',
        description: error instanceof Error ? error.message : '创建失败',
        variant: 'destructive',
      });
    },
  });

  // 提交表单
  const onSubmit = (data: CreateCustomerData & { notes: string }) => {
    const { notes, ...customerData } = data;

    // 将地址对象转换为字符串以保持API兼容性
    const addressString =
      typeof customerData.address === 'string'
        ? customerData.address
        : formatAddressString(customerData.address);

    // 将备注信息存储到 extendedInfo 中
    const submitData: CreateCustomerData = {
      ...customerData,
      address: addressString,
      extendedInfo: notes ? { notes } : {},
    };

    createMutation.mutate(submitData);
  };

  // 取消操作
  const handleCancel = () => {
    form.reset();
    setOpen(false);
  };

  const [open, setOpen] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Plus className="mr-1 h-3 w-3" />
            快速添加新客户
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>快速添加客户</DialogTitle>
          <DialogDescription>
            填写客户基本信息，快速创建新客户记录
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
                      {...field}
                      disabled={createMutation.isPending}
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
                      placeholder="请输入联系电话"
                      {...field}
                      disabled={createMutation.isPending}
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
                <FormItem>
                  <FormLabel>客户地址</FormLabel>
                  <FormControl>
                    <AddressSelector
                      value={field.value || undefined}
                      onChange={field.onChange}
                      disabled={createMutation.isPending}
                      showLabel={false}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 备注信息 */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>备注信息</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="请输入备注信息（可选）"
                      className="min-h-[60px]"
                      {...field}
                      disabled={createMutation.isPending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={createMutation.isPending}
              >
                取消
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    创建中...
                  </>
                ) : (
                  <>
                    <Plus className="mr-1 h-3 w-3" />
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
