'use client';

import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, Building2, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
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
	import { updateSupplier } from '@/lib/api/suppliers';
import {
  UpdateSupplierSchema,
  supplierUpdateDefaults,
  type SupplierUpdateFormData,
} from '@/lib/validations/supplier';

interface EditSupplierFormProps {
  id: string;
  supplier: {
    name: string;
    phone?: string | null;
    address?: string | null;
    status: SupplierUpdateFormData['status'];
  };
}

export function EditSupplierForm({ id, supplier }: EditSupplierFormProps) {
  const router = useRouter();
  const { toast } = useToast();

  const form = useForm<SupplierUpdateFormData>({
    resolver: standardSchemaResolver(UpdateSupplierSchema),
    defaultValues: supplierUpdateDefaults,
  });

  useEffect(() => {
    form.reset({
      name: supplier.name,
      phone: supplier.phone || '',
      address: supplier.address || '',
      status: supplier.status,
    });
  }, [form, supplier]);

  const updateMutation = useMutation({
    mutationFn: (data: SupplierUpdateFormData) => updateSupplier(id, data),
    onSuccess: data => {
      toast({
        title: '更新成功',
        description: data.message || '供应商更新成功',
        variant: 'success',
      });
      router.push('/suppliers');
    },
    onError: error => {
      toast({
        title: '更新失败',
        description: error.message || '更新供应商失败',
        variant: 'destructive',
      });
    },
  });

  const isLoading = updateMutation.isPending;

  const onSubmit = (data: SupplierUpdateFormData) => {
    updateMutation.mutate({
      name: data.name,
      phone: data.phone || undefined,
      address: data.address || undefined,
      status: data.status,
    });
  };

  return (
    <>
      <Card className="overflow-hidden">
        <CardHeader className="border-b bg-gradient-to-r from-[hsl(var(--color-bg-secondary))] to-[hsl(var(--color-bg-tertiary))]">
          <CardTitle className="flex items-center text-[hsl(var(--color-text-primary))]">
            <Building2 className="mr-2 h-5 w-5 text-[hsl(var(--color-primary))]" />
            基本信息
          </CardTitle>
          <CardDescription>
            填写供应商的基本信息，包括名称、联系方式和地址
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>供应商名称 *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="请输入供应商名称"
                        disabled={isLoading}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      供应商的正式名称，最多100个字符
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
                    <FormDescription>
                      供应商的联系电话，支持手机和固话格式
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>地址</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="请输入供应商地址"
                        disabled={isLoading}
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      供应商的详细地址，最多200个字符
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

	              <FormField
	                control={form.control}
	                name="status"
	                render={({ field }) => (
	                  <FormItem>
	                    <FormLabel>状态</FormLabel>
	                    <FormControl>
	                      <select
	                        value={field.value}
	                        onChange={e => field.onChange(e.target.value)}
	                        disabled={isLoading}
	                        className="border-input bg-background ring-offset-background focus:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:cursor-not-allowed disabled:opacity-50"
	                      >
	                        <option value="active">活跃</option>
	                        <option value="inactive">停用</option>
	                      </select>
	                    </FormControl>
	                    <FormDescription>供应商的当前状态</FormDescription>
	                    <FormMessage />
	                  </FormItem>
	                )}
	              />
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardContent className="p-6">
          <div className="flex items-center justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => router.push('/suppliers')}
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
              onClick={form.handleSubmit(onSubmit)}
              className="h-11 gap-2 bg-[hsl(var(--color-primary))] text-white shadow-[var(--shadow-medium)] transition-transform hover:-translate-y-0.5 hover:bg-[hsl(var(--color-primary-hover))] hover:shadow-[var(--shadow-heavy)] focus-visible:ring-[hsl(var(--color-primary))]"
            >
              {isLoading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  更新中...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  更新供应商
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
