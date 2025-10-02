'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

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
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import {
  customerQueryKeys,
  getCustomer,
  updateCustomer,
} from '@/lib/api/customers';
import type { CustomerUpdateInput } from '@/lib/types/customer';

// 简化的编辑表单验证模式
const editFormSchema = z.object({
  name: z
    .string()
    .min(1, '客户名称不能为空')
    .max(100, '客户名称不能超过100个字符'),
  phone: z.string().optional(),
  address: z.string().optional(),
});

type EditFormData = z.infer<typeof editFormSchema>;

interface CustomerEditDialogProps {
  customerId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * 客户编辑对话框组件
 * 支持编辑客户基本信息
 */
export function CustomerEditDialog({
  customerId,
  open,
  onOpenChange,
}: CustomerEditDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // 获取客户详情
  const { data: customer, isLoading: isLoadingCustomer } = useQuery({
    queryKey: customerId ? customerQueryKeys.detail(customerId) : [],
    queryFn: () => {
      if (!customerId) {throw new Error('Customer ID is required');}
      return getCustomer(customerId);
    },
    enabled: !!customerId && open,
  });

  // 表单配置
  const form = useForm<EditFormData>({
    resolver: zodResolver(editFormSchema),
    defaultValues: {
      name: '',
      phone: '',
      address: '',
    },
  });

  // 当客户数据加载完成时，更新表单默认值
  React.useEffect(() => {
    if (customer) {
      form.reset({
        name: customer.name,
        phone: customer.phone || '',
        address: customer.address || '',
      });
    }
  }, [customer, form]);

  // 更新客户信息
  const updateMutation = useMutation({
    mutationFn: (data: CustomerUpdateInput) => {
      if (!customerId) {throw new Error('Customer ID is required');}
      return updateCustomer(customerId, data);
    },
    onSuccess: () => {
      toast({
        title: '更新成功',
        description: '客户信息已成功更新',
      });

      // 刷新相关查询
      queryClient.invalidateQueries({
        queryKey: customerQueryKeys.lists(),
      });
      if (customerId) {
        queryClient.invalidateQueries({
          queryKey: customerQueryKeys.detail(customerId),
        });
      }

      onOpenChange(false);
    },
    onError: error => {
      toast({
        title: '更新失败',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: EditFormData) => {
    if (!customerId) {
      toast({
        title: '错误',
        description: '客户ID不能为空',
        variant: 'destructive',
      });
      return;
    }

    updateMutation.mutate({
      id: customerId,
      ...data,
    });
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      form.reset();
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>编辑客户</DialogTitle>
          <DialogDescription>修改客户的基本信息</DialogDescription>
        </DialogHeader>

        {isLoadingCustomer ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="h-4 w-16 animate-pulse rounded bg-muted" />
              <div className="h-10 animate-pulse rounded bg-muted" />
            </div>
            <div className="space-y-2">
              <div className="h-4 w-16 animate-pulse rounded bg-muted" />
              <div className="h-10 animate-pulse rounded bg-muted" />
            </div>
            <div className="space-y-2">
              <div className="h-4 w-16 animate-pulse rounded bg-muted" />
              <div className="h-20 animate-pulse rounded bg-muted" />
            </div>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>客户名称</FormLabel>
                    <FormControl>
                      <Input placeholder="请输入客户名称" {...field} />
                    </FormControl>
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
                      <Input placeholder="请输入联系电话" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>客户地址</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="请输入客户地址"
                        className="resize-none"
                        rows={3}
                        {...field}
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
                  onClick={() => handleOpenChange(false)}
                  disabled={updateMutation.isPending}
                >
                  取消
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  保存
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
