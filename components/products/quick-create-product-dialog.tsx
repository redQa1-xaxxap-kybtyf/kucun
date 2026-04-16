'use client';

import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { createProduct } from '@/app/actions/products';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes-guard';
import { PRODUCT_UNIT_OPTIONS } from '@/lib/config/product';
import { queryKeys } from '@/lib/queryKeys';
import type { Product } from '@/lib/types/product';

// 快速创建产品的简化验证规则
const quickCreateProductSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, '产品编码不能为空')
    .max(50, '产品编码不能超过50个字符')
    .regex(/^[A-Za-z0-9-_]+$/, '产品编码只能包含字母、数字、短横线和下划线'),
  name: z
    .string()
    .trim()
    .min(1, '产品名称不能为空')
    .max(100, '产品名称不能超过100个字符'),
  specification: z
    .string()
    .trim()
    .min(1, '产品规格不能为空')
    .max(200, '规格描述不能超过200个字符'),
  unit: z.enum(['piece', 'sheet'], {
    message: '请选择有效的计量单位',
  }),
  description: z
    .string()
    .max(1000, '产品描述不能超过1000个字符')
    .optional()
    .or(z.literal('')),
});

type QuickCreateProductFormData = z.infer<typeof quickCreateProductSchema>;

interface QuickCreateProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (product: Product) => void;
  defaultCode?: string;
}

export function QuickCreateProductDialog({
  open,
  onOpenChange,
  onSuccess,
  defaultCode,
}: QuickCreateProductDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<QuickCreateProductFormData>({
    resolver: standardSchemaResolver(quickCreateProductSchema),
    defaultValues: {
      code: defaultCode || '',
      name: '',
      specification: '',
      unit: 'sheet',
      description: '',
    },
  });

  // 当对话框打开时，重置表单并设置默认编码
  React.useEffect(() => {
    if (open) {
      form.reset({
        code: defaultCode || '',
        name: '',
        specification: '',
        unit: 'sheet',
        description: '',
      });
    }
  }, [open, defaultCode, form]);

  const createMutation = useMutation({
    mutationFn: async (data: QuickCreateProductFormData) => {
      const formData = new FormData();
      formData.append(
        'data',
        JSON.stringify({
          ...data,
          categoryId: 'uncategorized', // 默认分类
          status: 'active',
        })
      );
      return createProduct(formData);
    },
    onSuccess: async result => {
      if (result.success && result.data) {
        toast({
          title: '创建成功',
          description: '产品已创建并自动选中',
          variant: 'success',
        });

        // ✅ 使用 refetchQueries 强制立即刷新，确保用户创建产品后立即看到新记录
        await queryClient.refetchQueries({
          queryKey: queryKeys.products.all,
          type: 'active',
        });

        // 获取新创建的产品详情
        const productId = result.data.id;

        // 等待一小段时间确保数据已同步
        await new Promise(resolve => setTimeout(resolve, 100));

        // 调用成功回调，传递产品ID（选择器会自动查询详情）
        onSuccess?.({
          id: productId,
          code: result.data.code,
          name: form.getValues('name'),
          specification: form.getValues('specification'),
          unit: form.getValues('unit'),
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as Product);

        // 关闭对话框
        onOpenChange(false);
      } else {
        toast({
          title: '创建失败',
          description: result.error || '创建产品失败',
          variant: 'destructive',
        });
      }
    },
    onError: () => {
      toast({
        title: '创建失败',
        description: '创建产品失败，请重试',
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = form.handleSubmit(data => {
    createMutation.mutate(data);
  });
  const hasUnsavedChanges =
    open && form.formState.isDirty && !createMutation.isPending;
  const { confirmLeavePage } = useUnsavedChangesGuard({
    enabled: hasUnsavedChanges,
    message: '当前产品资料尚未保存，确定要关闭吗？',
  });

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && !confirmLeavePage()) {
      return;
    }

    onOpenChange(nextOpen);
  };

  const handleCancel = () => {
    if (!confirmLeavePage()) {
      return;
    }

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>快速添加产品</DialogTitle>
          <DialogDescription>
            填写基本信息快速创建产品，创建后将自动选中该产品
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    产品编码 <span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="例如: TILE-001"
                      disabled={createMutation.isPending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    产品名称 <span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="例如: 抛光砖"
                      disabled={createMutation.isPending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="specification"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    产品规格 <span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="例如: 800x800mm"
                      disabled={createMutation.isPending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="unit"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    计量单位 <span className="text-destructive">*</span>
                  </FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={createMutation.isPending}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="选择单位" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {PRODUCT_UNIT_OPTIONS.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>产品描述</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="选填，可以添加产品的详细描述"
                      rows={3}
                      disabled={createMutation.isPending}
                      className="resize-none"
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
                {createMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                新建并选择
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
