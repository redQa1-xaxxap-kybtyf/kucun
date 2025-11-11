'use client';
/* eslint-disable max-lines-per-function */

import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus } from 'lucide-react';
import React from 'react';
import { useForm } from 'react-hook-form';

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
import { createSupplier, supplierQueryKeys } from '@/lib/api/suppliers';
import type { Supplier } from '@/lib/types/supplier';
import {
  CreateSupplierSchema,
  supplierCreateDefaults,
  type SupplierCreateFormData,
} from '@/lib/validations/supplier';

interface QuickAddSupplierDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSupplierCreated?: (supplier: Supplier) => void;
  initialName?: string;
}

export function QuickAddSupplierDialog({
  open,
  onOpenChange,
  onSupplierCreated,
  initialName = '',
}: QuickAddSupplierDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<SupplierCreateFormData>({
    resolver: standardSchemaResolver(CreateSupplierSchema),
    defaultValues: supplierCreateDefaults,
  });

  React.useEffect(() => {
    if (open && initialName) {
      form.setValue('name', initialName);
    }
  }, [open, initialName, form]);

  const createMutation = useMutation({
    mutationFn: async (values: SupplierCreateFormData) => {
      const payload = {
        name: values.name.trim(),
        phone: values.phone?.trim() ? values.phone.trim() : undefined,
        address: values.address?.trim() ? values.address.trim() : undefined,
      };

      const response = await createSupplier(payload);
      if (!response.success || !response.data) {
        throw new Error(response.error || '创建供应商失败');
      }
      return response.data;
    },
    onSuccess: supplier => {
      toast({
        title: '创建成功',
        description: `供应商 "${supplier.name}" 创建成功！`,
        variant: 'success',
      });

      // ✅ 使用 refetchQueries 强制立即刷新，确保用户创建供应商后立即看到新记录
      queryClient.refetchQueries({
        queryKey: supplierQueryKeys.all,
        type: 'active',
      });
      onSupplierCreated?.(supplier);

      form.reset(supplierCreateDefaults);
      onOpenChange(false);
    },
    onError: error => {
      toast({
        title: '创建失败',
        description: error instanceof Error ? error.message : '创建供应商失败',
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = form.handleSubmit(values => {
    createMutation.mutate(values);
  });

  const handleCancel = () => {
    form.reset(supplierCreateDefaults);
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={newOpen =>
        !createMutation.isPending && onOpenChange(newOpen)
      }
    >
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>快速新增供应商</DialogTitle>
          <DialogDescription>
            填写供应商基础信息，创建后会自动选中。
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>供应商名称 *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="请输入供应商名称"
                      {...field}
                      disabled={createMutation.isPending}
                    />
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
                    <Input
                      placeholder="请输入联系电话"
                      value={field.value ?? ''}
                      onChange={event => field.onChange(event.target.value)}
                      disabled={createMutation.isPending}
                    />
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
                  <FormLabel>联系地址</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="请输入联系地址"
                      value={field.value ?? ''}
                      onChange={event => field.onChange(event.target.value)}
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
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    创建中...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    创建供应商
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
