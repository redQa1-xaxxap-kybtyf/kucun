'use client';

import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, Building2, Save } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
import { createSupplier } from '@/lib/api/suppliers';
import {
  CreateSupplierSchema,
  supplierCreateDefaults,
  type SupplierCreateFormData,
} from '@/lib/validations/supplier';

export default function CreateSupplierPage() {
  const router = useRouter();
  const { toast } = useToast();

  // 表单配置
  const form = useForm<SupplierCreateFormData>({
    resolver: standardSchemaResolver(CreateSupplierSchema),
    defaultValues: supplierCreateDefaults,
    mode: 'all', // 在所有交互时验证
  });

  // 创建供应商
  const createMutation = useMutation({
    mutationFn: createSupplier,
    onSuccess: data => {
      toast({
        title: '创建成功',
        description: data.message || '供应商创建成功',
        variant: 'success',
      });
      router.push('/suppliers');
    },
    onError: error => {
      toast({
        title: '创建失败',
        description: error.message || '创建供应商失败',
        variant: 'destructive',
      });
    },
  });

  // 提交表单 - 这个函数只会在表单验证通过后被调用
  // Zod Schema 已经处理了 trim() 和所有验证，无需手动校验
  const onSubmit = async (data: SupplierCreateFormData) => {
    createMutation.mutate({
      name: data.name,
      phone: data.phone || undefined,
      address: data.address || undefined,
    });
  };

  const isLoading = createMutation.isPending;

  return (
    <div className="flex h-full flex-col overflow-auto p-6">
      <div className="space-y-6">
        {/* 页面标题卡片 */}
        <Card className="overflow-hidden">
          <CardContent className="bg-gradient-to-r from-[hsl(var(--color-primary-light))] to-[hsl(var(--color-primary-lighter))] p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[hsl(var(--color-primary))] shadow-[0_10px_24px_rgba(9,88,217,0.22)]">
                  <Building2 className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-[hsl(var(--color-text-primary))]">
                    新建供应商
                  </h1>
                  <p className="text-sm text-[hsl(var(--color-text-secondary))]">
                    创建新的供应商记录
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="lg"
                asChild
                className="h-11 gap-2 shadow-[var(--shadow-light)] transition-transform hover:-translate-y-0.5 hover:border-[hsl(var(--color-border-strong))] hover:shadow-[var(--shadow-medium)]"
              >
                <Link href="/suppliers">
                  <ArrowLeft className="h-4 w-4" />
                  返回
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 表单 */}
        <Card className="overflow-hidden">
          <CardHeader className="border-b bg-gradient-to-r from-[hsl(var(--color-bg-secondary))] to-[hsl(var(--color-bg-tertiary))]">
            <CardTitle className="flex items-center text-[hsl(var(--color-text-primary))]">
              <Building2 className="mr-2 h-5 w-5 text-[hsl(var(--color-primary))]" />
              基本信息
            </CardTitle>
            <CardDescription>
              供应商的基本信息，包括名称、联系方式等
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-6"
              >
                {/* 供应商名称 */}
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
                          value={field.value || ''} // 确保显示空字符串而不是 undefined
                        />
                      </FormControl>
                      <FormDescription>
                        供应商的正式名称，最多100个字符
                      </FormDescription>
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
                          disabled={isLoading}
                          {...field}
                          value={field.value || ''} // 确保显示空字符串而不是 undefined
                        />
                      </FormControl>
                      <FormDescription>
                        供应商的联系电话，支持手机和固话格式
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* 地址 */}
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
                          value={field.value || ''} // 确保显示空字符串而不是 undefined
                        />
                      </FormControl>
                      <FormDescription>
                        供应商的详细地址，最多200个字符
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* 操作按钮 */}
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
                    保存中...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    新建供应商
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
